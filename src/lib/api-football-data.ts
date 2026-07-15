// ============================================================================
// WC2026 — Football-Data.org Integration (Free Tier)
// Endpoints: matches, standings, scorers, teams
// Free: 10 requests/minute, WC included
// Register at: https://www.football-data.org/client/register
// ============================================================================

const BASE_URL = "https://api.football-data.org/v4";
const COMPETITION = "WC"; // FIFA World Cup
const SEASON = 2026;

function getToken(): string {
  return process.env.FOOTBALL_DATA_TOKEN || "";
}

async function fetchAPI(endpoint: string, opts?: { fresh?: boolean }) {
  const token = getToken();
  if (!token) throw new Error("FOOTBALL_DATA_TOKEN not set");

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "X-Auth-Token": token },
    // RESULT-SYNC paths must bypass the data cache: a 10-min-stale snapshot
    // taken in FD's "FINISHED but score not yet entered" window is how a null
    // score got persisted for the opening match (2026-06-11). Browse-only
    // endpoints (scorers/standings/teams) keep the cache — they're hit by
    // client-facing routes and FD free tier allows only 10 req/min.
    ...(opts?.fresh ? { cache: "no-store" as const } : { next: { revalidate: 600 } }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Football-Data API error: ${res.status} — ${err.message || "Unknown"}`);
  }

  return res.json();
}

// ============================================================================
// 90-minute score selection (shared by every score-persisting path)
// ============================================================================

type ScoreLike = {
  winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  fullTime?: { home?: number | null; away?: number | null };
  regularTime?: { home?: number | null; away?: number | null };
  extraTime?: { home?: number | null; away?: number | null };
  penalties?: { home?: number | null; away?: number | null };
} | null | undefined;

/**
 * The 90-minute (regulation) score — the ONLY score the exact/toto bet is judged
 * on. Football-Data reports it three different ways depending on how a KO match
 * ended, and the naive `regularTime ?? fullTime` gets ONE of them wrong:
 *   - REGULAR (decided in 90'): only `fullTime` is set, and it IS the 90' score.
 *   - PENALTY_SHOOTOUT: `regularTime` carries the clean 90' score; `fullTime`
 *     AGGREGATES the shootout (verified: fullTime 4–5 / regularTime 1–1).
 *   - EXTRA_TIME (won in ET, NO shootout): `fullTime` is the 120' aggregate and
 *     `regularTime` is left NULL (verified live 2026-07-01, BEL–SEN R32:
 *     fullTime 3–2, regularTime null, extraTime 1–0 → real 90' = 2–2). The old
 *     `regularTime ?? fullTime` returned the 120' score (3–2) here — the bug.
 * So: prefer a populated `regularTime`; else strip ET + shootout goals off
 * `fullTime`. We key off the PRESENCE of extra/penalty goals, NOT the `duration`
 * label — FD's free tier flip-flops that label between REGULAR and EXTRA_TIME on
 * the same match, so it can't be trusted.
 */
export function ninetyMinuteScore(score: ScoreLike): { home: number | null; away: number | null } {
  const rt = score?.regularTime;
  if (rt?.home != null && rt?.away != null) return { home: rt.home, away: rt.away };
  const ft = score?.fullTime;
  if (ft?.home == null || ft?.away == null) return { home: null, away: null };
  const etH = score?.extraTime?.home ?? 0;
  const etA = score?.extraTime?.away ?? 0;
  const pkH = score?.penalties?.home ?? 0;
  const pkA = score?.penalties?.away ?? 0;
  return { home: ft.home - etH - pkH, away: ft.away - etA - pkA };
}

/**
 * The 120-minute score — regulation + extra time, EXCLUDING the shootout. This
 * is the tally the SPECIAL BETS count (best-attack team goals, and real
 * "goals scored" convention): an extra-time goal counts, a shootout kick never
 * does. Contrast `ninetyMinuteScore` (90' only, for the exact/toto MATCH bet).
 *   - prefer `regularTime` (clean 90') + `extraTime` goals, OR
 *   - strip only the shootout off `fullTime` (which already includes ET).
 * Verified against the three FD shapes (see `ninetyMinuteScore`): a 90' match →
 * fullTime; ET-no-shootout (BEL–SEN, rt null, ft 3–2) → 3–2; a shootout
 * (rt 1–1, ft 4–5, pk 3–4) → 1–1 (shootout dropped).
 */
export function fullTime120Score(score: ScoreLike): { home: number | null; away: number | null } {
  const etH = score?.extraTime?.home ?? 0;
  const etA = score?.extraTime?.away ?? 0;
  const rt = score?.regularTime;
  if (rt?.home != null && rt?.away != null) return { home: rt.home + etH, away: rt.away + etA };
  const ft = score?.fullTime;
  if (ft?.home == null || ft?.away == null) return { home: null, away: null };
  const pkH = score?.penalties?.home ?? 0;
  const pkA = score?.penalties?.away ?? 0;
  return { home: ft.home - pkH, away: ft.away - pkA };
}

/**
 * True qualifier of a FINISHED match, surviving FD free-tier garbage.
 *
 * FD's `score.winner` is the authoritative signal, but the free tier can leave
 * it NULL on a decided match (seen live 2026-07-07, SUI–COL R16: winner null +
 * penalties 3–3 — a shootout can't tie — while fullTime held the real 4–3).
 * Without a winner the resolver can't advance the qualifier, the next round's
 * slot never resolves, advancement points go missing and the slot gets no lock
 * row (unsaveable picks). Since `fullTime` AGGREGATES ET + shootout goals, a
 * decisive fullTime on a FINISHED match identifies the winner even when both
 * `winner` and `penalties` are broken.
 */
export function koWinnerFromScore(
  score: ScoreLike,
  status: string | null | undefined,
): "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null {
  if (score?.winner) return score.winner;
  if (status !== "FINISHED") return null;
  const ft = score?.fullTime;
  if (ft?.home == null || ft?.away == null || ft.home === ft.away) return null;
  return ft.home > ft.away ? "HOME_TEAM" : "AWAY_TEAM";
}

/**
 * Shootout score, dropping feed garbage. A FINISHED shootout can never be tied,
 * so equal non-null penalties (the SUI–COL 3–3 above) are a mid-publish
 * artifact — return nulls rather than persist/serve them.
 */
export function decisivePenalties(
  score: ScoreLike,
): { home: number | null; away: number | null } {
  const p = score?.penalties;
  if (p?.home == null || p?.away == null || p.home === p.away) return { home: null, away: null };
  return { home: p.home, away: p.away };
}

// ============================================================================
// Match Results
// ============================================================================

export interface MatchResult {
  id: number;
  utcDate: string;
  status: "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED" | "POSTPONED" | "CANCELLED";
  matchday: number;
  stage: string;
  group: string | null;
  homeTeam: { id: number; name: string; shortName: string; tla: string; crest: string };
  awayTeam: { id: number; name: string; shortName: string; tla: string; crest: string };
  score: {
    winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    duration?: "REGULAR" | "EXTRA_TIME" | "PENALTY_SHOOTOUT";
    // `fullTime` is the AGGREGATE: for a shootout it INCLUDES the shootout
    // (verified: a real penalty match returned fullTime 1–5 / regularTime 0–1).
    // Use `regularTime` for the clean 90-minute score; `penalties` for the
    // shootout. `regularTime`/`extraTime`/`penalties` only appear once a KO
    // match passes 90'.
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
    regularTime?: { home: number | null; away: number | null };
    extraTime?: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null };
  };
}

/**
 * Get all WC2026 matches (fixtures + results).
 * Pass fresh=true from sync paths — they must never act on a stale snapshot.
 */
export async function getMatches(fresh = false): Promise<MatchResult[]> {
  const data = await fetchAPI(`/competitions/${COMPETITION}/matches?season=${SEASON}`, { fresh });
  return data.matches || [];
}

/**
 * Get matches for a specific matchday
 */
export async function getMatchesByMatchday(matchday: number): Promise<MatchResult[]> {
  const data = await fetchAPI(`/competitions/${COMPETITION}/matches?season=${SEASON}&matchday=${matchday}`);
  return data.matches || [];
}

/**
 * Get today's matches (and nearby dates)
 */
export async function getTodayMatches(): Promise<MatchResult[]> {
  const today = new Date().toISOString().split("T")[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const data = await fetchAPI(`/competitions/${COMPETITION}/matches?season=${SEASON}&dateFrom=${today}&dateTo=${tomorrow}`, { fresh: true });
  return data.matches || [];
}

/**
 * Get only finished matches (for scoring). Always fresh — never serve a stale
 * cached snapshot to a sync that is about to persist scores.
 */
export async function getFinishedMatches(): Promise<MatchResult[]> {
  const data = await fetchAPI(`/competitions/${COMPETITION}/matches?season=${SEASON}&status=FINISHED`, { fresh: true });
  return data.matches || [];
}

// ============================================================================
// Standings
// ============================================================================

export interface GroupStanding {
  stage: string;
  group: string;
  table: {
    position: number;
    team: { id: number; name: string; shortName: string; tla: string; crest: string };
    playedGames: number;
    won: number;
    draw: number;
    lost: number;
    points: number;
    goalsFor: number;
    goalsAgainst: number;
    goalDifference: number;
  }[];
}

/**
 * Get group standings
 */
export async function getStandings(): Promise<GroupStanding[]> {
  const data = await fetchAPI(`/competitions/${COMPETITION}/standings?season=${SEASON}`);
  return data.standings || [];
}

// ============================================================================
// Top Scorers
// ============================================================================

export interface Scorer {
  player: { id: number; name: string; nationality: string };
  team: { id: number; name: string; shortName: string; tla: string; crest: string };
  playedMatches: number;
  goals: number;
  assists: number | null;
  penalties: number | null;
}

/**
 * Get top scorers
 */
export async function getTopScorers(limit: number = 20): Promise<Scorer[]> {
  const data = await fetchAPI(`/competitions/${COMPETITION}/scorers?season=${SEASON}&limit=${limit}`);
  return data.scorers || [];
}

// ============================================================================
// Teams
// ============================================================================

export interface TeamInfo {
  id: number;
  name: string;
  shortName: string;
  tla: string;
  crest: string;
  coach: { id: number; name: string; nationality: string };
  squad: { id: number; name: string; position: string; nationality: string }[];
}

/**
 * Get all teams in the competition
 */
export async function getTeams(): Promise<TeamInfo[]> {
  const data = await fetchAPI(`/competitions/${COMPETITION}/teams?season=${SEASON}`);
  return data.teams || [];
}

// ============================================================================
// Sync Helper — update Supabase from API data
// ============================================================================

/**
 * Sync match results to Supabase
 * Call this periodically (e.g., every 30 minutes during match windows)
 */
export async function syncMatchResults() {
  try {
    const matches = await getFinishedMatches();
    // In production: upsert to Supabase matches table
    // For now: return the data for manual processing
    return {
      success: true,
      matchesCount: matches.length,
      matches: matches.map(m => ({
        id: m.id,
        homeTeam: m.homeTeam.tla,
        awayTeam: m.awayTeam.tla,
        // 90-minute score only — see ninetyMinuteScore for why raw
        // `regularTime ?? fullTime` mis-reads an ET-decided match.
        homeGoals: ninetyMinuteScore(m.score).home,
        awayGoals: ninetyMinuteScore(m.score).away,
        homePenalties: decisivePenalties(m.score).home,
        awayPenalties: decisivePenalties(m.score).away,
        // True qualifier (incl. ET + shootout) — used for KO advancement, not goals.
        winner: koWinnerFromScore(m.score, m.status),
        status: m.status,
        date: m.utcDate,
        stage: m.stage,
        group: m.group,
      })),
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
