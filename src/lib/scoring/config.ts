// ============================================================================
// WC2026 — Scoring config resolver
//
// Bridges the `scoring_config` DB table (edited in the admin "ניקוד" tab) to the
// `ScoringValues` shape every scorer and display consumes. The `SCORING`
// constant in src/types is the built-in default; a DB row overrides it
// field-by-field. Anything the row is missing (e.g. a column added by a not-yet
// -applied migration) falls back to the constant, so this is always safe to call.
//
// This is the single point where "admin-edited value" becomes "value used to
// score and to render", which is what keeps the admin panel, the live scoring,
// and the rules page from ever disagreeing.
// ============================================================================

import { SCORING, type ScoringValues } from "@/types";

/** Row shape of the `scoring_config` table (see migrations 002 + 026). */
export interface ScoringConfigRow {
  toto_group: number;
  toto_r32: number;
  toto_r16: number;
  toto_qf: number;
  toto_sf: number;
  toto_third: number;
  toto_final: number;

  exact_group: number;
  exact_r32: number;
  exact_r16: number;
  exact_qf: number;
  exact_sf: number;
  exact_third: number;
  exact_final: number;

  group_advance_exact: number;
  group_advance_partial: number;
  group_advance_as_3rd: number;
  advance_r16: number;
  advance_qf: number;
  advance_sf: number;
  advance_final: number;
  advance_winner: number;

  top_scorer_exact: number;
  top_scorer_relative: number;
  top_assists_exact: number;
  top_assists_relative: number;
  best_attack: number;
  prolific_group: number;
  driest_group: number;
  dirtiest_team: number;
  matchup: number;
  penalties_over_under: number;

  top_scorer_min_goals: number;
  top_assists_min: number;
}

/** Use the DB value only when it's a real finite number, else the constant. */
function num(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Resolve a `scoring_config` row into the `ScoringValues` shape, falling back
 * to the `SCORING` constant per-field. Pass `null`/`undefined` (e.g. row not
 * loaded yet, or table empty) to get the constant unchanged.
 */
export function scoringFromConfig(
  row: Partial<ScoringConfigRow> | null | undefined,
): ScoringValues {
  if (!row) return SCORING;
  return {
    toto: {
      GROUP: num(row.toto_group, SCORING.toto.GROUP),
      R32: num(row.toto_r32, SCORING.toto.R32),
      R16: num(row.toto_r16, SCORING.toto.R16),
      QF: num(row.toto_qf, SCORING.toto.QF),
      SF: num(row.toto_sf, SCORING.toto.SF),
      THIRD: num(row.toto_third, SCORING.toto.THIRD),
      FINAL: num(row.toto_final, SCORING.toto.FINAL),
    },
    exact: {
      GROUP: num(row.exact_group, SCORING.exact.GROUP),
      R32: num(row.exact_r32, SCORING.exact.R32),
      R16: num(row.exact_r16, SCORING.exact.R16),
      QF: num(row.exact_qf, SCORING.exact.QF),
      SF: num(row.exact_sf, SCORING.exact.SF),
      THIRD: num(row.exact_third, SCORING.exact.THIRD),
      FINAL: num(row.exact_final, SCORING.exact.FINAL),
    },
    advancement: {
      group_exact: num(row.group_advance_exact, SCORING.advancement.group_exact),
      group_partial: num(row.group_advance_partial, SCORING.advancement.group_partial),
      group_as_3rd: num(row.group_advance_as_3rd, SCORING.advancement.group_as_3rd),
      r16: num(row.advance_r16, SCORING.advancement.r16),
      qf: num(row.advance_qf, SCORING.advancement.qf),
      sf: num(row.advance_sf, SCORING.advancement.sf),
      final: num(row.advance_final, SCORING.advancement.final),
      winner: num(row.advance_winner, SCORING.advancement.winner),
    },
    specials: {
      top_scorer_exact: num(row.top_scorer_exact, SCORING.specials.top_scorer_exact),
      top_scorer_relative: num(row.top_scorer_relative, SCORING.specials.top_scorer_relative),
      top_assists_exact: num(row.top_assists_exact, SCORING.specials.top_assists_exact),
      top_assists_relative: num(row.top_assists_relative, SCORING.specials.top_assists_relative),
      best_attack: num(row.best_attack, SCORING.specials.best_attack),
      prolific_group: num(row.prolific_group, SCORING.specials.prolific_group),
      driest_group: num(row.driest_group, SCORING.specials.driest_group),
      dirtiest_team: num(row.dirtiest_team, SCORING.specials.dirtiest_team),
      matchup: num(row.matchup, SCORING.specials.matchup),
      penalties_over_under: num(row.penalties_over_under, SCORING.specials.penalties_over_under),
    },
    relative_minimums: {
      top_scorer_goals: num(row.top_scorer_min_goals, SCORING.relative_minimums.top_scorer_goals),
      top_assists: num(row.top_assists_min, SCORING.relative_minimums.top_assists),
    },
  };
}

/** Column list for selecting the row from Supabase. */
export const SCORING_CONFIG_COLUMNS =
  "toto_group,toto_r32,toto_r16,toto_qf,toto_sf,toto_third,toto_final," +
  "exact_group,exact_r32,exact_r16,exact_qf,exact_sf,exact_third,exact_final," +
  "group_advance_exact,group_advance_partial,group_advance_as_3rd," +
  "advance_r16,advance_qf,advance_sf,advance_final,advance_winner," +
  "top_scorer_exact,top_scorer_relative,top_assists_exact,top_assists_relative," +
  "best_attack,prolific_group,driest_group,dirtiest_team,matchup,penalties_over_under," +
  "top_scorer_min_goals,top_assists_min";
