import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";

/**
 * GET /api/admin/bet-log — recent bet changes (admin only).
 * Reads bet_change_log (migration 027) and joins display names. Returns
 * { needsMigration: true } gracefully if the table isn't installed yet.
 */
export async function GET() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const supabase = createClient(url, serviceKey);

  const { data, error } = await supabase
    .from("bet_change_log")
    .select("id, user_id, change_type, match_key, old_value, new_value, source, changed_at")
    .order("changed_at", { ascending: false })
    .limit(300);

  if (error) {
    // 42P01 = undefined_table → migration 027 not applied yet.
    if (/relation .*bet_change_log.* does not exist|42P01/i.test(error.message)) {
      return NextResponse.json({ needsMigration: true, rows: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map user_id → display name (no FK between the log and profiles, so join here).
  const ids = [...new Set((data || []).map((r) => r.user_id))];
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
    for (const p of profs || []) names[p.id] = p.display_name;
  }

  const rows = (data || []).map((r) => ({ ...r, name: names[r.user_id] || r.user_id.slice(0, 8) }));
  return NextResponse.json({ rows });
}
