-- ============================================================================
-- WC2026 — Admin-controlled override for the betting lock deadline
--
-- Surfaced via /api/admin/extend-deadline. The save RPC (010) consults the
-- override before falling back to LOCK_DEADLINE; null = no override (default).
-- ============================================================================

ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS lock_deadline_override TIMESTAMPTZ;
