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

async function fetchAPI(endpoint: string) {
  const token = getToken();
  if (!token) throw new Error("FOOTBALL_DATA_TOKEN not set");

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: { "X-Auth-Token": token },
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Football-Data API error: ${res.status} — ${err.message || "Unknown"}`);
  }

  return res.json();
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
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
}

/**
 * Get all WC2026 matches (fixtures + results)
 */
export async function getMatches(): Promise<MatchResult[]> {
  const data = await fetchAPI(`/competitions/${COMPETITION}/matches?season=${SEASON}`);
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
  const data = await fetchAPI(`/competitions/${COMPETITION}/matches?season=${SEASON}&dateFrom=${today}&dateTo=${tomorrow}`);
  return data.matches || [];
}

/**
 * Get only finished matches (for scoring)
 */
export async function getFinishedMatches(): Promise<MatchResult[]> {
  const data = await fetchAPI(`/competitions/${COMPETITION}/matches?season=${SEASON}&status=FINISHED`);
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
        homeGoals: m.score.fullTime.home,
        awayGoals: m.score.fullTime.away,
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
