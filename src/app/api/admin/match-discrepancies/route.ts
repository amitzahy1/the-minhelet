import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";
import { getMatches } from "@/lib/api-football-data";
import { buildResultRows, espnScoreFor, isAdminConfirmed } from "@/lib/sync-results";
import { getEspnResults, getEspnMatchDetail } from "@/lib/api-espn";

/**
 * GET /api/admin/match-discrepancies
 *
 * The admin verification feed. Computes — live, no stored state needed — every
 * FINISHED group-stage match where Football-Data and ESPN disagree on the 90'
 * score (the signal that caught ESP-KSA's phantom 5-0). For each conflict it
 * returns both scores, who scored (ESPN keyEvents) and the card counts, plus
 * what's currently stored and whether a human has already confirmed it — so the
 * admin can lock the true result with one click via POST /api/admin/results.
 */
export async function GET() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  let fdMatches;
  try {
    fdMatches = await getMatches(true);
  } catch (e) {
    return NextResponse.json({ error: `Football-Data API error: ${String(e)}` }, { status: 502 });
  }

  const espnResults = await getEspnResults();
  if (!espnResults) {
    // No ESPN = no cross-check possible. Say so explicitly rather than imply "all clear".
    return NextResponse.json({ ok: true, espnAvailable: false, conflicts: [] });
  }

  const supabase = createClient(url, serviceKey);
  const { data: demoRows } = await supabase
    .from("demo_match_results")
    .select("match_id, entered_by, home_goals, away_goals");
  const storedById = new Map((demoRows || []).map((r) => [r.match_id, r]));

  // FD finished group rows (shared mapper → same stage/TLA/score normalization).
  const finished = fdMatches.filter((m) => m.status === "FINISHED");
  const fdRows = buildResultRows(finished, "football-data-sync").filter((r) => r.stage === "GROUP");

  const raw = fdRows.flatMap((r) => {
    const espn = espnScoreFor(r.home_team, r.away_team, espnResults);
    if (!espn) return [];
    if (espn.home === r.home_goals && espn.away === r.away_goals) return [];
    const stored = storedById.get(r.match_id);
    return [{
      match_id: r.match_id,
      home_team: r.home_team,
      away_team: r.away_team,
      group_id: r.group_id,
      fd: { home: r.home_goals, away: r.away_goals },
      espn: { home: espn.home, away: espn.away },
      stored: stored ? { home: stored.home_goals, away: stored.away_goals, source: stored.entered_by } : null,
      confirmed: isAdminConfirmed(stored?.entered_by),
    }];
  });

  // Enrich each conflict with ESPN scorers + cards (cheap — only the conflicts).
  const conflicts = await Promise.all(
    raw.map(async (c) => ({ ...c, detail: await getEspnMatchDetail(c.home_team, c.away_team).catch(() => null) }))
  );

  return NextResponse.json({
    ok: true,
    espnAvailable: true,
    unconfirmedCount: conflicts.filter((c) => !c.confirmed).length,
    conflicts,
  });
}
