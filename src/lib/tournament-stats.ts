// ============================================================================
// WC2026 — Tournament live stats (server-side aggregation)
// Builds the payload consumed by the Special-Bets Tracker. Layers:
//   1. Football-Data.org scorers (players with goals + assists)
//   2. Finished matches in `demo_match_results` (team + group totals)
//   3. Admin-entered `tournament_actuals` (authoritative overrides)
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { penaltiesResult } from "@/lib/constants";
import { getEspnPlayerStats } from "@/lib/api-espn";

// ---------- Types ----------

export interface ScorerRow {
  name: string;
  team: string; // TLA
  goals: number;
  assists: number;
  played: number;
}

export interface TeamGoalStats {
  code: string;
  goalsFor: number;
  goalsAgainst: number;
  yellowCards: number;
  redCards: number;
  played: number;
}

export interface GroupGoalStats {
  letter: string;
  goals: number;
  matches: number;
}

export interface TournamentActuals {
  top_scorer_player: string | null;
  top_scorer_team: string | null;
  top_scorer_goals: number | null;
  top_assists_player: string | null;
  top_assists_team: string | null;
  top_assists_count: number | null;
  best_attack_team: string | null;
  best_attack_goals: number | null;
  dirtiest_team: string | null;
  dirtiest_team_cards: number | null;
  /** Admin-maintained dirtiest leaderboard (no auto card feed). Weighting: yellow=1, red=3. */
  dirtiest_board: Array<{ team: string; yellow: number; red: number }> | null;
  most_prolific_group: string | null;
  most_prolific_goals: number | null;
  driest_group: string | null;
  driest_group_goals: number | null;
  matchup_result_1: "1" | "X" | "2" | null;
  matchup_result_2: "1" | "X" | "2" | null;
  matchup_result_3: "1" | "X" | "2" | null;
  total_penalties: number | null;
  penalties_over_under: "OVER" | "UNDER" | null;
  champion: string | null;
}

export interface TournamentStatsPayload {
  scorers: ScorerRow[];
  assistsLeaders: ScorerRow[];
  teamStats: TeamGoalStats[];
  groupStats: GroupGoalStats[];
  actuals: TournamentActuals | null;
  finishedCount: number;
}

// ---------- Raw DB row ----------

interface DemoResultRow {
  home_team: string;
  away_team: string;
  home_goals: number | null;
  away_goals: number | null;
  group_id: string | null;
  stage: string;
  status: string;
}

// ---------- Helpers ----------

// NOTE: yellowCards/redCards stay at 0 here — there's no automatic card feed
// (Football-Data free tier has no bookings). The "dirtiest team" live
// leaderboard is instead driven by the admin-maintained `dirtiest_board` on
// `tournament_actuals` (yellow=1, red=3; a 2nd yellow same match = one red).
// See the admin "תוצאות מיוחדות" panel and SpecialTrackerView.
export function aggregateTeamStats(rows: DemoResultRow[]): TeamGoalStats[] {
  const map = new Map<string, TeamGoalStats>();
  const ensure = (code: string) => {
    if (!map.has(code)) {
      map.set(code, { code, goalsFor: 0, goalsAgainst: 0, yellowCards: 0, redCards: 0, played: 0 });
    }
    return map.get(code)!;
  };

  for (const r of rows) {
    if (r.status !== "FINISHED") continue;
    if (r.home_goals === null || r.away_goals === null) continue;
    const home = ensure(r.home_team);
    const away = ensure(r.away_team);
    home.goalsFor += r.home_goals;
    home.goalsAgainst += r.away_goals;
    home.played += 1;
    away.goalsFor += r.away_goals;
    away.goalsAgainst += r.home_goals;
    away.played += 1;
  }

  return Array.from(map.values()).sort((a, b) => b.goalsFor - a.goalsFor);
}

export function aggregateGroupStats(rows: DemoResultRow[]): GroupGoalStats[] {
  const map = new Map<string, GroupGoalStats>();
  for (const r of rows) {
    if (r.status !== "FINISHED") continue;
    if (r.home_goals === null || r.away_goals === null) continue;
    if (r.stage !== "GROUP_STAGE" && r.stage !== "GROUP") continue;
    const letter = (r.group_id || "").toUpperCase();
    if (!letter) continue;
    if (!map.has(letter)) map.set(letter, { letter, goals: 0, matches: 0 });
    const g = map.get(letter)!;
    g.goals += r.home_goals + r.away_goals;
    g.matches += 1;
  }
  return Array.from(map.values()).sort((a, b) => b.goals - a.goals);
}

