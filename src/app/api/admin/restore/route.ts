// ============================================================================
// /api/admin/restore
//
// Loads a saved backup snapshot and re-inserts its rows into the live tables.
// Supports `?dry_run=1` (default) — returns counts without writing — and
// `?dry_run=0` to actually apply. Use with EXTREME care; restore overwrites
// existing rows where primary keys collide.
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

/** Admin cookie session OR service-role bearer (for the cron / scripts). */
async function isAuthorized(req: Request): Promise<{ ok: boolean; who: string }> {
  const auth = req.headers.get("authorization") || "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.slice(7);
    if (token && token === process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { ok: true, who: "bearer" };
    }
  }
  const adminEmail = await verifyAdmin();
  if (adminEmail) return { ok: true, who: adminEmail };
  return { ok: false, who: "" };
}

const RESTORE_ORDER = [
  "profiles",
  "tournaments",
  "leagues",
  "league_members",
  "admins",
  "scoring_config",
  "tournament_actuals",
  "demo_match_results",
  "player_stats",
  "user_brackets",
  "special_bets",
  "advancement_picks",
  "scoring_snapshots",
];

export async function POST(req: Request) {
  const auth = await isAuthorized(req);
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const dryRun = url.searchParams.get("dry_run") !== "0";
  if (!key) return NextResponse.json({ error: "key query param required" }, { status: 400 });

  // Fetch backup blob.
  const { data: blob, error: dlError } = await supabase.storage.from("backups").download(key);
  if (dlError || !blob) return NextResponse.json({ error: dlError?.message || "Download failed" }, { status: 500 });
  const text = await blob.text();
  let payload: { tables: Record<string, unknown[]> };
  try {
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Backup file is not valid JSON" }, { status: 500 });
  }

  const summary: Record<string, { count: number; restored?: number; error?: string }> = {};
  for (const table of RESTORE_ORDER) {
    const rows = payload.tables?.[table];
    if (!Array.isArray(rows) || rows.length === 0) {
      summary[table] = { count: 0 };
      continue;
    }
    summary[table] = { count: rows.length };
    if (dryRun) continue;
    const { error, count } = await supabase.from(table).upsert(rows as object[], { count: "exact" });
    if (error) summary[table].error = error.message;
    else summary[table].restored = count ?? rows.length;
  }

  await logAdminAction(auth.who, dryRun ? "restore_dry_run" : "restore_apply", { key, summary });
  return NextResponse.json({ ok: true, key, dryRun, summary });
}
