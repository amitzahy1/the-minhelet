"use client";

// Shared client-side loader for the real tournament fixtures (from
// /api/matches — the same source the schedule/לוז page uses). Centralising it
// here guarantees every page that lists matches orders them identically: by
// real kickoff time. The synthetic round-robin pairing in the group-betting
// page does NOT reflect the real matchday order, so it must be sorted against
// these real dates.

export interface RealFixture {
  id: number;
  date: string;
  homeTla: string;
  awayTla: string;
  group?: string;
  stage?: string;
}

let _cache: { ts: number; matches: RealFixture[] } | null = null;
const TTL = 300_000; // 5 min — fixtures barely change

export async function loadRealFixtures(): Promise<RealFixture[]> {
  if (_cache && Date.now() - _cache.ts < TTL) return _cache.matches;
  try {
    const res = await fetch("/api/matches");
    const data = await res.json();
    const matches: RealFixture[] = (data.matches || []).map((m: RealFixture) => ({
      id: m.id,
      date: m.date,
      homeTla: m.homeTla,
      awayTla: m.awayTla,
      group: m.group,
      stage: m.stage,
    }));
    _cache = { ts: Date.now(), matches };
    return matches;
  } catch {
    return _cache?.matches ?? [];
  }
}

/** Order-independent key for a team pairing (the betting page may list the two
 *  teams home/away in a different order than the real fixture). */
export const pairKey = (a: string, b: string): string => [a, b].sort().join("|");

export interface FixtureInfo {
  /** Kickoff time — used to order matches chronologically. */
  date: string;
  /** The real (official) home team TLA — the "1" in 1X2, shown on the right. */
  home: string;
  /** The real away team TLA. */
  away: string;
}

/**
 * Map of unordered team-pair → real fixture info for one group letter
 * (e.g. "A"). Used to (a) sort the betting page's synthetic matchups into real
 * chronological order and (b) orient each match so the real home team is on the
 * right (RTL), matching the official 1X2 listing.
 */
export function groupFixtureInfo(
  matches: RealFixture[],
  groupLetter: string,
): Record<string, FixtureInfo> {
  const out: Record<string, FixtureInfo> = {};
  for (const m of matches) {
    const g = (m.group || "").replace("GROUP_", "");
    if (g !== groupLetter) continue;
    if (!m.homeTla || !m.awayTla) continue;
    out[pairKey(m.homeTla, m.awayTla)] = { date: m.date, home: m.homeTla, away: m.awayTla };
  }
  return out;
}
