// ============================================================================
// WC2026 — Scoring Calculator
// Implements the actual scoring rules from Qatar 2022 / Euro 2024
// ============================================================================

import { SCORING, type MatchStage, type ScoreReason, type ScoringValues } from "@/types";

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

/**
 * Score a knockout match by team code (used by the live scorer reading
 * bracket entries). Handles penalty shootouts: when the regulation result is
 * a draw, toto credit requires the user to have correctly named the penalty
 * winner via their slot's `winner` field. Exact-score bonus uses the
 * regulation goals only (penalties don't add to the bag of goals scored).
 *
 * Inputs use team codes (3-letter TLA) for both teams and the penalty winner
 * — matching the `BettorBracket.knockoutTree` shape, where each slot stores
 * `{ score1, score2, winner }` with `winner` denoting the team predicted to
 * advance (= the penalty pick when the predicted scores are level).
 */
export function calculateKnockoutScore(
  stage: MatchStage,
  actual: {
    homeGoals: number;
    awayGoals: number;
    /** Team code that won the shootout, or null when no shootout occurred. */
    penaltyWinner: string | null;
    team1: string;
    team2: string;
  },
  prediction: {
    score1: number | null;
    score2: number | null;
    /** Predicted advancer — implicitly the penalty pick when predicted scores are level. */
    winner: string | null;
  },
  scoring: ScoringValues = SCORING,
): { toto: number; exact: number; total: number; reasons: { reason: ScoreReason; points: number }[] } {
  const reasons: { reason: ScoreReason; points: number }[] = [];
  let toto = 0;
  let exact = 0;

  if (prediction.score1 === null || prediction.score2 === null) {
    return { toto: 0, exact: 0, total: 0, reasons };
  }

  const actualType =
    actual.homeGoals > actual.awayGoals ? "1" : actual.homeGoals < actual.awayGoals ? "2" : "X";
  const predictedType =
    prediction.score1 > prediction.score2 ? "1" : prediction.score1 < prediction.score2 ? "2" : "X";

  // Decisive (non-draw) regulation result: standard toto on result-type match.
  if (actualType !== "X" && predictedType === actualType) {
    toto = scoring.toto[stage];
    reasons.push({ reason: "TOTO", points: toto });
  }
  // Regulation draw on both sides → toto for correctly calling the draw. The
  // shootout winner (who advances) is NOT required: the real-data tree scores
  // the 90' result only (toto + exact, per its own header). Who advances on
  // penalties is the separate, pre-tournament advancement bet — not this page.
  else if (actualType === "X" && predictedType === "X") {
    toto = scoring.toto[stage];
    reasons.push({ reason: "TOTO", points: toto });
  }

  // Exact bonus: regulation goals match exactly.
  if (
    prediction.score1 === actual.homeGoals &&
    prediction.score2 === actual.awayGoals
  ) {
    exact = scoring.exact[stage];
    reasons.push({ reason: "EXACT_SCORE", points: exact });
  }

  return { toto, exact, total: toto + exact, reasons };
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
  prediction: MatchPrediction,
  scoring: ScoringValues = SCORING,
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
    totoPoints = scoring.toto[stage];
    reasons.push({ reason: "TOTO", points: totoPoints });
  }

  // Exact score
  if (
    actual.home_goals === prediction.predicted_home_goals &&
    actual.away_goals === prediction.predicted_away_goals
  ) {
    exactPoints = scoring.exact[stage];
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
  pickType: "group_exact" | "group_partial" | "group_as_3rd" | "qf" | "sf" | "final" | "winner",
  isCorrect: boolean,
  scoring: ScoringValues = SCORING,
): number {
  if (!isCorrect) return 0;
  return scoring.advancement[pickType];
}

/**
 * Calculate group advancement score.
 *
 * Scoring ladder per predicted slot (1st or 2nd):
 *   - Team in correct position       → group_exact     (5)
 *   - Team in the other top-2 slot   → group_partial   (3, "1st↔2nd swap")
 *   - Team finished 3rd *and* is one of the 8 best-3rd qualifiers that
 *     advanced to R32                → group_as_3rd    (2)
 *   - Anything else                  → 0
 *
 * `actualThird` + `thirdQualified` are optional so callers that don't yet
 * know the best-3rds result simply skip the 3rd-place credit.
 */
export function calculateGroupAdvancementScore(
  predictedFirst: string,
  predictedSecond: string,
  actualFirst: string,
  actualSecond: string,
  actualThird?: string | null,
  thirdQualified?: boolean,
  scoring: ScoringValues = SCORING,
): { points: number; reasons: { reason: ScoreReason; points: number }[] } {
  const reasons: { reason: ScoreReason; points: number }[] = [];
  let points = 0;

  const thirdAdvanced = !!actualThird && !!thirdQualified;

  const scoreSlot = (predicted: string) => {
    if (predicted === actualFirst || predicted === actualSecond) {
      const exact =
        (predicted === actualFirst && predicted === predictedFirst) ||
        (predicted === actualSecond && predicted === predictedSecond);
      if (exact) {
        points += scoring.advancement.group_exact;
        reasons.push({ reason: "GROUP_ADVANCE_EXACT", points: scoring.advancement.group_exact });
      } else {
        points += scoring.advancement.group_partial;
        reasons.push({ reason: "GROUP_ADVANCE_PARTIAL", points: scoring.advancement.group_partial });
      }
    } else if (thirdAdvanced && predicted === actualThird) {
      points += scoring.advancement.group_as_3rd;
      reasons.push({ reason: "GROUP_ADVANCE_AS_3RD", points: scoring.advancement.group_as_3rd });
    }
  };

  // Score each predicted slot independently so a bettor who put both
  // predictions on the same team doesn't double-dip: we call scoreSlot for
  // the first pick, then only for the second pick if it's a different team.
  scoreSlot(predictedFirst);
  if (predictedSecond !== predictedFirst) scoreSlot(predictedSecond);

  return { points, reasons };
}

/**
 * Calculate special bet score.
 */
export function calculateSpecialBetScore(
  betType: keyof typeof SCORING.specials,
  isExact: boolean,
  isRelative: boolean = false,
  scoring: ScoringValues = SCORING,
): number {
  if (isExact) return scoring.specials[betType];
  if (isRelative) {
    // Only some bets have relative scoring
    if (betType === "top_scorer_exact" && isRelative)
      return scoring.specials.top_scorer_relative;
    if (betType === "top_assists_exact" && isRelative)
      return scoring.specials.top_assists_relative;
  }
  return 0;
}
