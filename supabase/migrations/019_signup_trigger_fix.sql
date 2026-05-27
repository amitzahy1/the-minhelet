-- ============================================================================
-- WC2026 — Fix the signup trigger from migration 018
--
-- Migration 018 installed handle_new_user_extended() that tried to INSERT
-- INTO advancement_picks (..., winner) VALUES (..., NULL). The schema
-- defines `winner TEXT NOT NULL DEFAULT ''`. NULL on a NOT NULL column
-- aborts the trigger, which in turn fails the parent auth.users INSERT
-- with a generic "Database error creating new user".
--
-- This migration replaces the function with a version that passes empty
-- string instead of NULL. Idempotent.
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user_extended()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_league_id UUID;
BEGIN
  SELECT id INTO v_league_id FROM leagues ORDER BY created_at ASC LIMIT 1;
  IF v_league_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO user_brackets (user_id, league_id, group_predictions, knockout_tree, champion)
  VALUES (NEW.id, v_league_id, '{}'::JSONB, '{}'::JSONB, NULL)
  ON CONFLICT (user_id, league_id) DO NOTHING;

  INSERT INTO special_bets (user_id, league_id)
  VALUES (NEW.id, v_league_id)
  ON CONFLICT (user_id, league_id) DO NOTHING;

  INSERT INTO advancement_picks (user_id, league_id, group_qualifiers, advance_to_qf, advance_to_sf, advance_to_final, winner)
  VALUES (NEW.id, v_league_id, '{}'::JSONB, '{}', '{}', '{}', '')
  ON CONFLICT (user_id, league_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_extended ON auth.users;
CREATE TRIGGER on_auth_user_created_extended
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_extended();

NOTIFY pgrst, 'reload schema';
