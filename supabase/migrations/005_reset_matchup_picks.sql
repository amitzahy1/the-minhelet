-- ============================================================================
-- WC2026 Platform — Reset matchup picks after changing the 3 matchups
-- ============================================================================
--
-- The 3 player duels used for `special_bets.matchup_pick` were replaced:
--   OLD: [Mbappé vs Vinícius, Bellingham vs Yamal, Messi vs Ronaldo]
--   NEW: [Messi vs Ronaldo, Raphinha vs Vinícius, Mbappé vs Harry Kane]
--
-- Because the storage format is position-based ("1,X,2"), the same slot now
-- refers to a different duel. Existing picks are nonsensical under the new
-- matchups, so clear them — users (or the admin via the override panel) will
-- re-enter. A row in admin_audit_log captures the reset.
-- ============================================================================

-- Snapshot who had picks before the reset (for audit / recovery if needed)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT user_id, matchup_pick
    FROM special_bets
    WHERE matchup_pick IS NOT NULL AND trim(matchup_pick) <> ''
  LOOP
    INSERT INTO admin_audit_log (
      admin_email, target_user_id, table_name, field_name, old_value, new_value, note
    ) VALUES (
      'system@migration-005',
      r.user_id,
      'special_bets',
      'matchup_pick',
      to_jsonb(r.matchup_pick),
      to_jsonb(NULL::text),
      'Reset on 2026-04-19: matchups redefined (Messi/Ronaldo, Raphinha/Vinicius, Mbappé/Kane)'
    );
  END LOOP;
END $$;

-- Clear all matchup picks so they can be re-filled against the new duels.
UPDATE special_bets SET matchup_pick = NULL
WHERE matchup_pick IS NOT NULL;
