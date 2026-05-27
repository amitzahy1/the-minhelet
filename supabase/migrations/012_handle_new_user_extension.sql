-- ============================================================================
-- WC2026 — Ensure user_brackets / special_bets / advancement_picks rows
--          exist immediately on signup
--
-- Before: the rows were created only on first save, which meant a user who
-- signed up and left had no DB row for the standings & scoring loaders to
-- find. Now the auth trigger seeds empty rows for the default league so
-- `hydrateFromSupabase` always lands on a target row.
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user_extended()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_league_id UUID;
BEGIN
  -- profiles row is inserted by an earlier trigger (handle_new_user); only
  -- the prediction tables need seeding here.
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
  VALUES (NEW.id, v_league_id, '{}'::JSONB, '{}', '{}', '{}', NULL)
  ON CONFLICT (user_id, league_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_extended ON auth.users;
CREATE TRIGGER on_auth_user_created_extended
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_extended();
