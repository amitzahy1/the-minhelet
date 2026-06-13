// ============================================================================
// WC2026 — Live scoring engine (client-side)
// Computes per-user points from bracket predictions + finished matches.
// Used by standings, compare results tab, and the main-page leaderboard until
// a proper server-side scoring pipeline writes to the scoring_log table.
// ============================================================================

import { computeGroupHits, type FinishedMatch } from "../results-hits";
import type { BettorBracket, BettorAdvancement, BettorSpecialBets } from "../supabase/shared-data";
import { GROUPS } from "../tournament/groups";
import { getTodayIsrael, toIsraelDateKey } from "../timezone";
import {
  resolveKnockoutTree,
  computeGroupOrders,
  findThirdPlaceMatch,
  fairPlayFromBoard,
  type SlotState,
} from "./knockout-resolver";
import { calculateKnockoutScore } from "./calculator";
import {
  scoreAdvancementForUser,
  deriveActualGroupOrders,
  type AdvancementBreakdown,
} from "./advancement-scorer";
import {
  scoreSpecialBetsForUser,
  type SpecialBetsBreakdown,
  type TournamentActuals,
  type PlayerStat,
} from "./special-bets-scorer";
import { SCORING, type MatchStage, type ScoringValues } from "@/types";

// Built-in default point values — these MIRROR the SCORING constant and act as
// the fallback when no scoring_config row is supplied. At runtime callers pass
// the DB-resolved config via `LiveScoringOptions.scoring`, so admin edits flow
// through here. These exported consts remain the defaults used by display code.
export const GROUP_TOTO_PTS = SCORING.toto.GROUP;
export const GROUP_EXACT_BONUS_PTS = SCORING.exact.GROUP; // added on top of toto when exact
export const KO_TOTO_PTS = SCORING.toto.R16; // R32/R16/QF
export const KO_EXACT_BONUS_PTS = SCORING.exact.R16;
export const SF_TOTO_PTS = SCORING.toto.SF;
export const SF_EXACT_BONUS_PTS = SCORING.exact.SF;
export const FINAL_TOTO_PTS = SCORING.toto.FINAL;
export const FINAL_EXACT_BONUS_PTS = SCORING.exact.FINAL;

export interface PlayerScore {
  userId: string;
  displayName: string;

  // Match predictions (group + knockout)
  matchPts: number;
  totoGroup: number;
  exactGroup: number;
  totoKnockout: number;
  exactKnockout: number;

  // Advancement + special-bet aggregates
  advPts: number;
  specPts: number;

  /** Detailed advancement breakdown (per pick type), null when no advancement entry. */
  advBreakdown: AdvancementBreakdown | null;
  /** Detailed special-bets breakdown, null when no special bets entry. */
  specBreakdown: SpecialBetsBreakdown | null;
  /** True when any special-bet line in the score is interim (admin hasn't finalized). */
  specHasInterim: boolean;

  total: number;

  // Stats
  totoHits: number;    // #matches where user got at least the 1X2 right
  exactHits: number;   // #matches where user got the exact score
  missHits: number;    // #matches where user predicted but was wrong
  emptyHits: number;   // #matches user didn't predict at all
  totalFinished: number; // #finished matches we have data for
}

export interface LiveScoringOptions {
  advancements?: BettorAdvancement[];
  specialBets?: BettorSpecialBets[];
  tournamentActuals?: TournamentActuals | null;
  playerStats?: PlayerStat[];
  /** Admin override for the best-thirds qualifier set, used by the bracket resolver. */
  bestThirdsOverride?: string[] | null;
  /**
   * Resolved scoring point values (from the `scoring_config` table via
   * scoringFromConfig). Defaults to the built-in SCORING constant when omitted,
   * so existing callers and tests keep their current behavior.
   */
  scoring?: ScoringValues;
  /**
   * LIVE-leaderboard scope: in-play matches (with their current score) to fold
   * into the MATCH-RESULT scoring only (group + knockout toto/exact). When
   * provided, group/KO points are computed from this set, while advancement,
   * who-qualifies, the bracket resolution and specials stay on the FINISHED
   * `matches` arg — so a half-played match moves match points but never
   * prematurely advances a team or shifts the bracket. Omit it (the default)
   * and behavior is identical to scoring `matches` alone (fully backward-compatible).
   */
  liveMatches?: FinishedMatch[];
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
    advBreakdown: null,
    specBreakdown: null,
    specHasInterim: false,
    total: 0,
    totoHits: 0,
    exactHits: 0,
    missHits: 0,
    emptyHits: 0,
    totalFinished: 0,
  };
}

/** Map a knockout-tree slot key to its scoring stage. */
function stageForSlot(key: string): MatchStage {
  if (key.startsWith("r32")) return "R32";
  if (key.startsWith("r16")) return "R16";
  if (key.startsWith("qf")) return "QF";
  if (key.startsWith("sf")) return "SF";
  if (key === "third_place" || key === "third") return "THIRD";
  return "FINAL";
}

