// ============================================================================
// WC2026 — Tournament live stats (server-side aggregation)
// Builds the payload consumed by the Special-Bets Tracker. Layers:
//   1. Football-Data.org scorers (players with goals + assists)
//   2. Finished matches in `demo_match_results` (team + group totals)
//   3. Admin-entered `tournament_actuals` (authoritative overrides)
// ============================================================================

import { createClient } from "@supabase/supabase-js";

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
      { headers: { "X-Auth-Token": token }, next: { revalidate: 300 } }
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
    return (data as TournamentActuals | null) ?? null;
  } catch {
    return null;
  }
}

// ---------- Public API ----------

export async function getTournamentStats(): Promise<TournamentStatsPayload> {
  const [scorers, finishedMatches, actuals] = await Promise.all([
    fetchFdScorers(25),
    fetchDemoResults(),
    fetchActuals(),
  ]);

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
