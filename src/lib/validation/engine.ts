// ============================================================================
// WC2026 — Validation Engine
// Detects conflicts between group predictions and knockout bracket
// Two types: Mathematical (group stage) + Logical Path (knockout)
// ============================================================================

import { calculateStandings } from "@/lib/tournament/standings";
import { GROUPS } from "@/lib/tournament/groups";
import type { GroupMatchPrediction, GroupStandingEntry, ValidationResult } from "@/types";
import type { BettingState, GroupMatchScore } from "@/stores/betting-store";

// ============================================================================
// GROUP STAGE VALIDATION
// Checks if entered match scores produce a standings order that's consistent
// ============================================================================

interface GroupValidationResult {
  groupId: string;
  isValid: boolean;
  calculatedOrder: string[]; // team codes in calculated order
  predictedOrder: string[];  // team codes in user's predicted order
  conflicts: string[];       // human-readable conflict descriptions
}

/**
 * Generate round-robin matchups for 4 teams (FIFA standard order)
 */
function generateMatchups(codes: string[]): { h: string; a: string }[] {
  const [a, b, c, d] = codes;
  return [
    { h: a, a: b }, { h: c, a: d },
    { h: a, a: c }, { h: d, a: b },
    { h: d, a: a }, { h: b, a: c },
  ];
}

/**
 * Validate a single group: do the entered scores produce the expected order?
 */
export function validateGroup(
  groupId: string,
  order: number[],
  scores: GroupMatchScore[]
): GroupValidationResult {
  const teams = GROUPS[groupId];
  if (!teams) {
    return { groupId, isValid: true, calculatedOrder: [], predictedOrder: [], conflicts: [] };
  }

  const codes = teams.map(t => t.code);
  const matchups = generateMatchups(codes);

  // Check if any scores are entered
  const hasAnyScore = scores.some(s => s.home !== null && s.away !== null);
  if (!hasAnyScore) {
    return { groupId, isValid: true, calculatedOrder: codes, predictedOrder: order.map(i => codes[i]), conflicts: [] };
  }

  // Convert scores to GroupMatchPrediction format
  const predictions: GroupMatchPrediction[] = matchups.map((m, i) => ({
    match_id: i,
    home_team_code: m.h,
    away_team_code: m.a,
    home_goals: scores[i].home ?? 0,
    away_goals: scores[i].away ?? 0,
  }));

  // Calculate standings
  const standings = calculateStandings(
    teams.map(t => ({ id: t.id, code: t.code })),
    predictions
  );

  const calculatedOrder = standings.map(s => s.team_code);
  const predictedOrder = order.map(i => codes[i]);

  // Check if orders match
  const isValid = calculatedOrder.every((code, i) => code === predictedOrder[i]);

  const conflicts: string[] = [];
  if (!isValid) {
    // Find specific conflicts
    for (let i = 0; i < 4; i++) {
      if (calculatedOrder[i] !== predictedOrder[i]) {
        const calcTeam = teams.find(t => t.code === calculatedOrder[i]);
        const predTeam = teams.find(t => t.code === predictedOrder[i]);
        const calcStanding = standings[i];

        conflicts.push(
          `מקום ${i + 1}: חזית ${predTeam?.name_he || predictedOrder[i]}, אבל לפי התוצאות ${calcTeam?.name_he || calculatedOrder[i]} נמצאת שם (${calcStanding.points} נקודות, הפרש ${calcStanding.goal_difference > 0 ? '+' : ''}${calcStanding.goal_difference})`
        );
      }
    }
  }

  return { groupId, isValid, calculatedOrder, predictedOrder, conflicts };
}

/**
 * Validate all 12 groups
 */
export function validateAllGroups(state: BettingState): GroupValidationResult[] {
  return Object.entries(state.groups).map(([groupId, group]) =>
    validateGroup(groupId, group.order, group.scores)
  );
}

// ============================================================================
// KNOCKOUT VALIDATION
// Checks if knockout match predictions are consistent with who advances
// ============================================================================

interface KnockoutValidationResult {
  isValid: boolean;
  conflicts: { matchKey: string; message: string }[];
}

/**
 * Validate knockout bracket — check that winners flow correctly between rounds
 */
