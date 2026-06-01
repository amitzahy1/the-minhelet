// ============================================================================
// WC2026 — Group Standings Calculator
// Implements FIFA tiebreaker rules in correct order
// ============================================================================

import type { GroupMatchPrediction, GroupStandingEntry } from "@/types";
import { getTeamByCode } from "./groups";

interface TeamStats {
  team_id: number;
  team_code: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  points: number;
  fair_play_score: number;
}

/**
 * Calculate group standings from a set of match predictions.
 * Applies FIFA tiebreaker rules in order:
 * 1. Points
 * 2. Goal difference
 * 3. Goals scored
 * 4. Head-to-head (points, GD, goals scored)
 * 5. Fair play (not calculable from scores alone — stored separately)
 * 6. Drawing of lots (not implemented — would be random)
 */
export function calculateStandings(
  teams: { id: number; code: string }[],
  matches: GroupMatchPrediction[]
): GroupStandingEntry[] {
  // Initialize stats for each team
  const statsMap = new Map<string, TeamStats>();
  for (const team of teams) {
    statsMap.set(team.code, {
      team_id: team.id,
      team_code: team.code,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
      points: 0,
      fair_play_score: 0,
    });
  }

  // Apply each match result
  for (const match of matches) {
    const home = statsMap.get(match.home_team_code);
    const away = statsMap.get(match.away_team_code);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goals_for += match.home_goals;
    home.goals_against += match.away_goals;
    away.goals_for += match.away_goals;
    away.goals_against += match.home_goals;

    if (match.home_goals > match.away_goals) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (match.home_goals < match.away_goals) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points += 1;
      away.points += 1;
    }
  }

  // Sort teams by FIFA tiebreaker rules (see rankTeams — overall pts/GD/GF, then a
  // head-to-head MINI-TABLE among the still-tied teams, then fair play, FIFA world
  // ranking, and finally team code).
  const sorted = rankTeams(Array.from(statsMap.values()), matches);

  // Convert to standings entries with positions
  return sorted.map((stats, index) => ({
    team_id: stats.team_id,
    team_code: stats.team_code,
    position: index + 1,
    played: stats.played,
    won: stats.won,
    drawn: stats.drawn,
    lost: stats.lost,
    goals_for: stats.goals_for,
    goals_against: stats.goals_against,
    goal_difference: stats.goals_for - stats.goals_against,
    points: stats.points,
    fair_play_score: stats.fair_play_score,
  }));
}

// ============================================================================
// FIFA tiebreaker engine (single source of truth)
//
// Order per the WC2026 regulations:
//   1. Points          2. Goal difference     3. Goals scored      (all OVERALL)
// then, among teams STILL equal, a mini-table built from ONLY the matches played
// among those teams:
//   4. H2H points      5. H2H goal difference 6. H2H goals scored
// then:
//   7. Fair play (fewer cards)  8. FIFA world ranking  9. team code (lots stand-in)
//
// The mini-table is applied to the whole tied set at once (NOT pairwise — a
// pairwise comparator is intransitive for 3+ tied teams). If the mini-table
// separates some teams but leaves a smaller subset tied, that subset re-applies
// the mini-table among ONLY its own members (FIFA's documented continuation),
// recursing on strictly-smaller sets until it terminates.
// ============================================================================

function fifaRankOf(code: string): number {
  return getTeamByCode(code)?.fifa_ranking ?? 999;
}

/** Final, always-decisive comparator once pts/GD/GF and H2H are exhausted. */
function finalTiebreak(a: TeamStats, b: TeamStats): number {
  if (a.fair_play_score !== b.fair_play_score) return a.fair_play_score - b.fair_play_score;
  const ra = fifaRankOf(a.team_code);
  const rb = fifaRankOf(b.team_code);
  if (ra !== rb) return ra - rb; // lower FIFA ranking number = better
  return a.team_code.localeCompare(b.team_code);
}

