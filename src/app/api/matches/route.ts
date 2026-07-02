import { NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fdMatchDetailsBundled from "@/lib/tournament/fd-match-details.json";
import { toAppCode, findUnmappedTeams } from "@/lib/fd-team-mapping";
import { buildResultRows, syncCardBoard, reconcileFinishedRows } from "@/lib/sync-results";
import { getEspnResults } from "@/lib/api-espn";
import { ninetyMinuteScore, type MatchResult } from "@/lib/api-football-data";
import { resolveKnockoutTree, type KoSlotKey } from "@/lib/scoring/knockout-resolver";
import { LIVE_FEEDERS } from "@/lib/tournament/knockout-derivation";
import { normalizeTla, normalizeGroupLetter, type FinishedMatch } from "@/lib/results-hits";
import { computePredictionLockRows, type LockSyncMatch } from "@/lib/scoring/compute-prediction-locks";

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
  entered_by: string | null;
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
          // null = READ FAILED (as opposed to []: read succeeded, no rows).
          // The self-heal below must distinguish the two — treating a failed
          // read as "no rows exist" would let the heal overwrite admin-entered
          // scores with FD data. supabase-js returns errors, it doesn't throw.
          try {
            const { data, error } = await createClient(supabaseUrl, supabaseAnon)
              .from("demo_match_results")
              .select("match_id, entered_by, home_goals, away_goals, home_penalties, away_penalties, home_team, away_team, group_id, stage, status, scheduled_at");
            if (error) return null;
            return (data as DemoResult[]) || [];
          } catch {
            return null;
          }
        })()
      : Promise.resolve(null),
    loadDynamicDetails(),
  ]);

  const demoReadFailed = ourResults === null;

  // 2. Index our results by match_id for quick lookup
  const demoById: Record<string, DemoResult> = {};
  for (const r of ourResults ?? []) demoById[r.match_id] = r;

  // 3. Map Football-Data matches, overlay our data when present
  const fdMatches: FdRawMatch[] = fdResult.matches || [];
  const seen = new Set<string>();
  const merged: Match[] = [];

  for (const m of fdMatches) {
    const key = String(m.id);
    seen.add(key);
    const demo = demoById[key];
    // Live 90' fallback for matches not yet in our demo table (e.g. the window
    // between FT and the self-heal persisting the row).
    const reg = ninetyMinuteScore(m.score);
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
      // 90-MINUTE score only — demo row wins; else the FD-derived 90' score
      // (ninetyMinuteScore strips ET + shootout goals off the aggregate). ET &
      // shootout never enter the scoreline; they decide `winner`.
      homeGoals: demo?.home_goals ?? reg.home,
      awayGoals: demo?.away_goals ?? reg.away,
      homePenalties: demo?.home_penalties ?? m.score?.penalties?.home ?? null,
      awayPenalties: demo?.away_penalties ?? m.score?.penalties?.away ?? null,
      winner: m.score?.winner ?? null,
      venue: detailFor(m.id, dynamicDetails)?.venue ?? null,
      referees: detailFor(m.id, dynamicDetails)?.referees ?? [],
    });
  }

  // 4. Include any DB-only rows (manually entered matches that aren't in
  //    Football-Data.org yet — rare, but possible).
  for (const r of ourResults ?? []) {
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

  // 5. Knockout opponent resolution. FD leaves the best-third side of each R32
  //    fixture as "TBD" until the official draw assigns it — but we already
  //    resolve the real bracket from finished group results. Overlay the
  //    resolved opponent so the schedule shows the true matchup (e.g. "Germany
  //    vs Paraguay") instead of "Germany vs TBD".
  fillKnockoutOpponents(merged, ourResults ?? []);

  // Loud identity guard: any real (non-TBD) team whose code the app doesn't
  // recognise means a missing TLA alias — the bug that scrambled the matchday
  // order. Surface it in the payload (admin SystemStatus shows it) and log it,
  // instead of silently serving a fixture nobody can match. Re-trips whenever
  // a knockout draw introduces a team with an unmapped TLA.
  const unmappedTeams = findUnmappedTeams(merged);
  if (unmappedTeams.length) {
    console.error(`[/api/matches] Unmapped team codes: ${unmappedTeams.join(", ")} — add to FD_TLA_TO_APP in src/lib/fd-team-mapping.ts`);
  }

  // Self-heal: persist any FD-FINISHED match (with a real score) whose demo
  // row is missing or scoreless. The only scheduled sync is the daily 06:00
  // cron (Vercel Hobby = daily crons only), so during the evening play window
  // THIS is what gets results into the DB — every client polls /api/matches
  // every 60s while a match is live. after() runs it post-response (a bare
  // floating promise would be frozen with the lambda); it never overwrites an
  // admin-entered (non-null) score.
  // NEVER heal when the demo read failed — an empty demoById from a failed
  // read would make every FD-FINISHED match look "missing" and the heal would
  // overwrite admin-entered corrections with FD data.
  if (!demoReadFailed) after(() => healFinishedResults(fdMatches, demoById));

  // Cards board self-heal: the "dirtiest team" tally (TheSportsDB timelines)
  // used to refresh only in the daily cron, so a night's bookings lagged ~a
  // day. Refresh it here too — throttled per-instance to 15 min so the 60s
  // client polling doesn't hammer TheSportsDB.
  if (fdMatches.some((m) => m.status === "FINISHED")) after(() => healCardBoard());

  // Prediction-locks self-heal: the save RPCs REJECT any slot missing from the
  // `prediction_locks` table, and the 3h sync-locks cron can't run on Vercel
  // Hobby (daily crons only). So a stage whose fixtures resolved AFTER the last
  // sync (R32 best-thirds, then R16/QF/…) would be silently UNSAVEABLE — bettors
  // couldn't place picks on it. Refresh the lock table here from the already-
  // resolved `merged` schedule (identical to what /api/sync-locks computes), so
  // every open slot is always saveable, every stage, with no manual action.
  if (!demoReadFailed) after(() => healPredictionLocks(merged));

  const payload: { matches: Match[]; error?: string; unmappedTeams?: string[] } = { matches: merged };
  if ("error" in fdResult && fdResult.error) payload.error = fdResult.error;
  if (unmappedTeams.length) payload.unmappedTeams = unmappedTeams;
  return NextResponse.json(payload);
}

