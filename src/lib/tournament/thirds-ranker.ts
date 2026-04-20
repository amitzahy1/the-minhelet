// ============================================================================
// WC2026 — Best Third-Place Teams Ranker
//
// 8 of the 12 third-placed teams advance to the Round of 32.
// Ranking applies FIFA tiebreakers across all groups:
//   1. Points
//   2. Goal difference
//   3. Goals for
//   4. Fair-play score (fewer cards wins; defaults to 0 if unknown)
//   5. Drawing of lots — deterministic fallback on group letter
//
// Head-to-head is intentionally not used here: the 3rds come from different
// groups and have never played each other.
// ============================================================================

import { GROUP_LETTERS } from "./groups";

/** Minimal per-team row the ranker needs. */
export interface ThirdsInputRow {
  group: string;          // "A"..."L"
  team_code: string;
  played: number;
  points: number;
  goal_difference: number;
  goals_for: number;
  fair_play_score?: number;
}

export interface RankedThird extends ThirdsInputRow {
  rank: number;           // 1..12 across all 3rd-placed teams
  qualifies: boolean;     // true for ranks 1..8
}

export interface ThirdsRanking {
  /** All 12 third-placed teams ranked 1..12. Missing groups are omitted. */
  ranked: RankedThird[];
  /** Subset that qualifies (top 8). */
  qualified: RankedThird[];
  /** Group letters of the qualifying 3rds, sorted alphabetically. */
  qualifiedGroups: string[];
  /** team_code keyed by group letter, only for qualifying groups. */
  teamByGroup: Record<string, string>;
  /** True iff every group has played all matches (played === 3 for every 3rd). */
  isFinal: boolean;
}

/**
 * Rank the 3rd-placed teams from 12 groups and return the top 8 qualifiers.
 *
 * `thirds` may be passed in any order; groups without a 3rd-placed team yet
 * (e.g. tournament not started) are simply omitted from the ranking.
 */
export function rankBestThirds(thirds: ThirdsInputRow[]): ThirdsRanking {
  const sorted = [...thirds].sort(compareThirds);

  const ranked: RankedThird[] = sorted.map((row, i) => ({
    ...row,
    rank: i + 1,
    qualifies: i < 8,
  }));

  const qualified = ranked.filter((r) => r.qualifies);
  const qualifiedGroups = qualified.map((r) => r.group).sort();
  const teamByGroup: Record<string, string> = {};
  for (const r of qualified) teamByGroup[r.group] = r.team_code;

  const isFinal =
    thirds.length === GROUP_LETTERS.length &&
    thirds.every((r) => r.played >= 3);

  return { ranked, qualified, qualifiedGroups, teamByGroup, isFinal };
}

function compareThirds(a: ThirdsInputRow, b: ThirdsInputRow): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.goal_difference !== a.goal_difference)
    return b.goal_difference - a.goal_difference;
  if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;
  const fpA = a.fair_play_score ?? 0;
  const fpB = b.fair_play_score ?? 0;
  if (fpA !== fpB) return fpA - fpB;
  return a.group.localeCompare(b.group);
}
