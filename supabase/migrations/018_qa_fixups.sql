-- ============================================================================
-- WC2026 — QA-driven fix-ups discovered during the 2026-05-27 deep audit
--
-- Paste this in the SQL editor once. Idempotent — safe to re-run.
--
-- What it does:
--   1. Re-install the handle_new_user_extended trigger (migration 012 didn't
--      seed bracket rows for the QA probe user — likely never actually fired).
--   2. Re-install save_user_predictions + backfill_locked_at (PostgREST
--      schema cache kept saying they were missing).
--   3. NOTIFY at the end so PostgREST re-indexes everything immediately.
-- ============================================================================

-- ---------- 1. Signup trigger (migration 012, re-applied) ----------
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

  -- advancement_picks.winner is NOT NULL DEFAULT '' — don't pass NULL or the
  -- trigger aborts and the entire user creation fails with a generic
  -- "Database error creating new user".
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

-- ---------- 2. Atomic save (migration 010, re-applied) ----------
CREATE OR REPLACE FUNCTION save_user_predictions(
  p_user_id UUID,
  p_league_id UUID,
  p_brackets JSONB,
  p_special JSONB,
  p_advancement JSONB,
  p_lock_deadline TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  IF v_now > p_lock_deadline THEN
    RAISE EXCEPTION 'LOCKED: betting deadline has passed' USING ERRCODE = 'P0001';
  END IF;
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN: caller does not match user_id' USING ERRCODE = '42501';
  END IF;

  IF p_brackets IS NOT NULL THEN
    INSERT INTO user_brackets (
      user_id, league_id, group_predictions, knockout_tree,
      third_place_qualifiers, champion, updated_at
    )
    VALUES (
      p_user_id, p_league_id,
      COALESCE(p_brackets->'group_predictions', '{}'::JSONB),
      COALESCE(p_brackets->'knockout_tree', '{}'::JSONB),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_brackets->'third_place_qualifiers', '[]'::JSONB)))::CHAR(1)[],
      p_brackets->>'champion',
      v_now
    )
    ON CONFLICT (user_id, league_id) DO UPDATE SET
      group_predictions = EXCLUDED.group_predictions,
      knockout_tree = EXCLUDED.knockout_tree,
      third_place_qualifiers = EXCLUDED.third_place_qualifiers,
      champion = EXCLUDED.champion,
      updated_at = v_now;
  END IF;

  IF p_special IS NOT NULL THEN
    INSERT INTO special_bets (
      user_id, league_id,
      top_scorer_player, top_assists_player,
      best_attack_team, most_prolific_group, driest_group,
      dirtiest_team, matchup_pick, penalties_over_under
    )
    VALUES (
      p_user_id, p_league_id,
      p_special->>'top_scorer_player',
      p_special->>'top_assists_player',
      p_special->>'best_attack_team',
      p_special->>'most_prolific_group',
      p_special->>'driest_group',
      p_special->>'dirtiest_team',
      p_special->>'matchup_pick',
      p_special->>'penalties_over_under'
    )
    ON CONFLICT (user_id, league_id) DO UPDATE SET
      top_scorer_player = EXCLUDED.top_scorer_player,
      top_assists_player = EXCLUDED.top_assists_player,
      best_attack_team = EXCLUDED.best_attack_team,
      most_prolific_group = EXCLUDED.most_prolific_group,
      driest_group = EXCLUDED.driest_group,
      dirtiest_team = EXCLUDED.dirtiest_team,
      matchup_pick = EXCLUDED.matchup_pick,
      penalties_over_under = EXCLUDED.penalties_over_under;
  END IF;

  IF p_advancement IS NOT NULL THEN
    INSERT INTO advancement_picks (
      user_id, league_id, group_qualifiers,
      advance_to_qf, advance_to_sf, advance_to_final, winner
    )
    VALUES (
      p_user_id, p_league_id,
      COALESCE(p_advancement->'group_qualifiers', '{}'::JSONB),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_advancement->'advance_to_qf', '[]'::JSONB))),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_advancement->'advance_to_sf', '[]'::JSONB))),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_advancement->'advance_to_final', '[]'::JSONB))),
      p_advancement->>'winner'
    )
    ON CONFLICT (user_id, league_id) DO UPDATE SET
      group_qualifiers = EXCLUDED.group_qualifiers,
      advance_to_qf = EXCLUDED.advance_to_qf,
      advance_to_sf = EXCLUDED.advance_to_sf,
      advance_to_final = EXCLUDED.advance_to_final,
      winner = EXCLUDED.winner;
  END IF;

  RETURN jsonb_build_object('ok', true, 'saved_at', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION save_user_predictions TO authenticated;

-- ---------- 3. Lock backfill (migration 013, re-applied) ----------
CREATE OR REPLACE FUNCTION backfill_locked_at(p_lock_at TIMESTAMPTZ DEFAULT NOW())
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE user_brackets SET locked_at = p_lock_at WHERE locked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE advancement_picks SET locked_at = p_lock_at WHERE locked_at IS NULL;
  UPDATE special_bets SET locked_at = p_lock_at WHERE locked_at IS NULL;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION backfill_locked_at TO service_role;

-- ---------- 4. Refresh PostgREST so everything is visible immediately ----------
NOTIFY pgrst, 'reload schema';
