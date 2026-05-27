// ============================================================================
// /api/fd-standings — Football-Data.org's computed group tables.
//
// We compute our own standings client-side (group head-to-head + FIFA Annex C
// best-thirds tiebreak), but exposing FD's parallel table lets the UI show
// it as a sanity check next to ours. If they diverge mid-tournament we
// notice fast.
//
// Cached upstream by FD; we set a short revalidate on top.
// ============================================================================

import { NextResponse } from "next/server";

interface FdStandingRow {
  position: number;
  team: { id: number; name: string; tla: string; crest: string };
  playedGames: number;
  form: string;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
}

interface FdStandingsBlock {
  stage: string;
  type: "TOTAL" | "HOME" | "AWAY";
  group: string | null;
  table: FdStandingRow[];
}

export async function GET() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return NextResponse.json({ groups: [], error: "No FOOTBALL_DATA_TOKEN" }, { status: 500 });
  }
  try {
    const res = await fetch(
      "https://api.football-data.org/v4/competitions/WC/standings?season=2026",
      { headers: { "X-Auth-Token": token }, next: { revalidate: 60 } },
    );
    if (!res.ok) return NextResponse.json({ groups: [], error: `HTTP ${res.status}` }, { status: 500 });
    const json = await res.json() as { standings?: FdStandingsBlock[] };
    // Only return TOTAL blocks (HOME/AWAY duplicate per group when populated)
    const groups = (json.standings || [])
      .filter((s) => s.type === "TOTAL")
      .map((s) => ({
        group: s.group, // null pre-tournament; "GROUP_A" once games start
        rows: s.table.map((r) => ({
          position: r.position,
          tla: r.team.tla,
          name: r.team.name,
          crest: r.team.crest,
          played: r.playedGames,
          won: r.won,
          drawn: r.draw,
          lost: r.lost,
          points: r.points,
          gf: r.goalsFor,
          ga: r.goalsAgainst,
          gd: r.goalDifference,
          form: r.form,
        })),
      }));
    return NextResponse.json({
      groups,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ groups: [], error: String(e) }, { status: 500 });
  }
}
