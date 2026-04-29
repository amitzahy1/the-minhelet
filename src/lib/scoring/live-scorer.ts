// ============================================================================
// WC2026 — Live scoring engine (client-side)
// Computes per-user points from bracket predictions + finished matches.
// Used by standings, compare results tab, and the main-page leaderboard until
// a proper server-side scoring pipeline writes to the scoring_log table.
// ============================================================================

import { computeGroupHits, type FinishedMatch } from "../results-hits";
import type { BettorBracket } from "../supabase/shared-data";

// Point values — mirror scoring_config defaults
export const GROUP_TOTO_PTS = 2;
export const GROUP_EXACT_BONUS_PTS = 1; // added on top of toto when exact
export const KO_TOTO_PTS = 3; // R32/R16/QF
export const KO_EXACT_BONUS_PTS = 1;
export const SF_TOTO_PTS = 3;
export const SF_EXACT_BONUS_PTS = 2;
export const FINAL_TOTO_PTS = 4;
export const FINAL_EXACT_BONUS_PTS = 2;

export interface PlayerScore {
  userId: string;
  displayName: string;

  // Match predictions (group + knockout)
  matchPts: number;
  totoGroup: number;
  exactGroup: number;
  totoKnockout: number;
  exactKnockout: number;

  // Reserved for future scoring stages (computed from advancement + special_bets)
  advPts: number;
  specPts: number;

  total: number;

  // Stats
  totoHits: number;    // #matches where user got at least the 1X2 right
  exactHits: number;   // #matches where user got the exact score
  missHits: number;    // #matches where user predicted but was wrong
  emptyHits: number;   // #matches user didn't predict at all
  totalFinished: number; // #finished matches we have data for
}

function emptyScore(userId: string, displayName: string): PlayerScore {
  return {
    userId,
    displayName,
    matchPts: 0,
    totoGroup: 0,
    exactGroup: 0,
    totoKnockout: 0,
    exactKnockout: 0,
    advPts: 0,
    specPts: 0,
    total: 0,
    totoHits: 0,
    exactHits: 0,
    missHits: 0,
    emptyHits: 0,
    totalFinished: 0,
  };
}

/** Compute points for all bettors from the given brackets and finished matches. */
export function computeLiveScores(
  brackets: BettorBracket[],
  matches: FinishedMatch[]
): Record<string, PlayerScore> {
  const byUser: Record<string, PlayerScore> = {};
  for (const b of brackets) {
    byUser[b.userId] = emptyScore(b.userId, b.displayName || "ללא שם");
  }

  for (const match of matches) {
    const isGroup = match.stage === "GROUP_STAGE" || match.stage === "GROUP";
    if (!isGroup) continue; // knockout scoring not yet implemented (needs FD match-id → matchKey resolver)

    const hits = computeGroupHits(match, brackets);
    for (const hit of hits) {
      const score = byUser[hit.userId];
      if (!score) continue;
      score.totalFinished += 1;

      if (hit.hit === "empty") { score.emptyHits += 1; continue; }
      if (hit.hit === "miss") { score.missHits += 1; continue; }
      if (hit.hit === "toto") {
        score.totoHits += 1;
        score.totoGroup += GROUP_TOTO_PTS;
      } else if (hit.hit === "exact") {
        score.totoHits += 1;
        score.exactHits += 1;
        score.totoGroup += GROUP_TOTO_PTS;
        score.exactGroup += GROUP_EXACT_BONUS_PTS;
      }
    }
  }

  for (const score of Object.values(byUser)) {
    score.matchPts = score.totoGroup + score.exactGroup + score.totoKnockout + score.exactKnockout;
    score.total = score.matchPts + score.advPts + score.specPts;
  }

  return byUser;
}

/** Compute today's points only — for the "+X היום" indicator on the leaderboard. */
export function computeTodayScores(
  brackets: BettorBracket[],
  matches: FinishedMatch[]
): Record<string, number> {
  const todayIsrael = new Date().toLocaleDateString("he-IL");
  const todayMatches = matches.filter((m) => {
    try {
      return new Date(m.date).toLocaleDateString("he-IL") === todayIsrael;
    } catch {
      return false;
    }
  });
  const scores = computeLiveScores(brackets, todayMatches);
  const out: Record<string, number> = {};
  for (const [uid, s] of Object.entries(scores)) out[uid] = s.total;
  return out;
}

/**
 * Per-user cumulative-points series across the sequence of finished matches
 * (chronological). Used to draw the "trend" sparkline on the leaderboard.
 * Returns `[0, ...afterEachMatch]` so the line always starts at zero and
 * grows as matches complete. If fewer than 2 finished matches exist, returns
 * a flat two-point series so the sparkline renders without NaN.
 */
export function computePlayerHistories(
  brackets: BettorBracket[],
  matches: FinishedMatch[]
): Record<string, number[]> {
  const sorted = [...matches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const cumulative: Record<string, number[]> = {};
  for (const b of brackets) cumulative[b.userId] = [0];

  for (const match of sorted) {
    const isGroup = match.stage === "GROUP_STAGE" || match.stage === "GROUP";
    if (!isGroup) continue;

    const hits = computeGroupHits(match, brackets);
    const deltaByUser: Record<string, number> = {};
    for (const h of hits) {
      if (h.hit === "exact") deltaByUser[h.userId] = GROUP_TOTO_PTS + GROUP_EXACT_BONUS_PTS;
      else if (h.hit === "toto") deltaByUser[h.userId] = GROUP_TOTO_PTS;
    }
    for (const uid of Object.keys(cumulative)) {
      const series = cumulative[uid];
      const last = series[series.length - 1];
      series.push(last + (deltaByUser[uid] || 0));
    }
  }

  // Guarantee every series has at least 2 points so SVG polyline renders.
  for (const uid of Object.keys(cumulative)) {
    if (cumulative[uid].length < 2) cumulative[uid] = [0, 0];
  }
  return cumulative;
}

// Max pts per knockout bracket key prefix
export const KO_STAGE_MAX_PTS: Record<string, number> = {
  r32:   KO_TOTO_PTS + KO_EXACT_BONUS_PTS,        // 4
  r16l:  KO_TOTO_PTS + KO_EXACT_BONUS_PTS,         // 4
  r16r:  KO_TOTO_PTS + KO_EXACT_BONUS_PTS,         // 4
  qfl:   KO_TOTO_PTS + KO_EXACT_BONUS_PTS,         // 4
  qfr:   KO_TOTO_PTS + KO_EXACT_BONUS_PTS,         // 4
  sfl:   SF_TOTO_PTS + SF_EXACT_BONUS_PTS,          // 5
  sfr:   SF_TOTO_PTS + SF_EXACT_BONUS_PTS,          // 5
  final: FINAL_TOTO_PTS + FINAL_EXACT_BONUS_PTS,   // 6
};
