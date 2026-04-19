-- ============================================================================
-- WC2026 Platform — Drop the matchup_pick CHECK constraint + refresh cache
-- ============================================================================
--
-- The original schema (001) defined matchup_pick as a single-value field
-- with CHECK (matchup_pick IN ('1', 'X', '2')). The app stores the 3
-- matchup picks comma-joined ("1,X,1") in a single column, so the CHECK
-- rejects valid data. Migration 003 was supposed to drop this constraint
-- but if that migration wasn't applied, writes still fail — including
-- the bot's first auto-fill.
--
-- This migration is idempotent: safe to run multiple times.
-- ============================================================================

ALTER TABLE special_bets DROP CONSTRAINT IF EXISTS special_bets_matchup_pick_check;

-- Ensure helper columns exist (also covered by 003 but repeated for safety)
ALTER TABLE special_bets ADD COLUMN IF NOT EXISTS top_scorer_team TEXT;
ALTER TABLE special_bets ADD COLUMN IF NOT EXISTS top_assists_team TEXT;

-- Refresh the PostgREST schema cache so API clients immediately see
-- the schema changes without waiting for the auto-reload interval.
NOTIFY pgrst, 'reload schema';
