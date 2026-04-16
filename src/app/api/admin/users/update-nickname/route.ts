import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../../verify-admin";

/**
 * Admin endpoint to rename a user (updates both profiles.display_name
 * and auth.users.user_metadata.full_name so the change is reflected
 * in the leaderboard and in the admin users list).
 */
export async function POST(request: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 403 });
  }

  let body: { userId?: unknown; displayName?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";

  if (!userId || !displayName) {
    return NextResponse.json({ ok: false, error: "Missing userId or displayName" }, { status: 400 });
  }
  if (displayName.length > 80) {
    return NextResponse.json({ ok: false, error: "Display name too long" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, error: "Missing Supabase config" }, { status: 500 });
  }

  const supabase = createClient(url, serviceKey);

  // 1) Update profiles.display_name (this is what leaderboards read)
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ display_name: displayName })
    .eq("id", userId);

  if (profileError) {
    return NextResponse.json({ ok: false, error: `profiles: ${profileError.message}` }, { status: 500 });
  }

  // 2) Also update auth.users.user_metadata so the admin users list reflects it
  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { full_name: displayName, name: displayName },
  });
  if (authError) {
    // Non-fatal: profile was updated successfully; auth metadata is secondary.
    return NextResponse.json({ ok: true, warning: `auth metadata: ${authError.message}` });
  }

  return NextResponse.json({ ok: true });
}
