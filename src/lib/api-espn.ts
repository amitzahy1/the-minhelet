// ESPN's public (unofficial, keyless) soccer API — the one free source with
// ACCURATE, untruncated card data for WC2026. Verified live: USA-PAR returns
// Paraguay 5 yellows, MEX-RSA returns RSA 2🟨2🟥 — matching reality, unlike
// TheSportsDB's free tier (which caps every match to 5 timeline/stat rows).
//
// Caveats: undocumented, no SLA — ESPN can change/remove it. So it's wrapped in
// the same best-effort + MAX-merge + admin-correctable safety as before. We
// read the per-team aggregate card counts straight from each match's boxscore
// (no timeline parsing, no second-yellow bookkeeping — ESPN already aggregates).

import { ALL_TEAMS } from "@/lib/tournament/groups";
import type { CardRow } from "@/lib/sync-results";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
// Whole-tournament window — one scoreboard call returns every event in range,
// each tagged with its state ("post" = finished). June 11 – July 19, 2026.
const DATE_RANGE = "20260611-20260719";
const MAX_SUMMARY_FETCHES = 20; // bound per sync (most-recent-first); ESPN has no published limit but be polite

const VALID_CODES = new Set(ALL_TEAMS.map((t) => t.code));

const normalizeName = (s: string): string =>
  s.toLowerCase().replace(/['’`´׳]/g, "").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();

/** ESPN displayName/abbreviation → app code, for the cases plain matching misses. */
const ESPN_NAME_TO_CODE: Record<string, string> = {
  "united states": "USA",
  "czechia": "CZE",
  "czech republic": "CZE",
  "south korea": "KOR",
  "korea republic": "KOR",
  "bosnia-herzegovina": "BIH",
  "bosnia and herzegovina": "BIH",
  "ir iran": "IRN",
  "iran": "IRN",
  "saudi arabia": "KSA",
  "ivory coast": "CIV",
  "cote divoire": "CIV",
  "curacao": "CUR",
  "cape verde": "CPV",
  "cabo verde": "CPV",
  "new zealand": "NZL",
  "dr congo": "COD",
};

let nameIndex: Record<string, string> | null = null;
function getNameIndex(): Record<string, string> {
  if (nameIndex) return nameIndex;
  nameIndex = { ...ESPN_NAME_TO_CODE };
  for (const t of ALL_TEAMS) nameIndex[normalizeName(t.name)] = t.code;
  return nameIndex;
}

/** Resolve an ESPN competitor to an app team code. Abbreviation first (ESPN's
 *  are FIFA-style and usually match our codes), then a name lookup. */
function toCode(abbr: string | undefined, displayName: string | undefined): string | null {
  if (abbr && VALID_CODES.has(abbr.toUpperCase())) return abbr.toUpperCase();
  if (displayName) {
    const byName = getNameIndex()[normalizeName(displayName)];
    if (byName) return byName;
  }
  return null;
}

interface EspnCompetitor { team?: { abbreviation?: string; displayName?: string } }
interface EspnEvent { id: string; competitions?: { status?: { type?: { state?: string } }; competitors?: EspnCompetitor[] }[] }
interface EspnStat { name?: string; displayValue?: string }
interface EspnTeamBox { team?: { abbreviation?: string; displayName?: string }; statistics?: EspnStat[] }

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const statValue = (stats: EspnStat[], name: string): number => {
  const s = stats.find((x) => x.name === name);
  const n = s ? parseInt(s.displayValue || "0", 10) : 0;
  return Number.isFinite(n) ? n : 0;
};

/**
 * Full per-team card tally across all finished WC2026 matches. Returns the
 * cumulative board (so the caller's MAX-merge stays correct), or null on total
 * failure (so the caller never overwrites a good board with nothing).
 */
export async function getEspnCardBoard(): Promise<CardRow[] | null> {
  const board = await fetchJson(`${ESPN_BASE}/scoreboard?dates=${DATE_RANGE}`);
  const events = (board as { events?: EspnEvent[] } | null)?.events;
  if (!events) return null;

  const finished = events
    .filter((e) => e.competitions?.[0]?.status?.type?.state === "post")
    .reverse() // most-recent-first
    .slice(0, MAX_SUMMARY_FETCHES);
  if (finished.length === 0) return null;

  const byTeam: Record<string, { yellow: number; red: number }> = {};
  let anyOk = false;

  for (const ev of finished) {
    const summary = await fetchJson(`${ESPN_BASE}/summary?event=${ev.id}`);
    const teams = (summary as { boxscore?: { teams?: EspnTeamBox[] } } | null)?.boxscore?.teams;
    if (!teams || teams.length === 0) continue;
    anyOk = true;
    for (const t of teams) {
      const code = toCode(t.team?.abbreviation, t.team?.displayName);
      if (!code) continue;
      const stats = t.statistics || [];
      const yellow = statValue(stats, "yellowCards");
      const red = statValue(stats, "redCards");
      const cur = (byTeam[code] = byTeam[code] || { yellow: 0, red: 0 });
      cur.yellow += yellow;
      cur.red += red;
    }
  }

  if (!anyOk) return null;
  return Object.entries(byTeam)
    .map(([team, c]) => ({ team, yellow: c.yellow, red: c.red }))
    .filter((r) => r.yellow > 0 || r.red > 0)
    .sort((a, b) => (b.yellow + b.red * 3) - (a.yellow + a.red * 3));
}
