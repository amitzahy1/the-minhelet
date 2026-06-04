// ============================================================================
// WC2026 — Group Standings Calculator
// Implements FIFA tiebreaker rules in correct order
// ============================================================================

import type { GroupMatchPrediction, GroupStandingEntry, TiebreakReason } from "@/types";
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
 * Calculate group standings from a set of match predictions, applying the FIFA
 * WC2026 tiebreaker order (see the engine section below — head-to-head ranks
 * ABOVE overall goal difference for 2026).
 *
 * `opts.fairPlay` supplies a per-team conduct score (lower = cleaner = better)
 * for the fair-play step. The match input carries no cards (and users can't
 * predict them), so it is omitted for the predicted table — fair play is then
 * treated as equal and a dead-even tie falls through to FIFA ranking, with
 * `needs_card_data` set so the UI can flag it. Pass it on the REAL-results path
 * (from the admin-maintained dirtiest board) so a group decided by cards ranks
 * correctly.
 */
export function calculateStandings(
  teams: { id: number; code: string }[],
  matches: GroupMatchPrediction[],
  opts?: { fairPlay?: Record<string, number> }
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
      fair_play_score: opts?.fairPlay?.[team.code] ?? 0,
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

  // Sort by the FIFA WC2026 cascade (see rankTeams) and annotate each row with
  // the criterion that separated it from the team above (for the UI badge).
  const sorted = rankTeams(Array.from(statsMap.values()), matches);
  const reasons = annotateTiebreaks(sorted, matches, opts?.fairPlay);

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
    tiebreak_reason: reasons[index].reason,
    needs_card_data: reasons[index].needsCards,
  }));
}

// ============================================================================
// FIFA WC2026 tiebreaker engine (single source of truth)
//
// Order per the WC2026 regulations. NOTE: this CHANGED from 2022 — head-to-head
// now ranks ABOVE overall goal difference:
//   1. Points (all group matches)
// then, among teams equal on points, a mini-table from ONLY the matches played
// among those teams:
//   2. H2H points      3. H2H goal difference   4. H2H goals scored
// then back to all group matches:
//   5. Overall goal difference   6. Overall goals scored
// then:
//   7. Fair play (fewer cards)   8. FIFA world ranking (2026 final decider —
//      replaced the drawing of lots)   9. team code (deterministic stand-in)
//
// The H2H mini-table is applied to the whole tied set at once (NOT pairwise — a
// pairwise comparator is intransitive for 3+ tied teams). If it separates some
// teams but leaves a strictly-smaller subset tied, that subset re-applies the
// mini-table among ONLY its own members (FIFA's documented continuation),
// recursing until it terminates; whatever stays tied then drops to steps 5–9.
// Ref: fifa.com/.../canadamexicousa2026/articles/groups-how-teams-qualify-tie-breakers
// ============================================================================

function fifaRankOf(code: string): number {
  return getTeamByCode(code)?.fifa_ranking ?? 999;
}

/** Final, always-decisive comparator once H2H and overall GD/GF are exhausted. */
function finalTiebreak(a: TeamStats, b: TeamStats): number {
  if (a.fair_play_score !== b.fair_play_score) return a.fair_play_score - b.fair_play_score;
  const ra = fifaRankOf(a.team_code);
  const rb = fifaRankOf(b.team_code);
  if (ra !== rb) return ra - rb; // lower FIFA ranking number = better
  return a.team_code.localeCompare(b.team_code);
}

/** Post-H2H terminal: overall GD → overall GF → fair play → FIFA rank → code. */
function overallThenFinal(a: TeamStats, b: TeamStats): number {
  const gdA = a.goals_for - a.goals_against;
  const gdB = b.goals_for - b.goals_against;
  if (gdA !== gdB) return gdB - gdA;
  if (a.goals_for !== b.goals_for) return b.goals_for - a.goals_for;
  return finalTiebreak(a, b);
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

/**
 * Order a set of teams already equal ON POINTS, per the 2026 cascade: H2H
 * mini-table first, then (for whatever stays tied) overall GD/GF → fair play →
 * FIFA ranking.
 */
function breakTie(tied: TeamStats[], matches: GroupMatchPrediction[]): TeamStats[] {
  if (tied.length <= 1) return tied;
  const mini = miniTable(tied, matches);
  const keyed = tied
    .map((t) => ({ t, ...mini[t.team_code] }))
    .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf);

  // If the H2H mini-table can't separate anyone, drop straight to overall GD/GF
  // and the final tiebreak.
  const first = keyed[0];
  const noneSeparated = keyed.every((k) => k.pts === first.pts && k.gd === first.gd && k.gf === first.gf);
  if (noneSeparated) return [...tied].sort(overallThenFinal);

  // Otherwise emit in mini-table order; any still-equal (strictly smaller) subset
  // re-runs the mini-table among only its own members, then falls to overall GD/GF.
  const out: TeamStats[] = [];
  let i = 0;
  while (i < keyed.length) {
    let j = i + 1;
    while (j < keyed.length && keyed[j].pts === keyed[i].pts && keyed[j].gd === keyed[i].gd && keyed[j].gf === keyed[i].gf) j++;
    const sub = keyed.slice(i, j).map((k) => k.t);
    if (sub.length > 1 && sub.length < tied.length) out.push(...breakTie(sub, matches));
    else if (sub.length > 1) out.push(...[...sub].sort(overallThenFinal));
    else out.push(sub[0]);
    i = j;
  }
  return out;
}

