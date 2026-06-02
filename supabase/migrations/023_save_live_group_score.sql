-- ============================================================================
-- WC2026 — Live group-stage score edits  ⟶  SUPERSEDED BY MIGRATION 024
--
-- This migration ORIGINALLY created save_live_group_score with a CLIENT-SUPPLIED
-- lock time (p_lock_at). That design was replaced by the server-authoritative
-- version in 024_prediction_locks.sql, which reads the lock from the
-- `prediction_locks` table and fails closed.
--
-- It has been turned into a NO-OP on purpose: both files do
-- `CREATE OR REPLACE FUNCTION save_live_group_score(... same signature ...)`,
-- so if this ever ran AFTER 024 it would silently revert the function to the
-- old, unsafe body. Emptying it removes that footgun. 024 is self-contained
-- (it creates the function from scratch), so nothing depends on this file.
--
-- Do NOT re-add a function definition here — put any future change in a new,
-- higher-numbered migration so ordering can never undo 024.
-- ============================================================================

-- intentionally a no-op
SELECT 1;
