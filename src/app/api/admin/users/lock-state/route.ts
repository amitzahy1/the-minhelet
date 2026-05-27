// ============================================================================
// /api/admin/users/lock-state
//
// Admin-only toggle of a specific user's lock state across user_brackets,
// special_bets, and advancement_picks. Useful when a user's row was
// incorrectly locked early (or needs to be unlocked for a one-off fix).
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../../verify-admin";
import { logAdminAction } from "@/lib/audit";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export async function POST(req: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const body = await req.json().catch(() => null) as { userId?: string; lock?: boolean } | null;
  if (!body?.userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const lockedAt = body.lock ? new Date().toISOString() : null;

  const tables = ["user_brackets", "special_bets", "advancement_picks"];
  const errors: { table: string; error: string }[] = [];
  for (const t of tables) {
    const { error } = await supabase
      .from(t)
      .update({ locked_at: lockedAt })
      .eq("user_id", body.userId);
    if (error) errors.push({ table: t, error: error.message });
  }
  if (errors.length === tables.length) {
    return NextResponse.json({ error: "All lock-state updates failed", details: errors }, { status: 500 });
  }

  await logAdminAction(adminEmail, "lock_state_set", { userId: body.userId, lockedAt, errors }, body.userId);
  return NextResponse.json({ ok: true, userId: body.userId, lockedAt, partialErrors: errors });
}
