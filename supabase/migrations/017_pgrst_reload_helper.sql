-- ============================================================================
-- WC2026 — Schema-cache reload helper RPC
--
-- PostgREST caches the DB schema. New migrations don't always trigger an
-- auto-reload, which surfaces as "Could not find the table ... in the schema
-- cache" errors until the cache TTL expires (~5-10 min).
--
-- This tiny RPC lets the admin panel trigger the reload with one button
-- click instead of opening the SQL editor each time.
-- ============================================================================

CREATE OR REPLACE FUNCTION pgrst_reload()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  NOTIFY pgrst, 'reload schema';
$$;

GRANT EXECUTE ON FUNCTION pgrst_reload TO service_role;
