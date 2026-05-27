// ============================================================================
// /api/admin/users/reset-password
//
// Admin-only password recovery link generator. Returns a one-shot recovery
// URL the admin can hand to the user (e.g. via Slack/SMS) when they're locked
// out and self-serve recovery isn't available.
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../../verify-admin";
import { logAdminAction } from "@/lib/audit";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const body = await req.json().catch(() => null) as { email?: string; userId?: string } | null;
  let email = body?.email;
  if (!email && body?.userId) {
    const { data: user } = await supabase.auth.admin.getUserById(body.userId);
    email = user?.user?.email ?? undefined;
  }
  if (!email) return NextResponse.json({ error: "email or userId required" }, { status: 400 });

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(adminEmail, "reset_password_link", { email });
  return NextResponse.json({
    ok: true,
    email,
    actionLink: data?.properties?.action_link ?? null,
    note: "Share this URL with the user — it's single-use and expires per Supabase auth settings.",
  });
}
