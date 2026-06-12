// TheSportsDB — free fallback results source for WC2026 (league id 4429).
//
// Why: football-data.org's free tier delays scores ("Scores delayed" — the
// opening match's final landed ~19 min after FT, and the status flipped to
// FINISHED before the score was published). TheSportsDB's free v1 API serves
// final scores with group + date, so /api/sync uses it to fill results FD
// hasn't published yet. A fallback row is accepted ONLY when both team names
// map to known app codes AND the pair matches an FD fixture on the same date —
// a name we can't map simply means "no fallback for that match", never a wrong
// row.
//
// Endpoint docs: https://www.thesportsdb.com/free_sports_api ("123" is the
// free/test key, 30 req/min). League: https://www.thesportsdb.com/league/4429

import { ALL_TEAMS } from "@/lib/tournament/groups";

const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/123";
const WC_LEAGUE_ID = "4429";

/** TheSportsDB team names that don't normalize cleanly to our `name` field. */
const TSDB_NAME_TO_CODE: Record<string, string> = {
  "czech republic": "CZE",
  "bosnia and herzegovina": "BIH",
  "korea republic": "KOR",
  "south korea": "KOR",
  "usa": "USA",
  "united states": "USA",
  "ivory coast": "CIV",
  "cote divoire": "CIV",
  "curacao": "CUR",
  "iran": "IRN",
  "ir iran": "IRN",
  "saudi arabia": "KSA",
  "new zealand": "NZL",
  "cape verde": "CPV",
  "cabo verde": "CPV",
  "dr congo": "COD",
  "congo dr": "COD",
  "democratic republic of congo": "COD",
};

const normalizeName = (s: string): string =>
  s.toLowerCase().replace(/['’`´׳]/g, "").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();

let nameIndex: Record<string, string> | null = null;
function getNameIndex(): Record<string, string> {
  if (nameIndex) return nameIndex;
  nameIndex = { ...TSDB_NAME_TO_CODE };
  for (const t of ALL_TEAMS) {
    nameIndex[normalizeName(t.name)] = t.code;
  }
  return nameIndex;
}

/** Map a TheSportsDB team name to an app code, or null when unknown. */
export function tsdbNameToCode(name: string | null | undefined): string | null {
  if (!name) return null;
  return getNameIndex()[normalizeName(name)] ?? null;
}

interface TsdbEvent {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  intHomeScore: string | null;
  intAwayScore: string | null;
  dateEvent: string; // "2026-06-11" (UTC date of kickoff)
  strGroup: string | null;
  strTimestamp: string | null;
}

export interface TsdbResult {
  homeCode: string;
  awayCode: string;
  homeGoals: number;
  awayGoals: number;
  /** UTC kickoff date, "YYYY-MM-DD". */
  date: string;
}

async function fetchPastEvents(): Promise<TsdbEvent[]> {
  const res = await fetch(`${TSDB_BASE}/eventspastleague.php?id=${WC_LEAGUE_ID}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { events?: TsdbEvent[] | null };
  return data.events || [];
}

/**
 * Recent finished WC2026 results from TheSportsDB (the league's last ~15
 * events with a final score). Returns [] on any error — strictly best-effort.
 */
export async function getTsdbRecentResults(): Promise<TsdbResult[]> {
  try {
    const out: TsdbResult[] = [];
    for (const e of await fetchPastEvents()) {
      if (e.intHomeScore == null || e.intAwayScore == null) continue;
      const homeCode = tsdbNameToCode(e.strHomeTeam);
      const awayCode = tsdbNameToCode(e.strAwayTeam);
      if (!homeCode || !awayCode) continue; // unmappable name → skip, never guess
      out.push({
        homeCode,
        awayCode,
        homeGoals: Number(e.intHomeScore),
        awayGoals: Number(e.intAwayScore),
        date: (e.strTimestamp || e.dateEvent || "").slice(0, 10),
      });
    }
    return out;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Cards (the "dirtiest team" board) — free timeline endpoint carries bookings:
// strTimeline === "Card" with strTimelineDetail "Yellow Card" / "Red Card" /
// "Second Yellow card". football-data's free tier has NO bookings at all, so
// this is the only automatic card source.
// ---------------------------------------------------------------------------

interface TsdbTimelineEntry {
  strTimeline: string | null;
  strTimelineDetail: string | null;
  strPlayer: string | null;
  strHome: string | null; // "Yes" → home team
}

export interface TsdbTeamCards {
  team: string; // app code
  yellow: number;
  red: number;
}

/**
 * Aggregate yellow/red cards per team across the league's recent finished
 * matches. League rule: a second yellow in the same game counts as ONE red
 * (the first yellow converts) — so when a player has both a plain yellow and a
 * second-yellow/red entry in the same match, one yellow is dropped. A straight
 * red after an unrelated yellow keeps both.
 *
 * Returns null when the source is unreachable (callers must then SKIP the
 * update — never write an empty board over real data).
 */
export async function getTsdbCardBoard(): Promise<TsdbTeamCards[] | null> {
  try {
    const events = (await fetchPastEvents()).filter(
      (e) => e.intHomeScore != null && e.intAwayScore != null
    );
    if (events.length === 0) return null;

    const byTeam: Record<string, { yellow: number; red: number }> = {};
    const bump = (code: string, kind: "yellow" | "red", n = 1) => {
      byTeam[code] = byTeam[code] || { yellow: 0, red: 0 };
      byTeam[code][kind] += n;
    };

    for (const e of events) {
      const homeCode = tsdbNameToCode(e.strHomeTeam);
      const awayCode = tsdbNameToCode(e.strAwayTeam);
      if (!homeCode || !awayCode) continue;

      const res = await fetch(`${TSDB_BASE}/lookuptimeline.php?id=${e.idEvent}`, {
        cache: "no-store",
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { timeline?: TsdbTimelineEntry[] | null };
      const cards = (data.timeline || []).filter((t) => t.strTimeline === "Card");

      // Group by player within the match to apply the second-yellow rule.
      const byPlayer: Record<string, { team: string; yellows: number; reds: number; secondYellow: boolean }> = {};
      for (const c of cards) {
        const team = c.strHome === "Yes" ? homeCode : awayCode;
        const player = `${team}:${c.strPlayer || "?"}`;
        const detail = (c.strTimelineDetail || "").toLowerCase();
        byPlayer[player] = byPlayer[player] || { team, yellows: 0, reds: 0, secondYellow: false };
        if (detail.includes("second")) {
          byPlayer[player].reds += 1;
          byPlayer[player].secondYellow = true;
        } else if (detail.includes("red")) {
          byPlayer[player].reds += 1;
          // Yellow→Red without an explicit "second yellow" detail is treated
          // as a second yellow when a plain yellow precedes it (common feed
          // encoding); a red with no prior yellow stays a straight red.
          if (byPlayer[player].yellows > 0) byPlayer[player].secondYellow = true;
        } else if (detail.includes("yellow")) {
          byPlayer[player].yellows += 1;
        }
      }
      for (const p of Object.values(byPlayer)) {
        const yellows = p.secondYellow ? Math.max(0, p.yellows - 1) : p.yellows;
        if (yellows) bump(p.team, "yellow", yellows);
        if (p.reds) bump(p.team, "red", p.reds);
      }
    }

    return Object.entries(byTeam)
      .map(([team, c]) => ({ team, yellow: c.yellow, red: c.red }))
      .sort((a, b) => (b.yellow + b.red * 3) - (a.yellow + a.red * 3));
  } catch {
    return null;
  }
}
