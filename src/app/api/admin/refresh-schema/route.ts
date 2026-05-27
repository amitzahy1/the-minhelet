// ============================================================================
// /api/admin/refresh-schema
//
// One-click equivalent of running `NOTIFY pgrst, 'reload schema';` in the
// SQL editor. PostgREST caches the schema and doesn't always notice a new
// table/column right after a migration. Hitting this endpoint forces a
// reload so the JS client + admin probes can see the new schema.
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";
import { logAdminAction } from "@/lib/audit";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function POST() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  // Issue the NOTIFY via the SQL function we'll register, or fall back to
  // a no-op rpc that we know exists (save_user_predictions). The simplest
  // path that works on every Supabase project: define a small helper RPC.
  const { error } = await supabase.rpc("pgrst_reload");
  if (error) {
    // If the helper isn't installed, return clear instructions.
    if (/function .* does not exist/i.test(error.message)) {
      return NextResponse.json({
        ok: false,
        error: "pgrst_reload() function not installed",
        fix: "Run in SQL editor: CREATE FUNCTION pgrst_reload() RETURNS void LANGUAGE sql AS $$ NOTIFY pgrst, 'reload schema'; $$; or run NOTIFY pgrst, 'reload schema'; manually.",
      }, { status: 500 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAdminAction(adminEmail, "refresh_schema", {});
  return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString() });
}
