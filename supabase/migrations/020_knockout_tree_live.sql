-- ============================================================================
-- WC2026 — Tree 2 ("עץ נתוני אמת" / real-data knockout)
--
-- Background: the pre-tournament bracket ("עץ סימולציה") is a WINNER-ONLY
-- simulation used for advancement/champion picks; its match scores no longer
-- earn points. This migration adds the SECOND tree: per-match predictions
-- (score + winner) of the REAL knockout matchups, which open after the group
-- stage and are scored for knockout match-results (toto/exact).
--
-- Shape mirrors knockout_tree EXACTLY — same slot keys (KO_SLOT_KEYS in
-- knockout-resolver.ts: r32l_0..final, plus optional "third_place"), each
-- { score1, score2, winner } — so the live scorer reads
-- bracket.knockoutTreeLive[slot.key] with no key translation.
--
-- Per-match lock: unlike the single June-10 deadline, each slot locks 1 hour
-- before its real match kicks off (match_prediction_lock_before_minutes,
-- default 60, in league_config). No production data exists yet (tournament
-- not started), so no data migration is required.
-- ============================================================================

ALTER TABLE user_brackets
  ADD COLUMN IF NOT EXISTS knockout_tree_live JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Save a SINGLE Tree-2 slot prediction. Per-slot kickoff lock instead of the
-- global deadline. Merges the one slot into knockout_tree_live so concurrent
-- per-match edits never clobber each other. The caller passes p_lock_at =
-- kickoff − match_prediction_lock_before_minutes (derived client-side from
-- /api/matches via resolveKnockoutTree); the server enforces NOW() <= p_lock_at
-- and caller identity, and whitelists the slot key.
CREATE OR REPLACE FUNCTION save_live_knockout(
  p_user_id    UUID,
  p_league_id  UUID,
  p_slot_key   TEXT,
  p_slot       JSONB,          -- { "score1": int|null, "score2": int|null, "winner": text|null }
  p_lock_at    TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Caller identity check.
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN: caller does not match user_id' USING ERRCODE = '42501';
  END IF;

  -- Per-slot lock: cannot edit within 1h of (or after) the real match.
  IF p_lock_at IS NOT NULL AND v_now > p_lock_at THEN
    RAISE EXCEPTION 'LOCKED: match prediction window has closed' USING ERRCODE = 'P0001';
  END IF;

  -- Whitelist the slot key against the fixed KO key set (+ third_place) so a
  -- bad payload cannot inject arbitrary JSONB keys.
  IF p_slot_key NOT IN (
    'r32l_0','r32l_1','r32l_2','r32l_3','r32l_4','r32l_5','r32l_6','r32l_7',
    'r32r_0','r32r_1','r32r_2','r32r_3','r32r_4','r32r_5','r32r_6','r32r_7',
    'r16l_0','r16l_1','r16l_2','r16l_3','r16r_0','r16r_1','r16r_2','r16r_3',
    'qfl_0','qfl_1','qfr_0','qfr_1','sfl_0','sfr_0','final','third_place'
  ) THEN
    RAISE EXCEPTION 'BAD_SLOT: %', p_slot_key USING ERRCODE = '22023';
  END IF;

  -- Ensure a row exists, then merge only this slot into the JSONB blob.
  INSERT INTO user_brackets (user_id, league_id, knockout_tree_live, updated_at)
  VALUES (p_user_id, p_league_id,
          jsonb_build_object(p_slot_key, p_slot), v_now)
  ON CONFLICT (user_id, league_id) DO UPDATE SET
    knockout_tree_live =
      COALESCE(user_brackets.knockout_tree_live, '{}'::jsonb)
      || jsonb_build_object(p_slot_key, p_slot),
    updated_at = v_now;

  RETURN jsonb_build_object('ok', true, 'slot', p_slot_key, 'saved_at', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION save_live_knockout TO authenticated;