// ---------- Football-Data scorers ----------

async function fetchFdScorers(limit = 25): Promise<ScorerRow[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) return [];
  try {
    const res = await fetch(
      `https://api.football-data.org/v4/competitions/WC/scorers?season=2026&limit=${limit}`,
      { headers: { "X-Auth-Token": token }, next: { revalidate: 600 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    type FdScorer = {
      player?: { name?: string };
      team?: { tla?: string; name?: string };
      goals?: number;
      assists?: number;
      playedMatches?: number;
    };
    const scorers = (data.scorers || []) as FdScorer[];
    return scorers
      .map((s) => ({
        name: s.player?.name || "Unknown",
        team: s.team?.tla || s.team?.name || "",
        goals: s.goals ?? 0,
        assists: s.assists ?? 0,
        played: s.playedMatches ?? 0,
      }))
      .filter((s) => s.name !== "Unknown");
  } catch {
    return [];
  }
}

// ---------- Supabase fetchers ----------

async function fetchDemoResults(): Promise<DemoResultRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return [];
  try {
    const supabase = createClient(url, anon);
    const { data } = await supabase
      .from("demo_match_results")
      .select("home_team, away_team, home_goals, away_goals, group_id, stage, status");
    return (data as DemoResultRow[]) || [];
  } catch {
    return [];
  }
}

async function fetchActuals(): Promise<TournamentActuals | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const supabase = createClient(url, anon);
    const { data } = await supabase
      .from("tournament_actuals")
      .select("*")
      .limit(1)
      .maybeSingle();
    const actuals = (data as TournamentActuals | null) ?? null;
    if (actuals) {
      // OVER/UNDER is always derived from the entered total vs PENALTIES_LINE —
      // never the stored column — so a line change re-resolves correctly and a
      // stale/blank stored value can't mis-score. (Includes ET, excludes shootouts.)
      actuals.penalties_over_under = penaltiesResult(actuals.total_penalties);
    }
    return actuals;
  } catch {
    return null;
  }
}

// ---------- Public API ----------

const normName = (s: string): string =>
  s.toLowerCase().replace(/['’`´׳]/g, "").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();

export async function getTournamentStats(): Promise<TournamentStatsPayload> {
  const [fdScorers, espnPlayers, finishedMatches, actuals] = await Promise.all([
    fetchFdScorers(25),
    getEspnPlayerStats(),
    fetchDemoResults(),
    fetchActuals(),
  ]);

  // Merge scorer data. football-data has goals but returns assists as NULL;
  // ESPN has both (parsed from goal events incl. the assister). Build a union
  // keyed by normalized name: ESPN is authoritative for assists, and goals
  // take the max of the two feeds (they agree; max guards a lagging feed).
  // ESPN also surfaces assist-only players football-data's scorer list omits —
  // important so the matchup duels (goals + assists) count those players too.
  const merged = new Map<string, ScorerRow>();
  for (const s of fdScorers) merged.set(normName(s.name), { ...s });
  for (const p of espnPlayers || []) {
    const key = normName(p.name);
    const ex = merged.get(key);
    if (ex) {
      ex.goals = Math.max(ex.goals, p.goals);
      ex.assists = Math.max(ex.assists, p.assists);
      if (!ex.team && p.team) ex.team = p.team;
    } else {
      merged.set(key, { name: p.name, team: p.team, goals: p.goals, assists: p.assists, played: p.played });
    }
  }
  const scorers = [...merged.values()];

  const teamStats = aggregateTeamStats(finishedMatches);
  const groupStats = aggregateGroupStats(finishedMatches);
  const assistsLeaders = [...scorers].sort((a, b) => b.assists - a.assists);

  return {
    scorers: [...scorers].sort((a, b) => b.goals - a.goals),
    assistsLeaders,
    teamStats,
    groupStats,
    actuals,
    finishedCount: finishedMatches.filter((r) => r.status === "FINISHED").length,
  };
}
