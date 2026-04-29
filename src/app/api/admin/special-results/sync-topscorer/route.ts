import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../../verify-admin";
import { getTopScorers } from "@/lib/api-football-data";
import { logAdminAction } from "@/lib/audit";

/**
 * POST /api/admin/special-results/sync-topscorer
 * Pulls top scorer from Football-Data.org and writes to tournament_actuals.
 */
export async function POST() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  let scorers;
  try {
    scorers = await getTopScorers(5);
  } catch (e) {
    return NextResponse.json({ error: `Football-Data API error: ${String(e)}` }, { status: 502 });
  }

  if (!scorers || scorers.length === 0) {
    return NextResponse.json({ success: false, error: "No scorers found" }, { status: 404 });
  }

  const top = scorers[0];
  const playerName = top.player?.name ?? "";
  const teamTla = top.team?.tla ?? "";

  const supabase = createClient(url, serviceKey);

  // Find current tournament
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id")
    .eq("is_current", true)
    .limit(1)
    .maybeSingle();

  if (!tournament?.id) {
    return NextResponse.json({ error: "No active tournament" }, { status: 404 });
  }

  const { error } = await supabase
    .from("tournament_actuals")
    .upsert({
      tournament_id: tournament.id,
      top_scorer_player: playerName,
      top_scorer_team: teamTla,
      top_scorer_goals: top.goals ?? null,
      entered_by: adminEmail,
      updated_at: new Date().toISOString(),
    }, { onConflict: "tournament_id" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction(adminEmail, "sync_topscorer_from_api", { player: playerName, team: teamTla, goals: top.goals });

  return NextResponse.json({
    success: true,
    topScorer: { player: playerName, team: teamTla, goals: top.goals },
  });
}