/** Head-to-head pts/GD/GF restricted to matches played among the given teams. */
function miniTable(
  teams: TeamStats[],
  matches: GroupMatchPrediction[]
): Record<string, { pts: number; gd: number; gf: number }> {
  const codes = new Set(teams.map((t) => t.team_code));
  const m: Record<string, { pts: number; gf: number; ga: number }> = {};
  for (const t of teams) m[t.team_code] = { pts: 0, gf: 0, ga: 0 };
  for (const match of matches) {
    if (!codes.has(match.home_team_code) || !codes.has(match.away_team_code)) continue;
    const h = m[match.home_team_code];
    const a = m[match.away_team_code];
    h.gf += match.home_goals; h.ga += match.away_goals;
    a.gf += match.away_goals; a.ga += match.home_goals;
    if (match.home_goals > match.away_goals) h.pts += 3;
    else if (match.home_goals < match.away_goals) a.pts += 3;
    else { h.pts += 1; a.pts += 1; }
  }
  const out: Record<string, { pts: number; gd: number; gf: number }> = {};
  for (const code of codes) out[code] = { pts: m[code].pts, gd: m[code].gf - m[code].ga, gf: m[code].gf };
  return out;
}

/** Order a set of teams already tied on overall pts/GD/GF. */
function breakTie(tied: TeamStats[], matches: GroupMatchPrediction[]): TeamStats[] {
  if (tied.length <= 1) return tied;
  const mini = miniTable(tied, matches);
  const keyed = tied
    .map((t) => ({ t, ...mini[t.team_code] }))
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);

  // If the mini-table can't separate anyone, fall straight to the final tiebreak.
  const first = keyed[0];
  const noneSeparated = keyed.every((k) => k.pts === first.pts && k.gd === first.gd && k.gf === first.gf);
  if (noneSeparated) return [...tied].sort(finalTiebreak);

  // Otherwise emit in mini-table order; any still-equal (strictly smaller) subset
  // re-runs the mini-table among only its own members.
  const out: TeamStats[] = [];
  let i = 0;
  while (i < keyed.length) {
    let j = i + 1;
    while (j < keyed.length && keyed[j].pts === keyed[i].pts && keyed[j].gd === keyed[i].gd && keyed[j].gf === keyed[i].gf) j++;
    const sub = keyed.slice(i, j).map((k) => k.t);
    if (sub.length > 1 && sub.length < tied.length) out.push(...breakTie(sub, matches));
    else if (sub.length > 1) out.push(...[...sub].sort(finalTiebreak));
    else out.push(sub[0]);
    i = j;
  }
  return out;
}

/** Full ranking: overall pts/GD/GF, then break each tied run with the mini-table. */
function rankTeams(teams: TeamStats[], matches: GroupMatchPrediction[]): TeamStats[] {
  const gd = (t: TeamStats) => t.goals_for - t.goals_against;
  const primary = [...teams].sort(
    (a, b) => b.points - a.points || gd(b) - gd(a) || b.goals_for - a.goals_for,
  );
  const result: TeamStats[] = [];
  let i = 0;
  while (i < primary.length) {
    let j = i + 1;
    while (j < primary.length && primary[j].points === primary[i].points && gd(primary[j]) === gd(primary[i]) && primary[j].goals_for === primary[i].goals_for) j++;
    const run = primary.slice(i, j);
    result.push(...(run.length > 1 ? breakTie(run, matches) : run));
    i = j;
  }
  return result;
}

/**
 * Check if predicted standings order matches calculated standings.
 * Returns true if the order matches, false otherwise.
 */
export function validateGroupOrder(
  predictedOrder: string[],
  calculatedStandings: GroupStandingEntry[]
): boolean {
  return predictedOrder.every(
    (code, index) => calculatedStandings[index]?.team_code === code
  );
}

/**
 * Calculate maximum possible points a team can still achieve,
 * given current results and remaining matches.
 */
export function getMaxPossiblePoints(
  teamCode: string,
  currentPoints: number,
  totalGroupMatches: number,
  matchesPlayed: number
): number {
  const remainingMatches = totalGroupMatches - matchesPlayed;
  return currentPoints + remainingMatches * 3;
}
