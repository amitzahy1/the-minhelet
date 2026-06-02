-- ============================================================================
-- WC2026 — Round-of-16 advancement picks
--
-- Adds advance_to_r16 (the 16 teams a bettor advances to the round of 16). It is
-- an editable pick like advance_to_qf / _sf / _final — auto-filled from the
-- simulation tree's R32 winners but overridable on the special-bets page — and is
-- scored at 2 pts per team that actually reaches the last 16.
--
-- Backward compatible: the column defaults to '{}', and the save RPC is recreated
-- to persist it. Apply this BEFORE (or together with) the deploy that reads it.
-- ============================================================================

ALTER TABLE advancement_picks
  ADD COLUMN IF NOT EXISTS advance_to_r16 TEXT[] NOT NULL DEFAULT '{}';

-- Recreate the atomic save RPC so it also writes advance_to_r16. Identical to
-- migration 010 except for the advancement_picks INSERT (one extra column).
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

  -- 1. user_brackets
  IF p_brackets IS NOT NULL THEN
    INSERT INTO user_brackets (
      user_id, league_id, group_predictions, knockout_tree,
      third_place_qualifiers, champion, updated_at
    )
    VALUES (
      p_user_id,
      p_league_id,
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

  -- 2. special_bets
  IF p_special IS NOT NULL THEN
    INSERT INTO special_bets (
      user_id, league_id,
      top_scorer_player, top_assists_player,
      best_attack_team, most_prolific_group, driest_group,
      dirtiest_team, matchup_pick, penalties_over_under
    )
    VALUES (
      p_user_id,
      p_league_id,
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

  -- 3. advancement_picks (now incl. advance_to_r16)
  IF p_advancement IS NOT NULL THEN
    INSERT INTO advancement_picks (
      user_id, league_id, group_qualifiers,
      advance_to_r16, advance_to_qf, advance_to_sf, advance_to_final, winner
    )
    VALUES (
      p_user_id,
      p_league_id,
      COALESCE(p_advancement->'group_qualifiers', '{}'::JSONB),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_advancement->'advance_to_r16', '[]'::JSONB))),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_advancement->'advance_to_qf', '[]'::JSONB))),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_advancement->'advance_to_sf', '[]'::JSONB))),
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_advancement->'advance_to_final', '[]'::JSONB))),
      p_advancement->>'winner'
    )
    ON CONFLICT (user_id, league_id) DO UPDATE SET
      group_qualifiers = EXCLUDED.group_qualifiers,
      advance_to_r16 = EXCLUDED.advance_to_r16,
      advance_to_qf = EXCLUDED.advance_to_qf,
      advance_to_sf = EXCLUDED.advance_to_sf,
      advance_to_final = EXCLUDED.advance_to_final,
      winner = EXCLUDED.winner;
  END IF;

  RETURN jsonb_build_object('ok', true, 'saved_at', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION save_user_predictions TO authenticated;
