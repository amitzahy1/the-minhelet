// Identity bridge between football-data.org and this app.
//
// The app keys EVERYTHING on FIFA codes — flags, squads, market values, group
// defs, predicted lineups, advancement matching. Football-data.org uses a few
// TLAs that differ from those codes; left unmapped, they silently break every
// downstream lookup (the betting page can't sort by real kickoff date, so
// matchday headers come out in the wrong order; names/flags/advancement fall
// back to placeholders). So we normalise at the one boundary where external
// data enters (`/api/matches`) and VALIDATE loudly that every real team maps —
// a silent fallback is exactly what hid the original CUW/URY bug.

import { ALL_TEAMS } from "@/lib/tournament/groups";

/** football-data TLA → app internal code, for the cases where they differ. */
export const FD_TLA_TO_APP: Record<string, string> = {
  CUW: "CUR", // Curaçao (Group E)
  URY: "URU", // Uruguay (Group H)
};

/** Normalise a football-data TLA to the app's internal code. */
export const toAppCode = (tla: string | undefined): string =>
  (tla && FD_TLA_TO_APP[tla]) || tla || "TBD";

/** Every code the app actually knows about (from the group definitions). */
const VALID_APP_CODES = new Set(ALL_TEAMS.map((t) => t.code));

/** Placeholder TLAs football-data uses before a slot resolves — never errors. */
const PLACEHOLDER = new Set(["TBD", ""]);

export interface FixtureTeamRef {
  /** Already-normalised app code (post `toAppCode`). */
  homeTla: string;
  awayTla: string;
  /** Group label like "GROUP_E", or undefined for knockout slots. */
  group?: string;
  stage?: string;
}

/**
 * Return the set of normalised codes that DON'T map to any team the app knows.
 * Used by the API route to surface a loud warning instead of silently serving
 * a fixture nobody can match. Placeholders (TBD) are ignored — only real,
 * resolved teams should map. Re-run after every knockout round: a newly-drawn
 * team may carry a TLA the map hasn't seen yet.
 */
export function findUnmappedTeams(matches: FixtureTeamRef[]): string[] {
  const unmapped = new Set<string>();
  for (const m of matches) {
    for (const code of [m.homeTla, m.awayTla]) {
      if (PLACEHOLDER.has(code)) continue;
      if (!VALID_APP_CODES.has(code)) unmapped.add(code);
    }
  }
  return [...unmapped].sort();
}
