import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../../verify-admin";
import { getFinishedMatches } from "@/lib/api-football-data";
import { logAdminAction } from "@/lib/audit";
import { normalizeGroupLetter } from "@/lib/results-hits";

/**
 * POST /api/admin/results/sync-from-api
 * Pulls all FINISHED matches from Football-Data.org and upserts into demo_match_results.
 * Returns count of newly synced matches.
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

  if (!matches || matches.length === 0) {
    return NextResponse.json({ success: true, synced: 0, message: "No finished matches found" });
  }

  const rows = matches.map((m) => ({
    match_id: String(m.id),
    stage: m.stage || "GROUP_STAGE",
    group_id: normalizeGroupLetter(m.group) || null,
    home_team: m.homeTeam?.tla || "",
    away_team: m.awayTeam?.tla || "",
    home_goals: m.score?.fullTime?.home ?? null,
    away_goals: m.score?.fullTime?.away ?? null,
    home_penalties: null,
    away_penalties: null,
    status: "FINISHED",
    scheduled_at: m.utcDate ?? null,
    entered_by: adminEmail,
    updated_at: new Date().toISOString(),
  }));

  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase
    .from("demo_match_results")
    .upsert(rows, { onConflict: "match_id" })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const synced = data?.length ?? 0;
  await logAdminAction(adminEmail, "sync_results_from_api", { synced, total: matches.length });

  return NextResponse.json({ success: true, synced, total: matches.length });
}
