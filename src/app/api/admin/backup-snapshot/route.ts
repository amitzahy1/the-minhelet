// ============================================================================
// /api/admin/backup-snapshot
//
// Dumps every persistence-critical table to a single JSON blob and uploads
// it to the `backups` bucket in Supabase Storage (key:
// `backup-YYYY-MM-DD-HHMM.json`). Designed to be triggered by the daily cron
// (vercel.json) and manually before the 5-day / 1-day pre-tournament checkpoints.
//
// Auth: admin email OR a service-role bearer token (the cron uses the latter).
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

const BACKUP_TABLES = [
  "profiles",
  "leagues",
  "league_members",
  "user_brackets",
  "special_bets",
  "advancement_picks",
  "demo_match_results",
  "tournament_actuals",
  "scoring_config",
  "scoring_snapshots",
  "player_stats",
  "admin_audit_log",
  "admins",
  "tournaments",
];

async function isAuthorized(req: Request): Promise<{ ok: boolean; who: string }> {
  // Service-role bearer (cron path).
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (token && token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { ok: true, who: "cron" };
    }
  }
  // Admin cookie session path.
  const adminEmail = await verifyAdmin();
  if (adminEmail) return { ok: true, who: adminEmail };
  return { ok: false, who: "" };
}

export async function POST(req: Request) {
  const auth = await isAuthorized(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const dump: Record<string, unknown[]> = {};
  const errors: { table: string; error: string }[] = [];
  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      errors.push({ table, error: error.message });
      continue;
    }
    dump[table] = data || [];
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const key = `backup-${stamp}.json`;
  const payload = JSON.stringify({
    snapshotAt: new Date().toISOString(),
    triggeredBy: auth.who,
    tables: dump,
    errors,
  });

  const { error: uploadErr } = await supabase.storage
    .from("backups")
    .upload(key, payload, { contentType: "application/json", upsert: true });

  if (uploadErr) {
    // If the bucket doesn't exist yet, fall back to returning the payload to
    // the caller so they can save it locally.
    if (/Bucket not found/i.test(uploadErr.message)) {
      return NextResponse.json({
        ok: false,
        warning: "backups bucket missing — payload returned inline for manual save",
        key,
        payload: JSON.parse(payload),
      });
    }
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  if (auth.who !== "cron") {
    await logAdminAction(auth.who, "backup_snapshot", { key, tableCount: BACKUP_TABLES.length, errors });
  }
  return NextResponse.json({ ok: true, key, snapshotAt: new Date().toISOString(), errors });
}

export async function GET() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const { data, error } = await supabase.storage.from("backups").list("", { limit: 100, sortBy: { column: "created_at", order: "desc" } });
  if (error) return NextResponse.json({ error: error.message, hint: "Create a 'backups' bucket in Supabase Storage" }, { status: 500 });
  return NextResponse.json({ backups: data || [] });
}
