// ============================================================================
// WC2026 — Special bets scoring (final + live-tentative)
//
// Two modes:
//
// 1. **Final** — admin entered the official outcome in `tournament_actuals`.
//    Exact picks award the full point value (e.g. top scorer = 9). Top-scorer
//    and top-assists also support "relative" credit when the user's pick
//    scored ≥3 goals / ≥2 assists, even if they're not the eventual winner.
//
// 2. **Live tentative (during tournament)** — admin hasn't entered the final
//    yet, but the cron-synced `player_stats` table records per-player goals /
//    assists. We award the same point values the user would earn IF the
//    tournament ended right now: pick === current leader → exact; pick scored
//    ≥ threshold → relative. Every awarded line is flagged `interim: true`
//    so the UI can mark it as "כרגע" / "זמני".
//
// "Other" special bets (best-attack team, prolific group, …) work in both
// modes too: when the admin has entered the actual value, exact match awards
// the full points; otherwise the bet contributes 0 (no live tentative path
// for team/group bets yet — those resolve cleanly after group stage).
// ============================================================================

import { SCORING, type ScoreReason, type ScoringValues } from "@/types";
import type { BettorSpecialBets } from "@/lib/supabase/shared-data";
import { MATCHUPS, parseMatchupPick } from "@/lib/matchups";

/** Admin-entered tournament outcome (mirrors the `tournament_actuals` row). */
export interface TournamentActuals {
  top_scorer_player: string | null;
  top_assists_player: string | null;
  best_attack_team: string | null;
  most_prolific_group: string | null;
  driest_group: string | null;
  dirtiest_team: string | null;
  /**
   * Admin-maintained per-team card tally (yellow=1, red=3). Feeds the group /
   * best-thirds fair-play tiebreaker via `fairPlayFromBoard` — the results API
   * has no bookings, so this is the only card source. Optional/null when unset.
   */
  dirtiest_board?: Array<{ team: string; yellow: number; red: number }> | null;
  /** One result per player-duel matchup (3 fixtures). Each scored independently. */
  matchup_result_1: "1" | "X" | "2" | null;
  matchup_result_2: "1" | "X" | "2" | null;
  matchup_result_3: "1" | "X" | "2" | null;
  penalties_over_under: "OVER" | "UNDER" | null;
}

/** Per-player tournament stats — populated by the sync cron or admin patch. */
export interface PlayerStat {
  name: string;
  goals: number;
  assists: number;
  minutes?: number;
}

export interface SpecialBetLine {
  reason: ScoreReason;
  points: number;
  /** True when admin hasn't entered the final result yet — score is interim. */
  interim: boolean;
  /** Display hint: who's currently leading (only set when interim). */
  liveLeader?: string;
  /** Display hint: the user's pick value as stored (for the breakdown UI). */
  pick?: string | null;
}

export interface SpecialBetsBreakdown {
  total: number;
  /** True if **any** line is interim. */
  hasInterim: boolean;
  lines: SpecialBetLine[];
}

interface LiveLeaderInfo {
  topScorer: { name: string; goals: number } | null;
  topAssists: { name: string; assists: number } | null;
}

function computeLiveLeaders(stats: PlayerStat[]): LiveLeaderInfo {
  if (!stats.length) return { topScorer: null, topAssists: null };
  // Top scorer: goals desc, then assists desc, then fewest minutes asc (FIFA Golden Boot tiebreak).
  const byGoals = [...stats].sort(
    (a, b) =>
      b.goals - a.goals ||
      b.assists - a.assists ||
      (a.minutes ?? Infinity) - (b.minutes ?? Infinity),
  );
  const topScorer = byGoals[0]?.goals > 0 ? { name: byGoals[0].name, goals: byGoals[0].goals } : null;
  // Top assists: assists desc, then goals desc, then minutes asc.
  const byAssists = [...stats].sort(
    (a, b) =>
      b.assists - a.assists ||
      b.goals - a.goals ||
      (a.minutes ?? Infinity) - (b.minutes ?? Infinity),
  );
  const topAssists =
    byAssists[0]?.assists > 0 ? { name: byAssists[0].name, assists: byAssists[0].assists } : null;
  return { topScorer, topAssists };
}

