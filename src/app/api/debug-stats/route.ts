import { NextResponse } from "next/server";
import { getEspnPlayerStats } from "@/lib/api-espn";

// TEMPORARY diagnostic endpoint — returns FD-only and ESPN-only scorer lists
// separately so we can compare the two feeds against the special bets.
// Remove after the comparison.

type FdScorer = {
  player?: { name?: string };
  team?: { tla?: string; name?: string };
  goals?: number;
  assists?: number | null;
  playedMatches?: number;
};

async function fetchFdScorersRaw(limit = 100) {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) return { error: "no token" };
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/WC/scorers?season=2026&limit=${limit}`,
    { headers: { "X-Auth-Token": token }, cache: "no-store" }
  );
  if (!res.ok) return { error: `FD ${res.status}` };
  const data = await res.json();
  const scorers = (data.scorers || []) as FdScorer[];
  return {
    list: scorers.map((s) => ({
      name: s.player?.name || "Unknown",
      team: s.team?.tla || s.team?.name || "",
      goals: s.goals ?? 0,
      assists: s.assists ?? null, // null = FD didn't supply it
      played: s.playedMatches ?? 0,
    })),
  };
}

export async function GET() {
  try {
    const [fd, espn] = await Promise.all([fetchFdScorersRaw(100), getEspnPlayerStats()]);
    return NextResponse.json({ fd, espn });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