export function validateKnockout(state: BettingState): KnockoutValidationResult {
  const conflicts: { matchKey: string; message: string }[] = [];

  // Check R16: each R16 match should have teams that are winners of their R32 feeder matches
  for (let i = 0; i < 4; i++) {
    const r16Key = `r16l_${i}`;
    const r16Match = state.knockout[r16Key];
    if (!r16Match?.winner) continue;

    const feeder1 = state.knockout[`r32l_${i * 2}`];
    const feeder2 = state.knockout[`r32l_${i * 2 + 1}`];

    if (feeder1?.winner && r16Match.score1 !== null && feeder1.winner !== r16Match.winner && feeder2?.winner !== r16Match.winner) {
      conflicts.push({
        matchKey: r16Key,
        message: `המנצחת ב-R16 (${r16Match.winner}) לא תואמת למנצחות ב-R32`,
      });
    }
  }

  // Same for right side
  for (let i = 0; i < 4; i++) {
    const r16Key = `r16r_${i}`;
    const r16Match = state.knockout[r16Key];
    if (!r16Match?.winner) continue;

    const feeder1 = state.knockout[`r32r_${i * 2}`];
    const feeder2 = state.knockout[`r32r_${i * 2 + 1}`];

    if (feeder1?.winner && r16Match.score1 !== null && feeder1.winner !== r16Match.winner && feeder2?.winner !== r16Match.winner) {
      conflicts.push({
        matchKey: r16Key,
        message: `המנצחת ב-R16 (${r16Match.winner}) לא תואמת למנצחות ב-R32`,
      });
    }
  }

  return {
    isValid: conflicts.length === 0,
    conflicts,
  };
}

// ============================================================================
// SPECIAL BETS VALIDATION
// Cross-checks: winner must be in finalists, finalists in SF, etc.
// ============================================================================

interface SpecialBetsValidationResult {
  isValid: boolean;
  warnings: string[];
}

export function validateSpecialBets(state: BettingState): SpecialBetsValidationResult {
  const sb = state.specialBets;
  const warnings: string[] = [];

  // Winner must be in finalists
  if (sb.winner && sb.finalist1 && sb.finalist2) {
    if (sb.winner !== sb.finalist1 && sb.winner !== sb.finalist2) {
      warnings.push("הזוכה חייב להיות אחד מהעולות לגמר");
    }
  }

  // Finalists must be in semifinalists
  if (sb.finalist1 && sb.semifinalists.length > 0) {
    const sfCodes = sb.semifinalists.filter(Boolean);
    if (sfCodes.length > 0 && !sfCodes.includes(sb.finalist1)) {
      warnings.push(`${sb.finalist1} עולה לגמר אבל לא נמצאת בעולות לחצי`);
    }
  }
  if (sb.finalist2 && sb.semifinalists.length > 0) {
    const sfCodes = sb.semifinalists.filter(Boolean);
    if (sfCodes.length > 0 && !sfCodes.includes(sb.finalist2)) {
      warnings.push(`${sb.finalist2} עולה לגמר אבל לא נמצאת בעולות לחצי`);
    }
  }

  // Semifinalists must be in quarterfinalists
  for (const sfTeam of sb.semifinalists.filter(Boolean)) {
    const qfCodes = sb.quarterfinalists.filter(Boolean);
    if (qfCodes.length > 0 && !qfCodes.includes(sfTeam)) {
      warnings.push(`${sfTeam} עולה לחצי אבל לא נמצאת בעולות לרבע`);
    }
  }

  // No duplicate teams in advancement picks
  const allAdvancement = [sb.winner, sb.finalist1, sb.finalist2, ...sb.semifinalists, ...sb.quarterfinalists].filter(Boolean);
  // Duplicates within same tier are checked at the component level

  // Prolific and driest group can't be the same
  if (sb.prolificGroup && sb.driestGroup && sb.prolificGroup === sb.driestGroup) {
    warnings.push("הבית הכי פורה והכי יבש לא יכולים להיות אותו בית");
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

// ============================================================================
// FULL VALIDATION — run all checks
// ============================================================================

export interface FullValidationResult {
  groups: GroupValidationResult[];
  knockout: KnockoutValidationResult;
  specialBets: SpecialBetsValidationResult;
  totalWarnings: number;
  isFullyValid: boolean;
}

export function runFullValidation(state: BettingState): FullValidationResult {
  const groups = validateAllGroups(state);
  const knockout = validateKnockout(state);
  const specialBets = validateSpecialBets(state);

  const groupConflicts = groups.reduce((sum, g) => sum + g.conflicts.length, 0);
  const totalWarnings = groupConflicts + knockout.conflicts.length + specialBets.warnings.length;

  return {
    groups,
    knockout,
    specialBets,
    totalWarnings,
    isFullyValid: totalWarnings === 0,
  };
}
