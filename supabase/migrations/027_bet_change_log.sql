-- ============================================================================
-- WC2026 — Bet change log (who changed what, when)
--
-- Captures every LIVE bet edit (group-stage scores + knockout Tree-2 slots) with
-- the old value, the new value, the user, and the timestamp. Logging happens
-- INSIDE the save RPCs (which are SECURITY DEFINER), so it can't be bypassed by
-- the client and writes to an otherwise-locked-down table. Admin edits are
-- already captured in admin_audit_log; this covers users editing their own bets.
--
-- Motivation: a user's browser once showed a score (QAT 0-2 SUI) that never
-- reached the DB (a live save hit the day-lock and the optimistic local value
-- stuck). With no edit history we couldn't see what happened. From now on every
-- attempt that actually changes a stored value leaves a row here.
--
-- This migration is self-contained and re-runnable. Apply it once (Supabase
-- dashboard → SQL editor, or `supabase db push`).
-- ============================================================================

CREATE TABLE IF NOT EXISTS bet_change_log (
  id           BIGSERIAL PRIMARY KEY,
  user_id      UUID NOT NULL,
  league_id    UUID,
  change_type  TEXT NOT NULL,            -- 'group_score' | 'knockout'
  match_key    TEXT NOT NULL,            -- group: "B:5"; knockout: slot key
  old_value    JSONB,
  new_value    JSONB,
  source       TEXT NOT NULL DEFAULT 'user',
  changed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bet_change_log_user_idx ON bet_change_log (user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS bet_change_log_match_idx ON bet_change_log (match_key, changed_at DESC);

-- Lock it down: only the service role (admin API) reads it; the SECURITY DEFINER
-- functions below write to it as the owner regardless of RLS.
ALTER TABLE bet_change_log ENABLE ROW LEVEL SECURITY;
-- (no policies → no anon/authenticated access; service role bypasses RLS)

-- ── Group-stage score save — same as 024, now with change logging ───────────
CREATE OR REPLACE FUNCTION save_live_group_score(
  p_user_id    UUID,
  p_league_id  UUID,
  p_group      TEXT,
  p_pair_idx   INT,
  p_score      JSONB,
  p_lock_at    TIMESTAMPTZ   -- IGNORED (kept for caller compatibility)
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now   TIMESTAMPTZ := NOW();
  v_lock  TIMESTAMPTZ;
  v_clean JSONB;
  v_old   JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN: caller does not match user_id' USING ERRCODE = '42501';
  END IF;

  IF p_group NOT IN ('A','B','C','D','E','F','G','H','I','J','K','L') THEN
    RAISE EXCEPTION 'BAD_GROUP: %', p_group USING ERRCODE = '22023';
  END IF;
  IF p_pair_idx < 0 OR p_pair_idx > 5 THEN
    RAISE EXCEPTION 'BAD_PAIR: %', p_pair_idx USING ERRCODE = '22023';
  END IF;

  SELECT lock_at INTO v_lock FROM prediction_locks
    WHERE scope = 'group' AND lock_key = p_group || ':' || p_pair_idx;
  IF v_lock IS NULL OR v_now > v_lock THEN
    RAISE EXCEPTION 'LOCKED: match-day prediction window is closed' USING ERRCODE = 'P0001';
  END IF;

  IF p_score IS NULL OR jsonb_typeof(p_score) <> 'object' THEN
    RAISE EXCEPTION 'BAD_SCORE: not an object' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(p_score->'home') NOT IN ('number','null')
     OR jsonb_typeof(p_score->'away') NOT IN ('number','null') THEN
    RAISE EXCEPTION 'BAD_SCORE: home/away must be number or null' USING ERRCODE = '22023';
  END IF;
  v_clean := jsonb_build_object('home', p_score->'home', 'away', p_score->'away');

  -- Capture the old value before overwriting (for the change log).
  SELECT group_predictions -> p_group -> 'scores' -> p_pair_idx
    INTO v_old
    FROM user_brackets
    WHERE user_id = p_user_id AND league_id = p_league_id;

  UPDATE user_brackets
  SET group_predictions =
        jsonb_set(group_predictions, ARRAY[p_group, 'scores', p_pair_idx::text], v_clean, true),
      updated_at = v_now
  WHERE user_id = p_user_id
    AND league_id = p_league_id
    AND jsonb_typeof(group_predictions -> p_group -> 'scores') = 'array'
    AND jsonb_array_length(group_predictions -> p_group -> 'scores') > p_pair_idx;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_BRACKET: no frozen group prediction to update' USING ERRCODE = 'P0002';
  END IF;

  -- Log only real changes (skip no-op re-saves).
  IF v_old IS DISTINCT FROM v_clean THEN
    INSERT INTO bet_change_log (user_id, league_id, change_type, match_key, old_value, new_value, source)
    VALUES (p_user_id, p_league_id, 'group_score', p_group || ':' || p_pair_idx, v_old, v_clean, 'user');
  END IF;

  RETURN jsonb_build_object('ok', true, 'group', p_group, 'pair', p_pair_idx, 'saved_at', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION save_live_group_score TO authenticated;

-- ── Knockout (Tree 2) slot save — same as 024, now with change logging ──────
CREATE OR REPLACE FUNCTION save_live_knockout(
  p_user_id    UUID,
  p_league_id  UUID,
  p_slot_key   TEXT,
  p_slot       JSONB,
  p_lock_at    TIMESTAMPTZ   -- IGNORED (kept for caller compatibility)
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now  TIMESTAMPTZ := NOW();
  v_lock TIMESTAMPTZ;
  v_old  JSONB;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'FORBIDDEN: caller does not match user_id' USING ERRCODE = '42501';
  END IF;

  IF p_slot_key NOT IN (
    'r32l_0','r32l_1','r32l_2','r32l_3','r32l_4','r32l_5','r32l_6','r32l_7',
    'r32r_0','r32r_1','r32r_2','r32r_3','r32r_4','r32r_5','r32r_6','r32r_7',
    'r16l_0','r16l_1','r16l_2','r16l_3','r16r_0','r16r_1','r16r_2','r16r_3',
    'qfl_0','qfl_1','qfr_0','qfr_1','sfl_0','sfr_0','final','third_place'
  ) THEN
    RAISE EXCEPTION 'BAD_SLOT: %', p_slot_key USING ERRCODE = '22023';
  END IF;

  SELECT lock_at INTO v_lock FROM prediction_locks
    WHERE scope = 'ko' AND lock_key = p_slot_key;
  IF v_lock IS NULL OR v_now > v_lock THEN
    RAISE EXCEPTION 'LOCKED: match prediction window has closed' USING ERRCODE = 'P0001';
  END IF;

  SELECT knockout_tree_live -> p_slot_key
    INTO v_old
    FROM user_brackets
    WHERE user_id = p_user_id AND league_id = p_league_id;

  INSERT INTO user_brackets (user_id, league_id, knockout_tree_live, updated_at)
  VALUES (p_user_id, p_league_id, jsonb_build_object(p_slot_key, p_slot), v_now)
  ON CONFLICT (user_id, league_id) DO UPDATE SET
    knockout_tree_live =
      COALESCE(user_brackets.knockout_tree_live, '{}'::jsonb) || jsonb_build_object(p_slot_key, p_slot),
    updated_at = v_now;

  IF v_old IS DISTINCT FROM p_slot THEN
    INSERT INTO bet_change_log (user_id, league_id, change_type, match_key, old_value, new_value, source)
    VALUES (p_user_id, p_league_id, 'knockout', p_slot_key, v_old, p_slot, 'user');
  END IF;

  RETURN jsonb_build_object('ok', true, 'slot', p_slot_key, 'saved_at', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION save_live_knockout TO authenticated;