/**
 * Fill the best-third opponent FD leaves as "TBD" on R32 fixtures, using the
 * real bracket resolved from finished group results. ONLY R32 fixtures with
 * exactly one known team (the group-winner side) are filled; later rounds keep
 * their TBD until the feeding matches are played — you bet one stage at a time
 * on the match that actually exists. Never throws — a resolution hiccup must
 * not blank the schedule.
 */
function fillKnockoutOpponents(merged: Match[], ourResults: DemoResult[]): void {
  try {
    const finishedGroup: FinishedMatch[] = [];
    let idc = 1;
    for (const r of ourResults) {
      const isGroup = r.stage === "GROUP" || r.stage === "GROUP_STAGE";
      if (!isGroup || r.status !== "FINISHED") continue;
      if (r.home_goals == null || r.away_goals == null || !r.home_team || !r.away_team) continue;
      finishedGroup.push({
        id: idc++, date: r.scheduled_at || "",
        homeTla: normalizeTla(r.home_team), awayTla: normalizeTla(r.away_team),
        group: normalizeGroupLetter(r.group_id) || (r.group_id || "").toUpperCase(), stage: "GROUP",
        homeGoals: r.home_goals, awayGoals: r.away_goals,
        homePenalties: r.home_penalties, awayPenalties: r.away_penalties,
      });
    }
    // Resolve R32 only once the whole group stage is in — a partial set would
    // mis-seed the best-thirds and show a wrong opponent.
    if (finishedGroup.length < 72) return;
    const tree = resolveKnockoutTree(finishedGroup, null, undefined, LIVE_FEEDERS);
    const oppByTeam: Record<string, string> = {};
    for (const k of Object.keys(tree)) {
      if (!k.startsWith("r32")) continue;
      const s = tree[k as KoSlotKey];
      if (s.team1 && s.team2) { oppByTeam[s.team1] = s.team2; oppByTeam[s.team2] = s.team1; }
    }
    for (const m of merged) {
      if (m.stage !== "LAST_32" && m.stage !== "ROUND_OF_32") continue;
      const homeTBD = !m.homeTla || m.homeTla === "TBD";
      const awayTBD = !m.awayTla || m.awayTla === "TBD";
      if (homeTBD === awayTBD) continue; // need exactly one resolved side
      const known = homeTBD ? m.awayTla : m.homeTla;
      const opp = oppByTeam[known];
      if (!opp) continue;
      if (homeTBD) { m.homeTla = opp; m.homeTeam = opp; }
      else { m.awayTla = opp; m.awayTeam = opp; }
    }
  } catch { /* never block the schedule on a resolution hiccup */ }
}

// Per-instance throttle so the 60s polling doesn't re-upsert the same rows on
// every request. Cold starts reset it — harmless, the upsert is idempotent.
const healedAt = new Map<string, number>();
const HEAL_TTL_MS = 10 * 60_000;