// Accent-insensitive, all-significant-tokens match — so a stored pick like
// "Vinícius Jr." resolves to the feed's "Vinícius Júnior", while "Harry Kane"
// does NOT collide with squad-mate "Harry Maguire" (requires "kane" too).
const deburrName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

function findStat(stats: PlayerStat[], name: string | null | undefined): PlayerStat | null {
  if (!name) return null;
  const exact = stats.find((s) => s.name === name) ||
    stats.find((s) => s.name.endsWith(` ${name}`) || s.name.endsWith(`. ${name}`));
  if (exact) return exact;
  const q = deburrName(name);
  const qTokens = q.split(" ").filter((t) => t.length >= 4);
  return (
    stats.find((s) => {
      const n = deburrName(s.name);
      return n.includes(q) || q.includes(n) || (qTokens.length > 0 && qTokens.every((t) => n.includes(t)));
    }) || null
  );
}

/**
 * Score one user's special-bets entry.
 *
 * - `actuals` may be partially-filled — each field is scored independently.
 *   Fields the admin hasn't entered yet (null) fall back to the live tentative
 *   path when `playerStats` data exists, otherwise contribute 0.
 * - The returned `total` already factors in interim lines; the caller is
 *   responsible for rendering those with a visual marker (see `interim` flag).
 */
