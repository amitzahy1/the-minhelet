-- ============================================================================
-- WC2026 — Set locked_at on every user_brackets row when the global lock
--          deadline passes.
--
-- Why: the RLS policy "Brackets viewable by league members" requires
-- locked_at IS NOT NULL to expose another user's bracket. Without a write,
-- post-lock reveal silently returns 0 rows.
--
-- The function is idempotent — re-running is safe. Call it from the
-- /api/lock-now admin endpoint or schedule via Supabase cron on 2026-06-10.
-- ============================================================================

CREATE OR REPLACE FUNCTION backfill_locked_at(p_lock_at TIMESTAMPTZ DEFAULT NOW())
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE user_brackets
    SET locked_at = p_lock_at
    WHERE locked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE advancement_picks
    SET locked_at = p_lock_at
    WHERE locked_at IS NULL;

  UPDATE special_bets
    SET locked_at = p_lock_at
    WHERE locked_at IS NULL;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION backfill_locked_at TO service_role;
