import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncMatchResults } from "@/lib/api-football-data";

/**
 * GET /api/sync — Sync match results from Football-Data.org
 * Can be called manually from admin panel or by a cron job.
 * Finished matches are upserted to `demo_match_results` so the compare/live
 * pages and the scoring engine can read them.
 */

const STAGE_MAP: Record<string, string> = {
  GROUP_STAGE: "GROUP",
  LAST_16: "R32",
  ROUND_OF_16: "R16",
  QUARTER_FINALS: "QF",
  SEMI_FINALS: "SF",
  THIRD_PLACE: "THIRD",
  FINAL: "FINAL",
};

export async function GET() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return NextResponse.json(
      { success: false, error: "FOOTBALL_DATA_TOKEN not configured. Register at football-data.org" },
      { status: 500 }
    );
  }

  const result = await syncMatchResults();
  if (!result.success || !Array.isArray(result.matches)) {
    return NextResponse.json(result);
  }

  // Persist finished matches to demo_match_results (best-effort).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let persisted = 0;
  if (url && serviceKey) {
    const supabase = createClient(url, serviceKey);
    const rows = result.matches
      .filter((m) => m.status === "FINISHED" && m.homeGoals != null && m.awayGoals != null)
      .map((m) => ({
        match_id: String(m.id),
        stage: STAGE_MAP[m.stage] ?? m.stage,
        group_id: m.group ?? null,
        home_team: m.homeTeam,
        away_team: m.awayTeam,
        home_goals: m.homeGoals,
        away_goals: m.awayGoals,
        status: "FINISHED",
        scheduled_at: m.date,
        entered_by: "football-data-sync",
        updated_at: new Date().toISOString(),
      }));

    if (rows.length > 0) {
      const { data, error } = await supabase
        .from("demo_match_results")
        .upsert(rows, { onConflict: "match_id" })
        .select("match_id");
      if (error) {
        return NextResponse.json({ ...result, persistError: error.message });
      }
      persisted = data?.length ?? 0;
    }
  }

  return NextResponse.json({ ...result, persisted });
}
