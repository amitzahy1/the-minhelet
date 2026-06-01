import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fdMatchDetailsBundled from "@/lib/tournament/fd-match-details.json";

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

// Football-Data.org uses a few TLAs that differ from the FIFA codes this app
// keys everything on (flags, squads, market values, group definitions). If
// these aren't normalised here, every downstream consumer fails to match the
// fixture to its team: the betting page can't sort by real kickoff date (so
// matchday headers come out in the wrong order), and names/flags/advancement
// silently fall back to placeholders. Normalise at the API boundary — the one
// place external data enters — so the rest of the app only ever sees app codes.
const FD_TLA_TO_APP: Record<string, string> = {
  CUW: "CUR", // Curaçao (Group E)
  URY: "URU", // Uruguay (Group H)
};
const toAppCode = (tla: string | undefined): string =>
  (tla && FD_TLA_TO_APP[tla]) || tla || "TBD";

interface FdRawMatch {
  id: number;
  utcDate: string;
  homeTeam?: { shortName?: string; name?: string; tla?: string };
  awayTeam?: { shortName?: string; name?: string; tla?: string };
  group?: string;
  stage?: string;
  status?: string;
  score?: {
    fullTime?: { home?: number; away?: number };
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
  homeGoals?: number | null;
  awayGoals?: number | null;
  /** Shootout score, only present when the match was decided on penalties. */
  homePenalties?: number | null;
  awayPenalties?: number | null;
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
      // Football-Data: `score.fullTime` is the end-of-match score INCLUDING
      // extra time but EXCLUDING the shootout. Shootout goals live in
      // `score.penalties` and are propagated separately so downstream code
      // can derive the actual winner without contaminating goal totals.
      homeGoals: demo?.home_goals ?? m.score?.fullTime?.home ?? null,
      awayGoals: demo?.away_goals ?? m.score?.fullTime?.away ?? null,
      homePenalties: demo?.home_penalties ?? m.score?.penalties?.home ?? null,
      awayPenalties: demo?.away_penalties ?? m.score?.penalties?.away ?? null,
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

  const payload: { matches: Match[]; error?: string } = { matches: merged };
  if ("error" in fdResult && fdResult.error) payload.error = fdResult.error;
  return NextResponse.json(payload);
}
