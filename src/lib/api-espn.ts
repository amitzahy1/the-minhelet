// ESPN's public (unofficial, keyless) soccer API — the one free source with
// ACCURATE, untruncated data for WC2026. Verified live: USA-PAR returns
// Paraguay 5 yellows, MEX-RSA returns RSA 2🟨2🟥, and goal events carry the
// scorer AND assister — unlike football-data free (assists null) and
// TheSportsDB free (every match capped to 5 timeline/stat rows).
//
// Caveats: undocumented, no SLA — ESPN can change/remove it. So everything
// here is best-effort (returns null on failure; callers never overwrite good
// data with nothing) and the special-bet board stays admin-correctable.

import { ALL_TEAMS } from "@/lib/tournament/groups";
import type { CardRow } from "@/lib/sync-results";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world";
// Whole-tournament window — one scoreboard call returns every event in range,
// each tagged with its state ("post" = finished). June 11 – July 19, 2026.
const DATE_RANGE = "20260611-20260719";
const MAX_SUMMARY_FETCHES = 25; // bound per call (most-recent-first); ESPN has no published limit but be polite

const VALID_CODES = new Set(ALL_TEAMS.map((t) => t.code));

const normalizeName = (s: string): string =>
  s.toLowerCase().replace(/['’`´׳]/g, "").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();

/** ESPN displayName/abbreviation → app code, for the cases plain matching misses. */
const ESPN_NAME_TO_CODE: Record<string, string> = {
  "united states": "USA", "czechia": "CZE", "czech republic": "CZE",
  "south korea": "KOR", "korea republic": "KOR",
  "bosnia-herzegovina": "BIH", "bosnia and herzegovina": "BIH",
  "ir iran": "IRN", "iran": "IRN", "saudi arabia": "KSA",
  "ivory coast": "CIV", "cote divoire": "CIV", "curacao": "CUR",
  "cape verde": "CPV", "cabo verde": "CPV", "new zealand": "NZL", "dr congo": "COD",
};

let nameIndex: Record<string, string> | null = null;
function getNameIndex(): Record<string, string> {
  if (nameIndex) return nameIndex;
  nameIndex = { ...ESPN_NAME_TO_CODE };
  for (const t of ALL_TEAMS) nameIndex[normalizeName(t.name)] = t.code;
  return nameIndex;
}

function toCode(abbr: string | undefined, displayName: string | undefined): string | null {
  if (abbr && VALID_CODES.has(abbr.toUpperCase())) return abbr.toUpperCase();
  if (displayName) {
    const byName = getNameIndex()[normalizeName(displayName)];
    if (byName) return byName;
  }
  return null;
}

interface EspnEvent { id: string; competitions?: { status?: { type?: { state?: string } } }[] }

async function fetchJson(url: string, revalidate?: number): Promise<unknown | null> {
  try {
    const res = await fetch(url, revalidate ? { next: { revalidate } } : { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** Finished-match summary JSONs (most-recent-first, capped). null on failure. */
async function fetchFinishedSummaries(revalidate?: number): Promise<unknown[] | null> {
  const board = await fetchJson(`${ESPN_BASE}/scoreboard?dates=${DATE_RANGE}`, revalidate);
  const events = (board as { events?: EspnEvent[] } | null)?.events;
  if (!events) return null;
  const finished = events
    .filter((e) => e.competitions?.[0]?.status?.type?.state === "post")
    .reverse()
    .slice(0, MAX_SUMMARY_FETCHES);
  if (finished.length === 0) return null;
  const out: unknown[] = [];
  for (const ev of finished) {
    const s = await fetchJson(`${ESPN_BASE}/summary?event=${ev.id}`, revalidate);
    if (s) out.push(s);
  }
  return out.length > 0 ? out : null;
}

// ---------------------------------------------------------------------------
// Cards (the "dirtiest team" board) — per-team Yellow/Red totals from each
// match's boxscore aggregate (ESPN already sums them; no timeline parsing).
// ---------------------------------------------------------------------------

interface EspnStat { name?: string; displayValue?: string }
interface EspnTeamBox { team?: { abbreviation?: string; displayName?: string }; statistics?: EspnStat[] }
const statValue = (stats: EspnStat[], name: string): number => {
  const s = stats.find((x) => x.name === name);
  const n = s ? parseInt(s.displayValue || "0", 10) : 0;
  return Number.isFinite(n) ? n : 0;
};

export async function getEspnCardBoard(): Promise<CardRow[] | null> {
  const summaries = await fetchFinishedSummaries(); // no-store: cards must be live
  if (!summaries) return null;
  const byTeam: Record<string, { yellow: number; red: number }> = {};
  for (const summary of summaries) {
    const teams = (summary as { boxscore?: { teams?: EspnTeamBox[] } }).boxscore?.teams;
    if (!teams) continue;
    for (const t of teams) {
      const code = toCode(t.team?.abbreviation, t.team?.displayName);
      if (!code) continue;
      const cur = (byTeam[code] = byTeam[code] || { yellow: 0, red: 0 });
      cur.yellow += statValue(t.statistics || [], "yellowCards");
      cur.red += statValue(t.statistics || [], "redCards");
    }
  }
  return Object.entries(byTeam)
    .map(([team, c]) => ({ team, yellow: c.yellow, red: c.red }))
    .filter((r) => r.yellow > 0 || r.red > 0)
    .sort((a, b) => (b.yellow + b.red * 3) - (a.yellow + a.red * 3));
}

// ---------------------------------------------------------------------------
// Player goals + assists — from goal keyEvents (scorer = participant[0],
// assister = participant[1]). Excludes own goals and shootout goals. This is
// the data football-data's free tier lacks (assists come back null there).
// ---------------------------------------------------------------------------

export interface EspnPlayer { name: string; team: string; goals: number; assists: number; played: number }

interface EspnKeyEvent {
  type?: { text?: string };
  team?: { displayName?: string };
  shootout?: boolean;
  participants?: { athlete?: { displayName?: string } }[];
}

export async function getEspnPlayerStats(): Promise<EspnPlayer[] | null> {
  const summaries = await fetchFinishedSummaries(600); // 10-min cache: scorers move slowly
  if (!summaries) return null;
  const byPlayer: Record<string, EspnPlayer> = {};
  const get = (name: string, team: string): EspnPlayer =>
    (byPlayer[name] = byPlayer[name] || { name, team, goals: 0, assists: 0, played: 0 });

  for (const summary of summaries) {
    const events = (summary as { keyEvents?: EspnKeyEvent[] }).keyEvents || [];
    for (const e of events) {
      const text = (e.type?.text || "").toLowerCase();
      if (!text.includes("goal") || text.includes("own goal") || e.shootout) continue;
      const teamCode = toCode(undefined, e.team?.displayName) || "";
      const scorer = e.participants?.[0]?.athlete?.displayName;
      const assister = e.participants?.[1]?.athlete?.displayName;
      if (scorer) get(scorer, teamCode).goals += 1;
      if (assister) get(assister, teamCode).assists += 1;
    }
  }
  return Object.values(byPlayer).sort((a, b) => b.goals - a.goals || b.assists - a.assists);
}
