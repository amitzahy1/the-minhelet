// ============================================================================
// WC2026 — Scoring Calculator
// Implements the actual scoring rules from Qatar 2022 / Euro 2024
// ============================================================================

import { SCORING, type MatchStage, type ScoreReason } from "@/types";

interface MatchResult {
  home_goals: number;
  away_goals: number;
  home_penalties?: number | null;
  away_penalties?: number | null;
}

interface MatchPrediction {
  predicted_home_goals: number;
  predicted_away_goals: number;
  predicted_penalty_winner_id?: number | null;
}

interface ScoreBreakdown {
  toto: number;
  exact: number;
  total: number;
  reasons: { reason: ScoreReason; points: number }[];
}

/**
 * Get the result type: "1" (home win), "X" (draw), "2" (away win)
 */
function getResultType(homeGoals: number, awayGoals: number): "1" | "X" | "2" {
  if (homeGoals > awayGoals) return "1";
  if (homeGoals < awayGoals) return "2";
  return "X";
}

/**
 * Calculate points for a single match prediction.
 */
export function calculateMatchScore(
  stage: MatchStage,
  actual: MatchResult,
  prediction: MatchPrediction
): ScoreBreakdown {
  const reasons: { reason: ScoreReason; points: number }[] = [];

  // Get result types (1, X, 2) for 90-minute result
  const actualResult = getResultType(actual.home_goals, actual.away_goals);
  const predictedResult = getResultType(
    prediction.predicted_home_goals,
    prediction.predicted_away_goals
  );

  let totoPoints = 0;
  let exactPoints = 0;

  // Toto (correct 1X2)
  if (actualResult === predictedResult) {
    totoPoints = SCORING.toto[stage];
    reasons.push({ reason: "TOTO", points: totoPoints });
  }

  // Exact score
  if (
    actual.home_goals === prediction.predicted_home_goals &&
    actual.away_goals === prediction.predicted_away_goals
  ) {
    exactPoints = SCORING.exact[stage];
    reasons.push({ reason: "EXACT_SCORE", points: exactPoints });
  }

  return {
    toto: totoPoints,
    exact: exactPoints,
    total: totoPoints + exactPoints,
    reasons,
  };
}

/**
 * Calculate advancement pick points for a single team.
 */
export function calculateAdvancementScore(
  pickType: "group_exact" | "group_partial" | "qf" | "sf" | "final" | "winner",
  isCorrect: boolean
): number {
  if (!isCorrect) return 0;
  return SCORING.advancement[pickType];
}

/**
 * Calculate group advancement score.
 * @param predictedFirst - The team code predicted to finish 1st
 * @param predictedSecond - The team code predicted to finish 2nd
 * @param actualFirst - The team that actually finished 1st
 * @param actualSecond - The team that actually finished 2nd
 */
export function calculateGroupAdvancementScore(
  predictedFirst: string,
  predictedSecond: string,
  actualFirst: string,
  actualSecond: string
): { points: number; reasons: { reason: ScoreReason; points: number }[] } {
  const reasons: { reason: ScoreReason; points: number }[] = [];
  let points = 0;

  // Check first place
  if (predictedFirst === actualFirst) {
    points += SCORING.advancement.group_exact;
    reasons.push({ reason: "GROUP_ADVANCE_EXACT", points: SCORING.advancement.group_exact });
  } else if (predictedFirst === actualSecond) {
    points += SCORING.advancement.group_partial;
    reasons.push({ reason: "GROUP_ADVANCE_PARTIAL", points: SCORING.advancement.group_partial });
  }

  // Check second place
  if (predictedSecond === actualSecond) {
    points += SCORING.advancement.group_exact;
    reasons.push({ reason: "GROUP_ADVANCE_EXACT", points: SCORING.advancement.group_exact });
  } else if (predictedSecond === actualFirst) {
    points += SCORING.advancement.group_partial;
    reasons.push({ reason: "GROUP_ADVANCE_PARTIAL", points: SCORING.advancement.group_partial });
  }

  return { points, reasons };
}

/**
 * Calculate special bet score.
 */
export function calculateSpecialBetScore(
  betType: keyof typeof SCORING.specials,
  isExact: boolean,
  isRelative: boolean = false
): number {
  if (isExact) return SCORING.specials[betType];
  if (isRelative) {
    // Only some bets have relative scoring
    if (betType === "top_scorer_exact" && isRelative)
      return SCORING.specials.top_scorer_relative;
    if (betType === "top_assists_exact" && isRelative)
      return SCORING.specials.top_assists_relative;
  }
  return 0;
}
