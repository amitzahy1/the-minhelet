import { NextResponse } from "next/server";
import { getTournamentStats } from "@/lib/tournament-stats";

/**
 * GET /api/tournament-stats
 * Public endpoint combining Football-Data scorers + computed team/group
 * totals from `demo_match_results` + admin-entered actuals from
 * `tournament_actuals`. Cached for 5 minutes upstream (inside FD fetch).
 */
export async function GET() {
  try {
    const payload = await getTournamentStats();
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
