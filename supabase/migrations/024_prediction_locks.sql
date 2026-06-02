-- ============================================================================
-- WC2026 — Server-authoritative prediction locks
--
-- Background: save_live_group_score (023) and save_live_knockout (020) enforced
-- the edit window against a `p_lock_at` COMPUTED IN THE BROWSER. Two gaps:
--   1. A crafted request could send a far-future p_lock_at and edit after kickoff.
--   2. If the schedule feed was down the client sent NULL, which the RPCs treated
--      as "no lock" → the write succeeded (an outage silently lifted every lock).
--
-- Fix: a `prediction_locks` table holds the authoritative lock instant per
-- match-day (groups) / per slot (knockout), kept current by the /api/sync-locks
-- cron (which computes it from the schedule via compute-prediction-locks.ts —
-- the SAME logic the UI uses). Both RPCs now READ this table and FAIL CLOSED:
-- a missing/expired lock denies the write. `p_lock_at` is kept in the signatures
-- for caller compatibility but is IGNORED. Nothing depends on the live feed at
-- save time, and the client value is never trusted.
-- ============================================================================

CREATE TABLE IF NOT EXISTS prediction_locks (
  scope       TEXT NOT NULL,            -- 'group' | 'ko'
  lock_key    TEXT NOT NULL,            -- group: "A:0".."L:5"; ko: slot key or "third_place"
  match_id    TEXT,                     -- FD match id, for reference/debug
  kickoff     TIMESTAMPTZ,              -- the match (or match-day first) kickoff
  lock_at     TIMESTAMPTZ NOT NULL,     -- the instant edits close (enforced)
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, lock_key)
);

ALTER TABLE prediction_locks ENABLE ROW LEVEL SECURITY;
-- Writes happen only via the service role (which bypasses RLS) in /api/sync-locks.
-- Allow authenticated reads so the client can display lock times if ever needed.
DROP POLICY IF EXISTS prediction_locks_read ON prediction_locks;
CREATE POLICY prediction_locks_read ON prediction_locks
  FOR SELECT TO authenticated USING (true);
GRANT SELECT ON prediction_locks TO authenticated;

-- ── Group-stage score save — now server-authoritative ───────────────────────
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

  -- Server-authoritative lock. Missing row → FAIL CLOSED (deny), never open.
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

  RETURN jsonb_build_object('ok', true, 'group', p_group, 'pair', p_pair_idx, 'saved_at', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION save_live_group_score TO authenticated;

-- ── Knockout (Tree 2) slot save — now server-authoritative ──────────────────
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

  -- Server-authoritative lock. Missing row (slot not yet resolved/synced) →
  -- FAIL CLOSED. The cron repopulates as results land; the live tree only
  -- offers editing once a slot's teams are known, so this aligns in practice.
  SELECT lock_at INTO v_lock FROM prediction_locks
    WHERE scope = 'ko' AND lock_key = p_slot_key;
  IF v_lock IS NULL OR v_now > v_lock THEN
    RAISE EXCEPTION 'LOCKED: match prediction window has closed' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO user_brackets (user_id, league_id, knockout_tree_live, updated_at)
  VALUES (p_user_id, p_league_id, jsonb_build_object(p_slot_key, p_slot), v_now)
  ON CONFLICT (user_id, league_id) DO UPDATE SET
    knockout_tree_live =
      COALESCE(user_brackets.knockout_tree_live, '{}'::jsonb) || jsonb_build_object(p_slot_key, p_slot),
    updated_at = v_now;

  RETURN jsonb_build_object('ok', true, 'slot', p_slot_key, 'saved_at', v_now);
END;
$$;

GRANT EXECUTE ON FUNCTION save_live_knockout TO authenticated;
