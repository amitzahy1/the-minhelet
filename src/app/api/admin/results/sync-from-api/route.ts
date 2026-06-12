import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../../verify-admin";
import { getFinishedMatches } from "@/lib/api-football-data";
import { buildResultRows } from "@/lib/sync-results";
import { logAdminAction } from "@/lib/audit";

/**
 * POST /api/admin/results/sync-from-api
 * Pulls all FINISHED matches from Football-Data.org and upserts into
 * demo_match_results via the shared buildResultRows mapper (stage/TLA
 * normalization, 90'-score selection, penalties, null-score guard).
 */
export async function POST() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  let matches;
  try {
    matches = await getFinishedMatches();
  } catch (e) {
    return NextResponse.json({ error: `Football-Data API error: ${String(e)}` }, { status: 502 });
  }

  const rows = buildResultRows(matches || [], adminEmail);
  // FD flips a match to FINISHED minutes before the score lands (free tier) —
  // surface that explicitly instead of silently "syncing" nothing.
  const pendingScore = (matches || []).length - rows.length;

  if (rows.length === 0) {
    return NextResponse.json({
      success: true,
      synced: 0,
      total: matches?.length ?? 0,
      message: pendingScore > 0
        ? `${pendingScore} matches are FINISHED but FD hasn't published their score yet — try again in a few minutes`
        : "No finished matches found",
    });
  }

  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase
    .from("demo_match_results")
    .upsert(rows, { onConflict: "match_id" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const synced = data?.length ?? 0;
  await logAdminAction(adminEmail, "sync_results_from_api", { synced, total: matches.length, pendingScore });

  return NextResponse.json({ success: true, synced, total: matches.length, pendingScore });
}
