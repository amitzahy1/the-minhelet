-- ============================================================================
-- 026_wire_scoring_config.sql
--
-- Make the `scoring_config` table the runtime source of truth for scoring.
--
-- Until now the admin "ניקוד" tab wrote to `scoring_config`, but NO scorer ever
-- read it — every engine computed from the hardcoded SCORING constant in
-- src/types/index.ts. This migration is step 1 of wiring the table into the
-- live scorers (see src/lib/scoring/config.ts).
--
-- Two things happen here:
--   1. Add the two advancement tiers the table was missing:
--        - advance_r16            (R16 reachers, "עולה לשמינית")     default 1
--        - group_advance_as_3rd   (advanced as a best-3rd, "עולה ממקום שלישי")  default 2
--      The scoring engine has always scored these (SCORING.advancement.r16 /
--      .group_as_3rd); the DB config just never exposed them.
--
--   2. Re-seed the live row to the CURRENT code constants (post-rebalance commit
--      8d7193d). This is critical: once scorers start reading the table, its
--      values become authoritative, so they must match what users see today or
--      live scoring would silently regress to the stale 3/1/4/6/8/12 values.
--      After this, the DB row is an exact snapshot of the constants → flipping
--      DB-driven scoring on is a no-op, and only future admin edits move numbers.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + a value-setting UPDATE.
-- ============================================================================

ALTER TABLE scoring_config
  ADD COLUMN IF NOT EXISTS advance_r16 INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS group_advance_as_3rd INT NOT NULL DEFAULT 2;

-- Re-seed every row to the authoritative current scoring (SCORING in
-- src/types/index.ts). toto_*/exact_* already match the constants but are set
-- explicitly so the row is a complete, deterministic snapshot.
UPDATE scoring_config SET
  -- Match predictions — toto (correct 1X2)
  toto_group  = 2,
  toto_r32    = 3,
  toto_r16    = 3,
  toto_qf     = 3,
  toto_sf     = 3,
  toto_third  = 3,
  toto_final  = 4,

  -- Match predictions — exact-score bonus
  exact_group = 1,
  exact_r32   = 1,
  exact_r16   = 1,
  exact_qf    = 1,
  exact_sf    = 2,
  exact_third = 1,
  exact_final = 2,

  -- Pre-tournament advancement picks
  group_advance_exact   = 5,
  group_advance_partial = 3,
  group_advance_as_3rd  = 2,
  advance_r16           = 1,
  advance_qf            = 3,
  advance_sf            = 6,
  advance_final         = 10,
  advance_winner        = 16,

  -- Special bets
  top_scorer_exact     = 12,
  top_scorer_relative  = 7,
  top_assists_exact    = 9,
  top_assists_relative = 5,
  best_attack          = 8,
  prolific_group       = 6,
  driest_group         = 6,
  dirtiest_team        = 6,
  matchup              = 6,
  penalties_over_under = 6,

  -- Relative minimums
  top_scorer_min_goals = 3,
  top_assists_min      = 2,

  updated_at = NOW();

-- Ask PostgREST to reload its schema cache so the two new columns are
-- immediately selectable/updatable via the API (helper from migration 017).
SELECT pgrst_reload();
