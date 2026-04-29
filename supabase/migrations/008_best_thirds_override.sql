-- ============================================================================
-- WC2026 Platform — Best Third-Place Teams Override
-- ============================================================================
--
-- Admin-only override for the 8 best 3rd-placed teams that advance to R32.
-- Normally computed live from match results (FIFA tiebreakers across the 12
-- third-placed teams). Admin may set this column to freeze a specific set of
-- 8 group letters if the computed result diverges from the official one.
--
-- NULL  = use computed ranking (default).
-- Array = exactly 8 single-letter group codes (A..L) whose 3rd-placed teams
--         qualify; ordering within the array is not meaningful.
-- ============================================================================

ALTER TABLE tournament_actuals
  ADD COLUMN IF NOT EXISTS best_thirds_override CHAR(1)[];

-- Enforce the 8-group invariant at the DB layer so we can't half-save an
-- override. NULL is always allowed (means "no override").
ALTER TABLE tournament_actuals
  DROP CONSTRAINT IF EXISTS best_thirds_override_length;

ALTER TABLE tournament_actuals
  ADD CONSTRAINT best_thirds_override_length
  CHECK (
    best_thirds_override IS NULL
    OR array_length(best_thirds_override, 1) = 8
  );
