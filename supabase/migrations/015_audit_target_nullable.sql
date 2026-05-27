-- ============================================================================
-- WC2026 — Allow null target_user_id on admin_audit_log for system-wide
--          actions (recompute, backup, restore, lock backfill, etc.).
-- ============================================================================

ALTER TABLE admin_audit_log
  ALTER COLUMN target_user_id DROP NOT NULL;