export function scoreSpecialBetsForUser(
  bets: BettorSpecialBets,
  actuals: TournamentActuals | null,
  playerStats: PlayerStat[] = [],
  scoring: ScoringValues = SCORING,
): SpecialBetsBreakdown {
  const lines: SpecialBetLine[] = [];
  const leaders = computeLiveLeaders(playerStats);

  // -- Top scorer --
  const finalScorer = actuals?.top_scorer_player ?? null;
  if (bets.topScorerPlayer) {
    if (finalScorer) {
      // Final: exact or relative.
      if (bets.topScorerPlayer === finalScorer) {
        lines.push({
          reason: "TOP_SCORER_EXACT",
          points: scoring.specials.top_scorer_exact,
          interim: false,
          pick: bets.topScorerPlayer,
        });
      } else {
        const stat = findStat(playerStats, bets.topScorerPlayer);
        if (stat && stat.goals >= scoring.relative_minimums.top_scorer_goals) {
          lines.push({
            reason: "TOP_SCORER_RELATIVE",
            points: scoring.specials.top_scorer_relative,
            interim: false,
            pick: bets.topScorerPlayer,
          });
        }
      }
    } else if (leaders.topScorer) {
      // Tentative: live-leading or relative threshold.
      const stat = findStat(playerStats, bets.topScorerPlayer);
      if (bets.topScorerPlayer === leaders.topScorer.name) {
        lines.push({
          reason: "TOP_SCORER_EXACT",
          points: scoring.specials.top_scorer_exact,
          interim: true,
          liveLeader: leaders.topScorer.name,
          pick: bets.topScorerPlayer,
        });
      } else if (stat && stat.goals >= scoring.relative_minimums.top_scorer_goals) {
        lines.push({
          reason: "TOP_SCORER_RELATIVE",
          points: scoring.specials.top_scorer_relative,
          interim: true,
          liveLeader: leaders.topScorer.name,
          pick: bets.topScorerPlayer,
        });
      }
    }
  }

  // -- Top assists --
  const finalAssists = actuals?.top_assists_player ?? null;
  if (bets.topAssistsPlayer) {
    if (finalAssists) {
      if (bets.topAssistsPlayer === finalAssists) {
        lines.push({
          reason: "TOP_ASSISTS_EXACT",
          points: scoring.specials.top_assists_exact,
          interim: false,
          pick: bets.topAssistsPlayer,
        });
      } else {
        const stat = findStat(playerStats, bets.topAssistsPlayer);
        if (stat && stat.assists >= scoring.relative_minimums.top_assists) {
          lines.push({
            reason: "TOP_ASSISTS_RELATIVE",
            points: scoring.specials.top_assists_relative,
            interim: false,
            pick: bets.topAssistsPlayer,
          });
        }
      }
    } else if (leaders.topAssists) {
      const stat = findStat(playerStats, bets.topAssistsPlayer);
      if (bets.topAssistsPlayer === leaders.topAssists.name) {
        lines.push({
          reason: "TOP_ASSISTS_EXACT",
          points: scoring.specials.top_assists_exact,
          interim: true,
          liveLeader: leaders.topAssists.name,
          pick: bets.topAssistsPlayer,
        });
      } else if (stat && stat.assists >= scoring.relative_minimums.top_assists) {
        lines.push({
          reason: "TOP_ASSISTS_RELATIVE",
          points: scoring.specials.top_assists_relative,
          interim: true,
          liveLeader: leaders.topAssists.name,
          pick: bets.topAssistsPlayer,
        });
      }
    }
  }

  // -- Best attack team / Most prolific group / Driest group / Dirtiest team --
  // These are exact-only and resolve cleanly when the admin enters the value.
  const simpleExact: [keyof BettorSpecialBets, keyof TournamentActuals, ScoreReason, keyof typeof SCORING.specials][] = [
    ["bestAttackTeam", "best_attack_team", "BEST_ATTACK", "best_attack"],
    ["prolificGroup", "most_prolific_group", "PROLIFIC_GROUP", "prolific_group"],
    ["driestGroup", "driest_group", "DRIEST_GROUP", "driest_group"],
    ["dirtiestTeam", "dirtiest_team", "DIRTIEST_TEAM", "dirtiest_team"],
  ];
  for (const [betField, actualField, reason, scoringField] of simpleExact) {
    const pick = bets[betField] as string | null;
    const actual = actuals?.[actualField] as string | null | undefined;
    if (pick && actual && pick === actual) {
      lines.push({
        reason,
        points: scoring.specials[scoringField],
        interim: false,
        pick,
      });
    }
  }

  // -- Matchups (3 player duels) --
  // The user's pick is stored as a comma-joined "1,X,2" string; the admin
  // enters one result per duel (matchup_result_1..3). Each duel is scored
  // independently at scoring.specials.matchup. Exact-only (no live tentative).
  const matchupPicks = parseMatchupPick(bets.matchupPick);
  const matchupActuals = [
    actuals?.matchup_result_1 ?? null,
    actuals?.matchup_result_2 ?? null,
    actuals?.matchup_result_3 ?? null,
  ];
  for (let i = 0; i < MATCHUPS.length; i++) {
    const pick = matchupPicks[i];
    const actual = matchupActuals[i];
    if (pick && actual && pick === actual) {
      const mu = MATCHUPS[i];
      lines.push({
        reason: "MATCHUP",
        points: scoring.specials.matchup,
        interim: false,
        pick: `${mu.p1Short} vs ${mu.p2Short}: ${pick}`,
      });
    }
  }

  // -- Penalties over/under --
  if (
    bets.penaltiesOverUnder &&
    actuals?.penalties_over_under &&
    bets.penaltiesOverUnder === actuals.penalties_over_under
  ) {
    lines.push({
      reason: "PENALTIES_OVER_UNDER",
      points: scoring.specials.penalties_over_under,
      interim: false,
      pick: bets.penaltiesOverUnder,
    });
  }

  const total = lines.reduce((sum, l) => sum + l.points, 0);
  const hasInterim = lines.some((l) => l.interim);
  return { total, hasInterim, lines };
}
