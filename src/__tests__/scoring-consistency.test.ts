import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SCORING } from "@/types";
import { scoringFromConfig, type ScoringConfigRow } from "@/lib/scoring/config";

// ============================================================================
// FE / BE / DB scoring consistency guard.
//
// Everything that shows or uses a point value resolves through the SAME path:
//   DB row --scoringFromConfig--> ScoringValues --> scorers + every display.
// The DB row is seeded by migration 026. This test pins all three together:
//   1. SCORING constant <-> scoring_config columns is a clean round-trip.
//   2. Migration 026 seeds the row to EXACTLY the SCORING constant.
// If a constant changes without the migration (or vice-versa), this fails —
// so the admin panel, live scoring, and the rules page can never silently drift.
// ============================================================================

// The single canonical column -> value mapping (inverse of scoringFromConfig).
const COLUMN_TO_VALUE: Record<keyof ScoringConfigRow, number> = {
  toto_group: SCORING.toto.GROUP,
  toto_r32: SCORING.toto.R32,
  toto_r16: SCORING.toto.R16,
  toto_qf: SCORING.toto.QF,
  toto_sf: SCORING.toto.SF,
  toto_third: SCORING.toto.THIRD,
  toto_final: SCORING.toto.FINAL,
  exact_group: SCORING.exact.GROUP,
  exact_r32: SCORING.exact.R32,
  exact_r16: SCORING.exact.R16,
  exact_qf: SCORING.exact.QF,
  exact_sf: SCORING.exact.SF,
  exact_third: SCORING.exact.THIRD,
  exact_final: SCORING.exact.FINAL,
  group_advance_exact: SCORING.advancement.group_exact,
  group_advance_partial: SCORING.advancement.group_partial,
  group_advance_as_3rd: SCORING.advancement.group_as_3rd,
  advance_r16: SCORING.advancement.r16,
  advance_qf: SCORING.advancement.qf,
  advance_sf: SCORING.advancement.sf,
  advance_final: SCORING.advancement.final,
  advance_winner: SCORING.advancement.winner,
  top_scorer_exact: SCORING.specials.top_scorer_exact,
  top_scorer_relative: SCORING.specials.top_scorer_relative,
  top_assists_exact: SCORING.specials.top_assists_exact,
  top_assists_relative: SCORING.specials.top_assists_relative,
  best_attack: SCORING.specials.best_attack,
  prolific_group: SCORING.specials.prolific_group,
  driest_group: SCORING.specials.driest_group,
  dirtiest_team: SCORING.specials.dirtiest_team,
  matchup: SCORING.specials.matchup,
  penalties_over_under: SCORING.specials.penalties_over_under,
  top_scorer_min_goals: SCORING.relative_minimums.top_scorer_goals,
  top_assists_min: SCORING.relative_minimums.top_assists,
};

describe("FE/BE/DB scoring consistency", () => {
  it("a config row built from SCORING round-trips through scoringFromConfig unchanged", () => {
    const row = COLUMN_TO_VALUE as unknown as ScoringConfigRow;
    expect(scoringFromConfig(row)).toEqual(SCORING);
  });

  it("migration 026 seeds scoring_config to exactly the SCORING constant", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/026_wire_scoring_config.sql"),
      "utf8",
    );
    // Grab the UPDATE assignments: lines like `  advance_winner = 16,`
    // (tolerate an optional trailing `-- comment`).
    const seeded: Record<string, number> = {};
    for (const m of sql.matchAll(/^\s*([a-z_0-9]+)\s*=\s*(\d+)\s*,?\s*(?:--.*)?$/gim)) {
      seeded[m[1]] = Number(m[2]);
    }
    // Every scoring column the resolver reads must be seeded to the constant.
    for (const [col, expected] of Object.entries(COLUMN_TO_VALUE)) {
      expect(seeded[col], `migration 026 column "${col}"`).toBe(expected);
    }
  });

  it("the DEFAULT for the two added columns matches the constant", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "supabase/migrations/026_wire_scoring_config.sql"),
      "utf8",
    );
    expect(sql).toMatch(/advance_r16 INT NOT NULL DEFAULT 2/);
    expect(sql).toMatch(/group_advance_as_3rd INT NOT NULL DEFAULT 0/);
    expect(SCORING.advancement.r16).toBe(2);
    expect(SCORING.advancement.group_as_3rd).toBe(0);
  });
});
