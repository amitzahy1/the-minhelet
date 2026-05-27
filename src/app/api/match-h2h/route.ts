// ============================================================================
// /api/match-h2h?id=<matchId>
//
// Proxies Football-Data.org's /matches/{id}/head2head endpoint. Returns the
// last ~10 meetings between the two teams + an aggregate (wins/draws/losses)
// so the UI can show a "5 last meetings" card on expanded matches.
// Cached upstream by FD; we set a short revalidate on top.
// ============================================================================

import { NextResponse } from "next/server";

interface FdH2HMatch {
  id: number;
  utcDate: string;
  competition: { name: string };
  homeTeam: { tla: string; name: string };
  awayTeam: { tla: string; name: string };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime: { home: number | null; away: number | null };
  };
}
interface FdH2HResponse {
  aggregates?: {
    numberOfMatches: number;
    homeTeam?: { id: number; name: string; wins: number; draws: number; losses: number };
    awayTeam?: { id: number; name: string; wins: number; draws: number; losses: number };
  };
  matches?: FdH2HMatch[];
}

export async function GET(req: Request) {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) return NextResponse.json({ matches: [], error: "No FOOTBALL_DATA_TOKEN" }, { status: 500 });

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id query param required" }, { status: 400 });

  try {
    const r = await fetch(
      `https://api.football-data.org/v4/matches/${id}/head2head?limit=10`,
      { headers: { "X-Auth-Token": token }, next: { revalidate: 600 } },
    );
    if (!r.ok) return NextResponse.json({ matches: [], error: `HTTP ${r.status}` }, { status: 500 });
    const data = (await r.json()) as FdH2HResponse;
    const matches = (data.matches || []).map((m) => ({
      id: m.id,
      date: m.utcDate,
      competition: m.competition?.name || "",
      homeTla: m.homeTeam?.tla || "",
      awayTla: m.awayTeam?.tla || "",
      homeGoals: m.score?.fullTime?.home ?? null,
      awayGoals: m.score?.fullTime?.away ?? null,
      winner: m.score?.winner ?? null,
    }));
    const agg = data.aggregates;
    return NextResponse.json({
      total: agg?.numberOfMatches ?? matches.length,
      home: agg?.homeTeam ? { tla: matches[0]?.homeTla, wins: agg.homeTeam.wins, draws: agg.homeTeam.draws, losses: agg.homeTeam.losses } : null,
      away: agg?.awayTeam ? { tla: matches[0]?.awayTla, wins: agg.awayTeam.wins, draws: agg.awayTeam.draws, losses: agg.awayTeam.losses } : null,
      matches,
    });
  } catch (e) {
    return NextResponse.json({ matches: [], error: String(e) }, { status: 500 });
  }
}
