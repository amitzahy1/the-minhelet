// ============================================================================
// WC2026 — Group Standings Calculator
// Implements FIFA tiebreaker rules in correct order
// ============================================================================

import type { GroupMatchPrediction, GroupStandingEntry } from "@/types";

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

  // Sort teams by FIFA tiebreaker rules
  const sorted = Array.from(statsMap.values()).sort((a, b) => {
    // 1. Points (descending)
    if (b.points !== a.points) return b.points - a.points;

    // 2. Goal difference (descending)
    const gdA = a.goals_for - a.goals_against;
    const gdB = b.goals_for - b.goals_against;
    if (gdB !== gdA) return gdB - gdA;

    // 3. Goals scored (descending)
    if (b.goals_for !== a.goals_for) return b.goals_for - a.goals_for;

    // 4. Head-to-head between tied teams
    const h2h = headToHead(a.team_code, b.team_code, matches);
    if (h2h !== 0) return h2h;

    // 5. Fair play (lower is better — fewer cards)
    if (a.fair_play_score !== b.fair_play_score)
      return a.fair_play_score - b.fair_play_score;

    // 6. Drawing of lots — just use team code as final tiebreaker
    return a.team_code.localeCompare(b.team_code);
  });

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

/**
 * Head-to-head tiebreaker between two teams.
 * Returns negative if team A wins h2h, positive if team B wins, 0 if still tied.
 */
function headToHead(
  teamA: string,
  teamB: string,
  matches: GroupMatchPrediction[]
): number {
  const h2hMatches = matches.filter(
    (m) =>
      (m.home_team_code === teamA && m.away_team_code === teamB) ||
      (m.home_team_code === teamB && m.away_team_code === teamA)
  );

  let pointsA = 0;
  let pointsB = 0;
  let goalsA = 0;
  let goalsB = 0;

  for (const m of h2hMatches) {
    const homeIsA = m.home_team_code === teamA;
    const aGoals = homeIsA ? m.home_goals : m.away_goals;
    const bGoals = homeIsA ? m.away_goals : m.home_goals;

    goalsA += aGoals;
    goalsB += bGoals;

    if (aGoals > bGoals) pointsA += 3;
    else if (bGoals > aGoals) pointsB += 3;
    else {
      pointsA += 1;
      pointsB += 1;
    }
  }

  // H2H points
  if (pointsB !== pointsA) return pointsB - pointsA;
  // H2H goal difference
  const gdDiff = (goalsB - goalsA) - (goalsA - goalsB);
  if (gdDiff !== 0) return gdDiff > 0 ? 1 : -1;
  // H2H goals scored
  if (goalsB !== goalsA) return goalsB - goalsA;

  return 0;
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
