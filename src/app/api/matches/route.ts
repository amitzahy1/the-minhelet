import { NextResponse } from "next/server";

const BASE_URL = "https://api.football-data.org/v4";

export async function GET() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return NextResponse.json({ matches: [], error: "No API token" });
  }

  try {
    const res = await fetch(`${BASE_URL}/competitions/WC/matches?season=2026`, {
      headers: { "X-Auth-Token": token },
      next: { revalidate: 3600 }, // Cache 1 hour
    });

    if (!res.ok) {
      return NextResponse.json({ matches: [], error: `API error: ${res.status}` });
    }

    const data = await res.json();
    const matches = (data.matches || []).map((m: { id: number; utcDate: string; homeTeam?: { shortName?: string; name?: string; tla?: string }; awayTeam?: { shortName?: string; name?: string; tla?: string }; group?: string; stage?: string; status?: string; score?: { fullTime?: { home?: number; away?: number } } }) => ({
      id: m.id,
      date: m.utcDate,
      homeTeam: m.homeTeam?.shortName || m.homeTeam?.name || "TBD",
      awayTeam: m.awayTeam?.shortName || m.awayTeam?.name || "TBD",
      homeTla: m.homeTeam?.tla || "TBD",
      awayTla: m.awayTeam?.tla || "TBD",
      group: m.group,
      stage: m.stage,
      status: m.status,
      homeGoals: m.score?.fullTime?.home,
      awayGoals: m.score?.fullTime?.away,
    }));

    return NextResponse.json({ matches });
  } catch (error) {
    return NextResponse.json({ matches: [], error: String(error) });
  }
}
