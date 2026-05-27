// ============================================================================
// /api/admin/extend-deadline
//
// Admin-only override of the global betting lock deadline. Writes a row into
// `tournaments` (column `lock_deadline_override`) that the save RPC and the
// client clock-check consult before falling back to LOCK_DEADLINE constant.
// Useful when the lock fires too early due to a clock/timezone bug.
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";
import { logAdminAction } from "@/lib/audit";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

export async function GET() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const { data } = await supabase
    .from("tournaments")
    .select("id, lock_deadline_override")
    .eq("is_current", true)
    .maybeSingle();
  return NextResponse.json({ override: data?.lock_deadline_override ?? null });
}

export async function POST(req: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const body = await req.json().catch(() => null) as { deadline?: string | null } | null;
  const newDeadline = body?.deadline ?? null;
  if (newDeadline !== null && Number.isNaN(Date.parse(newDeadline))) {
    return NextResponse.json({ error: "deadline must be ISO-8601 or null" }, { status: 400 });
  }

  const { data: tour } = await supabase
    .from("tournaments")
    .select("id")
    .eq("is_current", true)
    .maybeSingle();
  if (!tour?.id) return NextResponse.json({ error: "No active tournament" }, { status: 500 });

  const { error } = await supabase
    .from("tournaments")
    .update({ lock_deadline_override: newDeadline })
    .eq("id", tour.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(adminEmail, "extend_deadline", { deadline: newDeadline });
  return NextResponse.json({ ok: true, deadline: newDeadline });
}
