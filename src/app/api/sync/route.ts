import { NextResponse } from "next/server";
import { syncMatchResults } from "@/lib/api-football-data";

/**
 * GET /api/sync — Sync match results from Football-Data.org
 * Can be called manually from admin panel or by a cron job
 */
export async function GET() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return NextResponse.json(
      { success: false, error: "FOOTBALL_DATA_TOKEN not configured. Register at football-data.org" },
      { status: 500 }
    );
  }

  const result = await syncMatchResults();
  return NextResponse.json(result);
}