/** Full ranking: sort by points, then resolve each equal-points run with the cascade. */
function rankTeams(teams: TeamStats[], matches: GroupMatchPrediction[]): TeamStats[] {
  const primary = [...teams].sort((a, b) => b.points - a.points);
  const result: TeamStats[] = [];
  let i = 0;
  while (i < primary.length) {
    let j = i + 1;
    while (j < primary.length && primary[j].points === primary[i].points) j++;
    const run = primary.slice(i, j);
    result.push(...(run.length > 1 ? breakTie(run, matches) : run));
    i = j;
  }
  return result;
}

// ----------------------------------------------------------------------------
// Tiebreak reason annotation (drives the /groups badge + the needs-cards alerts)
// ----------------------------------------------------------------------------

type ReasonInfo = { reason: TiebreakReason | null; needsCards: boolean };

/**
 * For each ranked team, why it sits directly below the team above it. The H2H
 * check uses the mini-table of the team's equal-points run, plus the two teams'
 * direct match (covering FIFA's re-applied-H2H continuation). `needsCards` flags
 * a gap that hinges on the fair-play step when card data is missing for one or
 * both of the two teams — the order then fell through to FIFA ranking, and an
 * admin/user should break it deliberately. (A team explicitly present in
 * `fairPlay`, even at 0, counts as known.)
 */
function annotateTiebreaks(
  sorted: TeamStats[],
  matches: GroupMatchPrediction[],
  fairPlay: Record<string, number> | undefined
): ReasonInfo[] {
  // Per-team H2H values, computed within each equal-points run.
  const h2h = new Map<string, { pts: number; gd: number; gf: number }>();
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].points === sorted[i].points) j++;
    const run = sorted.slice(i, j);
    const mini = miniTable(run, matches);
    for (const t of run) h2h.set(t.team_code, mini[t.team_code]);
    i = j;
  }
  return sorted.map((curr, idx) => {
    if (idx === 0) return { reason: null, needsCards: false };
    const prev = sorted[idx - 1];
    if (prev.points !== curr.points) return { reason: null, needsCards: false };
    return reasonBetween(prev, curr, h2h, matches, fairPlay);
  });
}

function reasonBetween(
  prev: TeamStats,
  curr: TeamStats,
  h2h: Map<string, { pts: number; gd: number; gf: number }>,
  matches: GroupMatchPrediction[],
  fairPlay: Record<string, number> | undefined
): ReasonInfo {
  const hp = h2h.get(prev.team_code);
  const hc = h2h.get(curr.team_code);
  if (hp && hc && (hp.pts !== hc.pts || hp.gd !== hc.gd || hp.gf !== hc.gf))
    return { reason: "h2h", needsCards: false };
  // Re-applied H2H continuation: their direct match alone may separate them even
  // when the full-run mini-table didn't.
  const pair = miniTable([prev, curr], matches);
  const pp = pair[prev.team_code];
  const pc = pair[curr.team_code];
  if (pp.pts !== pc.pts || pp.gd !== pc.gd || pp.gf !== pc.gf)
    return { reason: "h2h", needsCards: false };
  const gdP = prev.goals_for - prev.goals_against;
  const gdC = curr.goals_for - curr.goals_against;
  if (gdP !== gdC) return { reason: "overall_gd", needsCards: false };
  if (prev.goals_for !== curr.goals_for) return { reason: "overall_gf", needsCards: false };
  // Equal through overall goals → the next real discriminator is conduct (cards).
  // If we lack card data for either team, the order fell to FIFA ranking and the
  // gap should be flagged for a deliberate tiebreak.
  const haveCards = !!fairPlay && prev.team_code in fairPlay && curr.team_code in fairPlay;
  if (!haveCards) return { reason: "fifa_rank", needsCards: true };
  if (prev.fair_play_score !== curr.fair_play_score) return { reason: "fair_play", needsCards: false };
  if (fifaRankOf(prev.team_code) !== fifaRankOf(curr.team_code)) return { reason: "fifa_rank", needsCards: false };
  return { reason: "lots", needsCards: false };
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
