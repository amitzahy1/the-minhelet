import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://api.football-data.org/v4";

interface FdRawMatch {
  id: number;
  utcDate: string;
  homeTeam?: { shortName?: string; name?: string; tla?: string };
  awayTeam?: { shortName?: string; name?: string; tla?: string };
  group?: string;
  stage?: string;
  status?: string;
  score?: { fullTime?: { home?: number; away?: number } };
}

interface Match {
  id: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeTla: string;
  awayTla: string;
  group?: string;
  stage?: string;
  status?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
}

interface DemoResult {
  match_id: string;
  home_goals: number | null;
  away_goals: number | null;
  home_team: string | null;
  away_team: string | null;
  group_id: string | null;
  stage: string | null;
  status: string | null;
  scheduled_at: string | null;
}

/**
 * GET /api/matches — Tournament schedule + live scores.
 * 1. Fetch fixtures from Football-Data.org
 * 2. Overlay with anything we stored manually in demo_match_results
 *    (admin-entered scores, via /api/admin/results, or synced scores
 *    from /api/sync). Anything we have in our DB wins over the API.
 */
export async function GET() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // 1. Load our stored results in parallel with Football-Data
  const [fdResult, ourResults] = await Promise.all([
    token
      ? fetch(`${BASE_URL}/competitions/WC/matches?season=2026`, {
          headers: { "X-Auth-Token": token },
          next: { revalidate: 300 },
        })
          .then(async (r) => (r.ok ? (await r.json()) : { matches: [], error: `API error: ${r.status}` }))
          .catch((e) => ({ matches: [], error: String(e) }))
      : Promise.resolve({ matches: [], error: "No API token" }),
    supabaseUrl && supabaseAnon
      ? (async () => {
          try {
            const { data } = await createClient(supabaseUrl, supabaseAnon)
              .from("demo_match_results")
              .select("match_id, home_goals, away_goals, home_team, away_team, group_id, stage, status, scheduled_at");
            return (data as DemoResult[]) || [];
          } catch {
            return [] as DemoResult[];
          }
        })()
      : Promise.resolve([] as DemoResult[]),
  ]);

  // 2. Index our results by match_id for quick lookup
  const demoById: Record<string, DemoResult> = {};
  for (const r of ourResults) demoById[r.match_id] = r;

  // 3. Map Football-Data matches, overlay our data when present
  const fdMatches: FdRawMatch[] = fdResult.matches || [];
  const seen = new Set<string>();
  const merged: Match[] = [];

  for (const m of fdMatches) {
    const key = String(m.id);
    seen.add(key);
    const demo = demoById[key];
    merged.push({
      id: m.id,
      date: m.utcDate,
      homeTeam: m.homeTeam?.shortName || m.homeTeam?.name || "TBD",
      awayTeam: m.awayTeam?.shortName || m.awayTeam?.name || "TBD",
      homeTla: m.homeTeam?.tla || "TBD",
      awayTla: m.awayTeam?.tla || "TBD",
      group: m.group,
      stage: m.stage,
      // Demo data wins — admin-entered scores are authoritative for the demo.
      status: demo?.status ?? m.status,
      homeGoals: demo?.home_goals ?? m.score?.fullTime?.home ?? null,
      awayGoals: demo?.away_goals ?? m.score?.fullTime?.away ?? null,
    });
  }

  // 4. Include any DB-only rows (manually entered matches that aren't in
  //    Football-Data.org yet — rare, but possible).
  for (const r of ourResults) {
    if (seen.has(r.match_id)) continue;
    // Skip if no team codes — nothing useful to show.
    if (!r.home_team || !r.away_team) continue;
    const idNum = Number(r.match_id);
    merged.push({
      id: Number.isFinite(idNum) ? idNum : 0,
      date: r.scheduled_at || new Date().toISOString(),
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      homeTla: r.home_team,
      awayTla: r.away_team,
      group: r.group_id ? `GROUP_${r.group_id}` : undefined,
      stage: r.stage ?? undefined,
      status: r.status ?? "FINISHED",
      homeGoals: r.home_goals,
      awayGoals: r.away_goals,
    });
  }

  const payload: { matches: Match[]; error?: string } = { matches: merged };
  if ("error" in fdResult && fdResult.error) payload.error = fdResult.error;
  return NextResponse.json(payload);
}