async function healFinishedResults(
  fdMatches: FdRawMatch[],
  demoById: Record<string, DemoResult>,
): Promise<void> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !serviceKey) return;

  const now = Date.now();
  const needHeal = fdMatches.filter((m) => {
    if (m.status !== "FINISHED") return false;
    const demo = demoById[String(m.id)];
    if (demo && demo.home_goals != null && demo.away_goals != null) return false;
    const t = healedAt.get(String(m.id));
    return !t || now - t > HEAL_TTL_MS;
  });
  if (needHeal.length === 0) return;

  // buildResultRows applies the null-score guard, stage/TLA normalization and
  // the regularTime-vs-fullTime selection — identical to the sync routes.
  const fdRows = buildResultRows(needHeal as unknown as MatchResult[], "auto-heal");
  if (fdRows.length === 0) return;

  // Cross-check against ESPN before persisting so a phantom FD goal (e.g. the
  // ESP-KSA 5-0 that should have been 4-0) is corrected on the way in instead
  // of landing wrong and sitting until someone notices. demoById has no
  // admin rows here (needHeal already excludes scored rows), so this only
  // applies the ESPN preference; admin protection lives in /api/sync.
  const espnResults = await getEspnResults().catch(() => null);
  const { rows, disagreements } = reconcileFinishedRows(fdRows, demoById, espnResults);
  for (const d of disagreements) {
    console.error(`[/api/matches] SCORE MISMATCH ${d.home_team}-${d.away_team}: football-data ${d.fd} vs ESPN ${d.espn} → healing with ESPN, flagged for admin`);
  }
  if (rows.length === 0) return;

  try {
    const supabase = createClient(url, serviceKey);
    const { error } = await supabase
      .from("demo_match_results")
      .upsert(rows, { onConflict: "match_id" });
    if (!error) {
      for (const r of rows) healedAt.set(r.match_id, now);
      console.log(`[/api/matches] auto-healed ${rows.length} finished result(s): ${rows.map((r) => r.match_id).join(", ")}`);
    } else {
      console.error(`[/api/matches] auto-heal failed: ${error.message}`);
    }
  } catch (e) {
    console.error(`[/api/matches] auto-heal error: ${String(e)}`);
  }
}

// Cards board refresh — separate, slower throttle (the TheSportsDB timeline
// fetches are heavier than the results read). Per-instance; cold starts reset.
let cardHealAt = 0;
const CARD_HEAL_TTL_MS = 15 * 60_000;

async function healCardBoard(): Promise<void> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !serviceKey) return;
  const now = Date.now();
  if (now - cardHealAt < CARD_HEAL_TTL_MS) return;
  cardHealAt = now; // claim the slot before the await so concurrent polls don't pile up
  try {
    const n = await syncCardBoard(createClient(url, serviceKey));
    if (n > 0) console.log(`[/api/matches] card board synced (${n} teams)`);
  } catch (e) {
    console.error(`[/api/matches] card-heal error: ${String(e)}`);
  }
}

// Prediction-locks refresh — per-instance throttle (cold starts reset; the
// upsert is idempotent). Mirrors /api/sync-locks exactly: it passes the same
// /api/matches schedule into computePredictionLockRows. Done in-process here so
// the locks can never lag behind the resolved fixtures (no cron dependency).
let locksHealAt = 0;
const LOCKS_HEAL_TTL_MS = 10 * 60_000;

async function healPredictionLocks(merged: Match[]): Promise<void> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !serviceKey) return;
  const now = Date.now();
  if (now - locksHealAt < LOCKS_HEAL_TTL_MS) return;
  locksHealAt = now; // claim before the await so concurrent polls don't pile up
  try {
    // `merged` already carries resolved R32 opponents (fillKnockoutOpponents) and
    // matches LockSyncMatch's shape, so this is byte-for-byte what sync-locks does.
    const rows = computePredictionLockRows(merged as unknown as LockSyncMatch[], null);
    if (!rows.length) return; // never wipe last-good rows on an empty/odd feed
    const stamped = new Date().toISOString();
    const supabase = createClient(url, serviceKey);
    const { error } = await supabase
      .from("prediction_locks")
      .upsert(rows.map((r) => ({ ...r, updated_at: stamped })), { onConflict: "scope,lock_key" });
    if (error) console.error(`[/api/matches] locks-heal failed: ${error.message}`);
    else console.log(`[/api/matches] prediction_locks healed: ${rows.filter((r) => r.scope === "ko").length} KO + ${rows.filter((r) => r.scope === "group").length} group`);
  } catch (e) {
    console.error(`[/api/matches] locks-heal error: ${String(e)}`);
  }
}
