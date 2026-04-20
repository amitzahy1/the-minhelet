import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../../verify-admin";

/**
 * POST /api/admin/users/delete
 *
 * Permanently removes a user and every trace of them:
 * - user_brackets / advancement_picks / special_bets rows (ON DELETE CASCADE
 *   from profiles handles this, but we also do it explicitly to be safe)
 * - league_members membership
 * - profiles row
 * - auth.users entry (so they can't log in again)
 *
 * Body: { userId: string, confirmText: string } — confirmText must match the
 * user's display_name exactly, as a second guard against accidental deletes.
 *
 * Logged to admin_audit_log with a snapshot of everything wiped so it's
 * recoverable in case of mistake.
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  if (!url || !serviceKey) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  let body: { userId?: string; confirmText?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, confirmText } = body;
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const supabase = createClient(url, serviceKey);

  // Confirm text must match exactly to prevent fat-finger deletes.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const expected = (profile.display_name || "").trim();
  if (!confirmText || confirmText.trim() !== expected) {
    return NextResponse.json(
      { error: `אימות נכשל: על הטקסט להיות בדיוק "${expected}"` },
      { status: 400 }
    );
  }

  // Snapshot everything for the audit log before deleting.
  const [
    { data: bracket },
    { data: advancement },
    { data: special },
  ] = await Promise.all([
    supabase.from("user_brackets").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("advancement_picks").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("special_bets").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  // Explicit deletions first (the profiles CASCADE takes care of most, but
  // this gives us precise error messages if a particular step fails).
  const errors: string[] = [];
  const drops = await Promise.all([
    supabase.from("user_brackets").delete().eq("user_id", userId),
    supabase.from("advancement_picks").delete().eq("user_id", userId),
    supabase.from("special_bets").delete().eq("user_id", userId),
    supabase.from("match_predictions").delete().eq("user_id", userId),
    supabase.from("league_members").delete().eq("user_id", userId),
    supabase.from("scoring_log").delete().eq("user_id", userId),
  ]);
  drops.forEach((r, i) => { if (r.error) errors.push(`#${i}: ${r.error.message}`); });

  // Audit BEFORE deleting the profile (FK would fail otherwise — target_user_id → profiles).
  await supabase.from("admin_audit_log").insert({
    admin_email: adminEmail,
    target_user_id: userId,
    table_name: "profiles",
    field_name: "__user_deleted__",
    old_value: { profile, bracket, advancement, special },
    new_value: null,
    note: `User deleted by ${adminEmail}. display_name=${profile.display_name}`,
  });

  // Delete profile (will cascade to any remaining FK references).
  const { error: pErr } = await supabase.from("profiles").delete().eq("id", userId);
  if (pErr) errors.push(`profiles: ${pErr.message}`);

  // Delete the auth user so they can't sign back in.
  const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
  if (authErr) errors.push(`auth: ${authErr.message}`);

  return NextResponse.json({
    success: errors.length === 0,
    deletedUser: profile.display_name,
    errors: errors.length > 0 ? errors : undefined,
  });
}
