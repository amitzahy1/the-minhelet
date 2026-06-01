// ============================================================================
// WC2026 — User bracket derivation (shared by the simulation tree + migration)
//
// Given a user's GROUP predictions, derive the R32 matchups for THEIR bracket:
//   • Winner / runner-up slots resolve per-group as soon as that group is scored.
//   • The 8 winner-vs-third slots need the user's real best-8 thirds, which are
//     only knowable once ALL 12 groups are fully predicted. Until then the third
//     opponents are left unresolved (the "?" sentinel group → resolveSlot null).
//
// This reuses the SAME pipeline as the live resolver (calculateStandings →
// rankBestThirds → getThirdsAssignment → buildR32Matchups) so Tree 1 and Tree 2
// agree on who plays whom for identical standings.
// ============================================================================

import { GROUPS, GROUP_LETTERS, getTeamByCode } from "./groups";
import { calculateStandings } from "./standings";
import { rankBestThirds, type ThirdsInputRow } from "./thirds-ranker";
import { getThirdsAssignment, WINNER_SLOTS_VS_THIRD } from "./annex-c";
import { buildR32Matchups } from "./knockout-derivation";
import type { GroupMatchPrediction } from "@/types";

export interface UserGroupState {
  order: number[];
  scores: { home: number | null; away: number | null }[];
}

export interface UserR32Derivation {
  /** Slot → {h, a} in slot notation (A1/B2/C3). Third slots use "?" until ready. */
  matchups: Record<string, { h: string; a: string }>;
  /** Group letters of the user's best-8 thirds (empty until all groups complete). */
  qualifiedGroups: string[];
  /** True once all 12 groups are fully predicted and the thirds are resolved. */
  thirdsReady: boolean;
  /** True if the resolved assignment came from the official Annex C table. */
  isOfficial: boolean;
}

/** The 6 within-group matchups, in the canonical scores[] order (generateMatchups). */
function groupMatchups(codes: string[]): { h: string; a: string }[] {
  const [a, b, c, d] = codes;
  return [
    { h: a, a: b }, { h: c, a: d }, { h: a, a: c },
    { h: d, a: b }, { h: d, a: a }, { h: b, a: c },
  ];
}

/** Sentinel matchups: concrete W/RU slots, but every third opponent unresolved. */
const UNRESOLVED_THIRDS = Object.fromEntries(
  WINNER_SLOTS_VS_THIRD.map((slot) => [slot, "?"]),
);

export function deriveUserR32Matchups(
  groups: Record<string, UserGroupState>,
): UserR32Derivation {
  const rows: ThirdsInputRow[] = [];
  let allComplete = true;

  for (const letter of GROUP_LETTERS) {
    const g = groups[letter];
    const teams = GROUPS[letter] || [];
    const filled = g?.scores?.filter((s) => s.home != null && s.away != null).length ?? 0;
    if (teams.length < 4 || filled < 6) {
      allComplete = false;
      continue;
    }
    const codes = teams.map((t) => t.code);
    const preds: GroupMatchPrediction[] = groupMatchups(codes).map((m, i) => ({
      match_id: i,
      home_team_code: m.h,
      away_team_code: m.a,
      home_goals: g.scores[i].home as number,
      away_goals: g.scores[i].away as number,
    }));
    const standings = calculateStandings(teams.map((t) => ({ id: t.id, code: t.code })), preds);
    const third = standings[2];
    if (!third) { allComplete = false; continue; }
    rows.push({
      group: letter,
      team_code: third.team_code,
      played: third.played,
      points: third.points,
      goal_difference: third.goal_difference,
      goals_for: third.goals_for,
      fifa_ranking: getTeamByCode(third.team_code)?.fifa_ranking,
    });
  }

  if (!allComplete || rows.length !== 12) {
    return { matchups: buildR32Matchups(UNRESOLVED_THIRDS), qualifiedGroups: [], thirdsReady: false, isOfficial: false };
  }

  const ranking = rankBestThirds(rows);
  const { assignment, isOfficial } = getThirdsAssignment(ranking.qualifiedGroups);
  if (!assignment) {
    return { matchups: buildR32Matchups(UNRESOLVED_THIRDS), qualifiedGroups: ranking.qualifiedGroups, thirdsReady: false, isOfficial: false };
  }
  return {
    matchups: buildR32Matchups(assignment),
    qualifiedGroups: ranking.qualifiedGroups,
    thirdsReady: true,
    isOfficial,
  };
}