interface KnockoutPick {
  score1: number | null;
  score2: number | null;
  winner: string | null;
}

function knockoutPick(bracket: BettorBracket, slotKey: string): KnockoutPick | null {
  // Knockout MATCH-RESULT scoring reads Tree 2 (the real-data tree), NOT the
  // pre-tournament "עץ סימולציה" (knockoutTree). The simulation tree is
  // winner-only and feeds advancement/champion via advancement_picks; its match
  // scores earn ZERO points. Real matchups (which teams land in each slot) are
  // resolved from real results, so only Tree-2 predictions are meaningful here.
  const tree = (bracket.knockoutTreeLive || {}) as Record<string, KnockoutPick>;
  const v = tree[slotKey];
  if (!v || (v.score1 === null && v.score2 === null && v.winner === null)) return null;
  return v;
}

/** Compute points for all bettors from the given brackets and finished matches. */
export function computeLiveScores(
  brackets: BettorBracket[],
  matches: FinishedMatch[],
  options: LiveScoringOptions = {},
): Record<string, PlayerScore> {
  const scoring = options.scoring ?? SCORING;
  // Per-team conduct (cards) for the group/3rd-place fair-play tiebreaker. The
  // results API has no bookings, so this is the admin-maintained dirtiest board;
  // undefined when none entered, in which case a card-decided tie falls to FIFA
  // ranking (and the admin is alerted to enter the cards).
  const fairPlay = fairPlayFromBoard(options.tournamentActuals?.dirtiest_board);
  const byUser: Record<string, PlayerScore> = {};
  for (const b of brackets) {
    byUser[b.userId] = emptyScore(b.userId, b.displayName || "ללא שם");
  }

  // Match-RESULT scoring (group + KO toto/exact) reads the live-inclusive set
  // when the caller passes in-play matches; everything else (advancement,
  // resolution, specials) stays on the FINISHED `matches` arg below.
  const matchResults = options.liveMatches ?? matches;

  // -------- Group-stage match scoring --------
  for (const match of matchResults) {
    const isGroup = match.stage === "GROUP_STAGE" || match.stage === "GROUP";
    if (!isGroup) continue;

    const hits = computeGroupHits(match, brackets);
    for (const hit of hits) {
      const score = byUser[hit.userId];
      if (!score) continue;
      score.totalFinished += 1;

      if (hit.hit === "empty") { score.emptyHits += 1; continue; }
      if (hit.hit === "miss") { score.missHits += 1; continue; }
      if (hit.hit === "toto") {
        score.totoHits += 1;
        score.totoGroup += scoring.toto.GROUP;
      } else if (hit.hit === "exact") {
        score.totoHits += 1;
        score.exactHits += 1;
        score.totoGroup += scoring.toto.GROUP;
        score.exactGroup += scoring.exact.GROUP;
      }
    }
  }

  // -------- Knockout scoring --------
  // Resolve from the match-result set (live-inclusive) so an in-play KO match's
  // current score grades its own toto/exact. Downstream slots without a score
  // are skipped below, so a live result can't mis-score a not-yet-played round.
  const slotTree = resolveKnockoutTree(matchResults, options.bestThirdsOverride ?? null, fairPlay);
  const thirdPlace = findThirdPlaceMatch(matchResults);

  for (const slot of Object.values(slotTree)) {
    if (slot.score1 === null || slot.score2 === null || !slot.team1 || !slot.team2) continue;
    const stage = stageForSlot(slot.key);
    const actualDraw = slot.score1 === slot.score2;
    const penaltyWinner = actualDraw ? slot.winner : null;

    for (const b of brackets) {
      const pick = knockoutPick(b, slot.key);
      if (!pick) continue;
      const score = byUser[b.userId];
      if (!score) continue;
      score.totalFinished += 1;

      const result = calculateKnockoutScore(
        stage,
        {
          homeGoals: slot.score1,
          awayGoals: slot.score2,
          penaltyWinner,
          team1: slot.team1,
          team2: slot.team2,
        },
        pick,
        scoring,
      );
      if (result.toto > 0) score.totoHits += 1;
      if (result.exact > 0) score.exactHits += 1;
      else if (result.toto === 0) score.missHits += 1;

      score.totoKnockout += result.toto;
      score.exactKnockout += result.exact;
    }
  }

  // Third-place play-off — scored separately (not part of the bracket tree).
  if (thirdPlace) {
    const stage: MatchStage = "THIRD";
    const actualDraw = thirdPlace.score1 === thirdPlace.score2;
    const penaltyWinner = actualDraw ? thirdPlace.winner : null;
    for (const b of brackets) {
      const pick = knockoutPick(b, "third_place");
      if (!pick) continue;
      const score = byUser[b.userId];
      if (!score) continue;
      score.totalFinished += 1;
      const result = calculateKnockoutScore(
        stage,
        {
          homeGoals: thirdPlace.score1,
          awayGoals: thirdPlace.score2,
          penaltyWinner,
          team1: thirdPlace.team1,
          team2: thirdPlace.team2,
        },
        pick,
        scoring,
      );
      if (result.toto > 0) score.totoHits += 1;
      if (result.exact > 0) score.exactHits += 1;
      else if (result.toto === 0) score.missHits += 1;
      score.totoKnockout += result.toto;
      score.exactKnockout += result.exact;
    }
  }

  // -------- Advancement scoring (FINISHED-only — never moves live) --------
  // Resolve who advances / the bracket / champion from the FINISHED `matches`
  // ONLY, so an in-play result can't prematurely qualify a team or reshuffle
  // the bracket. (When no liveMatches were passed this is the same tree as
  // above, so behavior is unchanged.)
  if (options.advancements && options.advancements.length > 0) {
    const advSlotTree = options.liveMatches
      ? resolveKnockoutTree(matches, options.bestThirdsOverride ?? null, fairPlay)
      : slotTree;
    const groupOrders = computeGroupOrders(matches, fairPlay);
    const actualGroupOrders = deriveActualGroupOrders(advSlotTree, groupOrders, GROUPS);
    // 3rd-place qualifiers = teams currently appearing as `?3` resolved slots
    // (their group is among the 8 best thirds). Derive from advSlotTree: any
    // team in a slot whose `h`/`a` reference was a "Xn" slot with n=3.
    const bestThirdsCodes = new Set<string>();
    // Compute by inspecting which 3rd-place teams from completed groups actually
    // appear in any R32 slot.
    const allR32Teams = new Set<string>();
    for (const k of Object.keys(advSlotTree)) {
      if (!k.startsWith("r32")) continue;
      const slot = advSlotTree[k as keyof typeof advSlotTree];
      if (slot.team1) allR32Teams.add(slot.team1);
      if (slot.team2) allR32Teams.add(slot.team2);
    }
    for (const [letter, order] of Object.entries(groupOrders)) {
      const thirdIdx = order[2];
      const thirdCode = GROUPS[letter]?.[thirdIdx]?.code;
      if (thirdCode && allR32Teams.has(thirdCode)) bestThirdsCodes.add(thirdCode);
    }

    // Champion = winner of the final slot.
    const champion = advSlotTree["final"]?.winner ?? null;

    for (const adv of options.advancements) {
      const score = byUser[adv.userId];
      if (!score) continue;
      const breakdown = scoreAdvancementForUser(
        adv,
        actualGroupOrders,
        bestThirdsCodes,
        advSlotTree as Record<string, SlotState>,
        champion,
        scoring,
      );
      score.advPts = breakdown.total;
      score.advBreakdown = breakdown;
    }
  }

  // -------- Special-bets scoring (final + live tentative) --------
  if (options.specialBets && options.specialBets.length > 0) {
    const actuals = options.tournamentActuals ?? null;
    const stats = options.playerStats ?? [];
    for (const bets of options.specialBets) {
      const score = byUser[bets.userId];
      if (!score) continue;
      const breakdown = scoreSpecialBetsForUser(bets, actuals, stats, scoring);
      score.specPts = breakdown.total;
      score.specBreakdown = breakdown;
      score.specHasInterim = breakdown.hasInterim;
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
  matches: FinishedMatch[],
  scoring: ScoringValues = SCORING,
): Record<string, number> {
  // Israel calendar day (not the runtime TZ) — matches the rest of the app, so
  // a late kickoff (e.g. 23:00 UTC) is attributed to the day users see it on,
  // and the value is identical whether computed in the browser or on a UTC server.
  const todayIsrael = getTodayIsrael();
  const todayMatches = matches.filter((m) => {
    try {
      return toIsraelDateKey(m.date) === todayIsrael;
    } catch {
      return false;
    }
  });
  const scores = computeLiveScores(brackets, todayMatches, { scoring });
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
  matches: FinishedMatch[],
  scoring: ScoringValues = SCORING,
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
      if (h.hit === "exact") deltaByUser[h.userId] = scoring.toto.GROUP + scoring.exact.GROUP;
      else if (h.hit === "toto") deltaByUser[h.userId] = scoring.toto.GROUP;
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

// Max pts per knockout bracket key prefix (built-in defaults). Display code
// that must reflect admin-edited values should call koStageMaxPts(scoring).
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

/** Max pts per knockout bracket key prefix, from a resolved scoring config. */
export function koStageMaxPts(scoring: ScoringValues = SCORING): Record<string, number> {
  return {
    r32:   scoring.toto.R32 + scoring.exact.R32,
    r16l:  scoring.toto.R16 + scoring.exact.R16,
    r16r:  scoring.toto.R16 + scoring.exact.R16,
    qfl:   scoring.toto.QF + scoring.exact.QF,
    qfr:   scoring.toto.QF + scoring.exact.QF,
    sfl:   scoring.toto.SF + scoring.exact.SF,
    sfr:   scoring.toto.SF + scoring.exact.SF,
    final: scoring.toto.FINAL + scoring.exact.FINAL,
  };
}
