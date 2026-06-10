import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fdMatchDetailsBundled from "@/lib/tournament/fd-match-details.json";
import { toAppCode, findUnmappedTeams } from "@/lib/fd-team-mapping";

interface FdDetails {
  syncedAt?: string;
  matches?: Record<string, {
    venue?: string | null;
    referees?: { name: string; role: string; nationality: string | null }[];
    stage?: string | null;
    status?: string | null;
  }>;
}
const BUNDLED_DETAILS = fdMatchDetailsBundled as FdDetails;

// Cache the dynamically-fetched details from Supabase Storage for 60s so we
// don't hit Storage on every /api/matches call.
let cachedDynamic: { fetchedAt: number; data: FdDetails | null } = { fetchedAt: 0, data: null };

async function loadDynamicDetails(): Promise<FdDetails | null> {
  const now = Date.now();
  if (cachedDynamic.data && now - cachedDynamic.fetchedAt < 60_000) return cachedDynamic.data;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const sb = createClient(url, anon);
    const { data, error } = await sb.storage.from("backups").download("fd-match-details-latest.json");
    if (error || !data) return null;
    const text = await data.text();
    const parsed = JSON.parse(text) as FdDetails;
    cachedDynamic = { fetchedAt: now, data: parsed };
    return parsed;
  } catch {
    return null;
  }
}

function detailFor(id: string | number, dynamicDetails: FdDetails | null) {
  const key = String(id);
  return dynamicDetails?.matches?.[key] ?? BUNDLED_DETAILS.matches?.[key] ?? null;
}

const BASE_URL = "https://api.football-data.org/v4";

interface FdRawMatch {
  id: number;
  utcDate: string;
  homeTeam?: { shortName?: string; name?: string; tla?: string };
  awayTeam?: { shortName?: string; name?: string; tla?: string };
  group?: string;
  stage?: string;
  status?: string;
  score?: {
    winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    fullTime?: { home?: number; away?: number };
    regularTime?: { home?: number; away?: number };
    extraTime?: { home?: number; away?: number };
    penalties?: { home?: number; away?: number };
    duration?: string;
  };
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
  /** 90-minute score (regulation only). ET & shootout are NOT included here. */
  homeGoals?: number | null;
  awayGoals?: number | null;
  /** Shootout score, only present when the match was decided on penalties. */
  homePenalties?: number | null;
  awayPenalties?: number | null;
  /** True match winner incl. ET + shootout — for KO advancement, not the score bet. */
  winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  /** Stadium + city for the match (populated by sync-fd-extras.ts). */
  venue?: string | null;
  referees?: { name: string; role: string; nationality: string | null }[];
}

interface DemoResult {
  match_id: string;
  home_goals: number | null;
  away_goals: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
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

  // 1. Load our stored results + the dynamically-synced match details in
  //    parallel with the Football-Data fetch.
  const [fdResult, ourResults, dynamicDetails] = await Promise.all([
    token
      ? fetch(`${BASE_URL}/competitions/WC/matches?season=2026`, {
          headers: { "X-Auth-Token": token },
          // 60s: live scores must move during the nightly play window
          // (clients poll every 60s too). FD tier allows 10 req/min — safe.
          next: { revalidate: 60 },
        })
          .then(async (r) => (r.ok ? (await r.json()) : { matches: [], error: `API error: ${r.status}` }))
          .catch((e) => ({ matches: [], error: String(e) }))
      : Promise.resolve({ matches: [], error: "No API token" }),
    supabaseUrl && supabaseAnon
      ? (async () => {
          try {
            const { data } = await createClient(supabaseUrl, supabaseAnon)
              .from("demo_match_results")
              .select("match_id, home_goals, away_goals, home_penalties, away_penalties, home_team, away_team, group_id, stage, status, scheduled_at");
            return (data as DemoResult[]) || [];
          } catch {
            return [] as DemoResult[];
          }
        })()
      : Promise.resolve([] as DemoResult[]),
    loadDynamicDetails(),
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
      homeTla: toAppCode(m.homeTeam?.tla),
      awayTla: toAppCode(m.awayTeam?.tla),
      group: m.group,
      stage: m.stage,
      // Demo data wins — admin-entered scores are authoritative for the demo.
      status: demo?.status ?? m.status,
      // 90-MINUTE score only. football-data's `score.fullTime` AGGREGATES the
      // shootout for penalty matches (verified: fullTime 1–5 vs regularTime 0–1),
      // so we prefer `regularTime` (present once a match passes 90') and fall
      // back to fullTime for group + regulation-decided matches (where they're
      // equal). ET & shootout never enter the scoreline; they decide `winner`.
      homeGoals: demo?.home_goals ?? m.score?.regularTime?.home ?? m.score?.fullTime?.home ?? null,
      awayGoals: demo?.away_goals ?? m.score?.regularTime?.away ?? m.score?.fullTime?.away ?? null,
      homePenalties: demo?.home_penalties ?? m.score?.penalties?.home ?? null,
      awayPenalties: demo?.away_penalties ?? m.score?.penalties?.away ?? null,
      winner: m.score?.winner ?? null,
      venue: detailFor(m.id, dynamicDetails)?.venue ?? null,
      referees: detailFor(m.id, dynamicDetails)?.referees ?? [],
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
      homePenalties: r.home_penalties,
      awayPenalties: r.away_penalties,
    });
  }

  // Loud identity guard: any real (non-TBD) team whose code the app doesn't
  // recognise means a missing TLA alias — the bug that scrambled the matchday
  // order. Surface it in the payload (admin SystemStatus shows it) and log it,
  // instead of silently serving a fixture nobody can match. Re-trips whenever
  // a knockout draw introduces a team with an unmapped TLA.
  const unmappedTeams = findUnmappedTeams(merged);
  if (unmappedTeams.length) {
    console.error(`[/api/matches] Unmapped team codes: ${unmappedTeams.join(", ")} — add to FD_TLA_TO_APP in src/lib/fd-team-mapping.ts`);
  }

  const payload: { matches: Match[]; error?: string; unmappedTeams?: string[] } = { matches: merged };
  if ("error" in fdResult && fdResult.error) payload.error = fdResult.error;
  if (unmappedTeams.length) payload.unmappedTeams = unmappedTeams;
  return NextResponse.json(payload);
}
