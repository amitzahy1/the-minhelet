// ============================================================================
// WC2026 — Knockout slot resolver (shared by live bracket + scoring engine)
//
// Given the list of finished matches, computes the real bracket state: which
// teams currently occupy each KO slot (r32l_0 … final) and the result/winner
// of each match. Used by `live-scorer` to map each FINISHED knockout match
// back to its bracket slot so user predictions for that slot can be scored.
// ============================================================================

import { GROUPS, GROUP_LETTERS, getTeamByCode } from "@/lib/tournament/groups";
import { calculateStandings } from "@/lib/tournament/standings";
import type { GroupMatchPrediction } from "@/types";
import {
  buildR32Matchups,
  LATER_FEEDERS,
  resolveGroupSlot,
} from "@/lib/tournament/knockout-derivation";
import {
  DEFAULT_ASSIGNMENT,
  getThirdsAssignment,
  type ThirdsAssignment,
} from "@/lib/tournament/annex-c";
import { rankBestThirds, type ThirdsInputRow } from "@/lib/tournament/thirds-ranker";
import { normalizeGroupLetter, type FinishedMatch } from "@/lib/results-hits";

interface GroupRow {
  code: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
}

/**
 * Per-team conduct score from the admin-maintained dirtiest board
 * (yellow = 1, red = 3; lower = cleaner = better — matches the rules page and
 * SpecialResultsEntry). Returns `undefined` for an empty/absent board so the
 * standings engine treats fair play as "unknown" (and flags `needs_card_data`)
 * rather than as a real 0-0 tie. The free-tier results API carries no bookings,
 * so this admin board is the ONLY source of cards.
 */
export function fairPlayFromBoard(
  board: Array<{ team: string; yellow: number; red: number }> | null | undefined,
): Record<string, number> | undefined {
  if (!board || board.length === 0) return undefined;
  const out: Record<string, number> = {};
  for (const r of board) out[r.team] = (r.yellow ?? 0) * 1 + (r.red ?? 0) * 3;
  return out;
}

function computeGroupStandings(
  groupLetter: string,
  matches: FinishedMatch[],
  fairPlay?: Record<string, number>,
): GroupRow[] {
  const teams = GROUPS[groupLetter] || [];
  // Delegate to the single FIFA standings engine (full tiebreakers incl. the
  // head-to-head mini-table + FIFA-ranking fallback) so the bracket the resolver
  // builds matches the predicted table the user sees on /groups.
  const preds: GroupMatchPrediction[] = [];
  for (const m of matches) {
    if (normalizeGroupLetter(m.group) !== groupLetter) continue;
    preds.push({
      match_id: preds.length,
      home_team_code: m.homeTla,
      away_team_code: m.awayTla,
      home_goals: m.homeGoals,
      away_goals: m.awayGoals,
    });
  }
  const entries = calculateStandings(
    teams.map((t) => ({ id: t.id, code: t.code })),
    preds,
    fairPlay ? { fairPlay } : undefined,
  );
  return entries.map((e) => ({
    code: e.team_code,
    played: e.played,
    wins: e.won,
    draws: e.drawn,
    losses: e.lost,
    gf: e.goals_for,
    ga: e.goals_against,
    gd: e.goal_difference,
    pts: e.points,
  }));
}

/** Each group's 3rd-placed team, formatted for the best-thirds ranker. */
function extractThirds(matches: FinishedMatch[], fairPlay?: Record<string, number>): ThirdsInputRow[] {
  const out: ThirdsInputRow[] = [];
  for (const letter of GROUP_LETTERS) {
    const standings = computeGroupStandings(letter, matches, fairPlay);
    const third = standings[2];
    if (!third) continue;
    out.push({
      group: letter,
      team_code: third.code,
      played: third.played,
      points: third.pts,
      goal_difference: third.gd,
      goals_for: third.gf,
      // Best-thirds ranking uses conduct (cards) before FIFA ranking — feed it
      // from the admin board so a card-decided 3rd-place cutoff ranks correctly.
      fair_play_score: fairPlay?.[third.code] ?? 0,
      fifa_ranking: getTeamByCode(third.code)?.fifa_ranking,
    });
  }
  return out;
}

/**
 * Return per-group team-index orderings, but only for groups whose 6 matches
 * are all FINISHED (each team played 3). Groups with incomplete play are
 * omitted, so downstream slot resolution returns null for those positions.
 */
export function computeGroupOrders(
  matches: FinishedMatch[],
  fairPlay?: Record<string, number>,
): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const letter of GROUP_LETTERS) {
    const standings = computeGroupStandings(letter, matches, fairPlay);
    const isComplete = standings.length === 4 && standings.every((r) => r.played === 3);
    if (!isComplete) continue;
    const idxByCode: Record<string, number> = {};
    GROUPS[letter].forEach((t, i) => (idxByCode[t.code] = i));
    out[letter] = standings.map((r) => idxByCode[r.code]);
  }
  return out;
}

function asGroupState(orders: Record<string, number[]>): Record<string, { order: number[] }> {
  const out: Record<string, { order: number[] }> = {};
  for (const [k, v] of Object.entries(orders)) out[k] = { order: v };
  return out;
}

/** Knockout slot keys in resolution order (R32 first, then later rounds in feed order). */
export const KO_SLOT_KEYS = [
  "r32l_0", "r32l_1", "r32l_2", "r32l_3", "r32l_4", "r32l_5", "r32l_6", "r32l_7",
  "r32r_0", "r32r_1", "r32r_2", "r32r_3", "r32r_4", "r32r_5", "r32r_6", "r32r_7",
  "r16l_0", "r16l_1", "r16l_2", "r16l_3", "r16r_0", "r16r_1", "r16r_2", "r16r_3",
  "qfl_0", "qfl_1", "qfr_0", "qfr_1",
  "sfl_0", "sfr_0",
  "final",
] as const;

export type KoSlotKey = (typeof KO_SLOT_KEYS)[number];

export interface SlotState {
  key: KoSlotKey;
  team1: string | null;
  team2: string | null;
  score1: number | null;
  score2: number | null;
  /** Winner team code, set when match is FINISHED and a winner exists (incl. penalties). */
  winner: string | null;
  /** FD-style stage label (R32 / R16 / QF / SF / FINAL). */
  stage: "R32" | "R16" | "QF" | "SF" | "FINAL";
  /** True when the slot maps to the third-place playoff match. Always false here — third-place is not in the slot tree. */
  isThirdPlace: false;
}

function stageForKey(key: string): "R32" | "R16" | "QF" | "SF" | "FINAL" {
  if (key.startsWith("r32")) return "R32";
  if (key.startsWith("r16")) return "R16";
  if (key.startsWith("qf")) return "QF";
  if (key.startsWith("sf")) return "SF";
  return "FINAL";
}

/**
 * Find a FINISHED knockout match in the list matching the slot's team pair,
 * normalizing FIFA-vs-FD code aliases. Returns the 90-MINUTE goals (the score
 * the exact/toto bet is judged on) plus the true winner. When 90' was a draw
 * (extra-time- or shootout-decided), the winner comes from the explicit feed
 * `winner` first, then the penalty-shootout score — so the bracket advances the
 * real qualifier even for an ET win with no shootout.
 *
 * Neither ET nor shootout goals are EVER added to score1/score2 — that would
 * corrupt the 90' scoreline and inflate top-scorer / best-attack stats. They
 * influence only `winner`.
 */
function findMatchForPair(
  team1: string,
  team2: string,
  matches: FinishedMatch[],
): { score1: number | null; score2: number | null; winner: string | null } {
  const m = matches.find(
    (x) =>
      (x.homeTla === team1 && x.awayTla === team2) ||
      (x.homeTla === team2 && x.awayTla === team1),
  );
  if (!m) return { score1: null, score2: null, winner: null };
  const s1 = m.homeTla === team1 ? m.homeGoals : m.awayGoals;
  const s2 = m.homeTla === team1 ? m.awayGoals : m.homeGoals;
  let winner: string | null = null;
  if (s1 > s2) winner = team1;
  else if (s2 > s1) winner = team2;
  else {
    // 90' draw → decided in extra time or on penalties. Prefer the explicit feed
    // winner (covers an ET win with NO shootout, where there's no penalty score
    // to read); fall back to the recorded shootout score.
    if (m.winner === "HOME_TEAM" || m.winner === "AWAY_TEAM") {
      const wCode = m.winner === "HOME_TEAM" ? m.homeTla : m.awayTla;
      winner = wCode === team1 ? team1 : wCode === team2 ? team2 : null;
    }
    if (!winner) {
      const p1 = m.homeTla === team1 ? (m.homePenalties ?? null) : (m.awayPenalties ?? null);
      const p2 = m.homeTla === team1 ? (m.awayPenalties ?? null) : (m.homePenalties ?? null);
      if (p1 !== null && p2 !== null && p1 !== p2) {
        winner = p1 > p2 ? team1 : team2;
      }
    }
  }
  return { score1: s1, score2: s2, winner };
}

/**
 * Resolve the full knockout tree state from finished matches.
 *
 * - Groups not yet complete → their slots resolve to null teams.
 * - Best-thirds qualifiers not resolved → 3rd-place slots use the "?" sentinel
 *   group letter so `resolveGroupSlot` returns null.
 * - R16+ chains resolve from previously-computed winners (cascade).
 */
export function resolveKnockoutTree(
  matches: FinishedMatch[],
  thirdsOverride?: string[] | null,
  fairPlay?: Record<string, number>,
  /**
   * R16→Final progression map. Defaults to `LATER_FEEDERS` (the legacy map the
   * pre-tournament simulation tree + advancement scoring use). The real-data
   * tree, its scorer and locks pass `LIVE_FEEDERS` (the official FIFA bracket).
   */
  feeders: Record<string, [string, string]> = LATER_FEEDERS,
): Record<KoSlotKey, SlotState> {
  const groupOrders = computeGroupOrders(matches, fairPlay);
  const groupState = asGroupState(groupOrders);

  // Decide on the third-place qualifier set.
  let assignment: ThirdsAssignment;
  if (thirdsOverride && thirdsOverride.length === 8) {
    assignment = getThirdsAssignment(thirdsOverride).assignment ?? DEFAULT_ASSIGNMENT;
  } else {
    const ranking = rankBestThirds(extractThirds(matches, fairPlay));
    if (ranking.qualifiedGroups.length === 8) {
      assignment = getThirdsAssignment(ranking.qualifiedGroups).assignment ?? DEFAULT_ASSIGNMENT;
    } else {
      // No best-thirds yet → mark 3rd-place slots with "?" so resolveGroupSlot returns null.
      assignment = { A: "?", B: "?", D: "?", E: "?", G: "?", I: "?", K: "?", L: "?" };
    }
  }

  const r32Matchups = buildR32Matchups(assignment);
  const out: Record<string, SlotState> = {};

  for (const key of KO_SLOT_KEYS) {
    let team1: string | null = null;
    let team2: string | null = null;
    if (key in r32Matchups) {
      const { h, a } = r32Matchups[key];
      team1 = resolveGroupSlot(h, groupState);
      team2 = resolveGroupSlot(a, groupState);
    } else if (key in feeders) {
      const [f1, f2] = feeders[key];
      team1 = out[f1]?.winner ?? null;
      team2 = out[f2]?.winner ?? null;
    }
    const { score1, score2, winner } =
      team1 && team2
        ? findMatchForPair(team1, team2, matches)
        : { score1: null, score2: null, winner: null };
    out[key] = {
      key: key as KoSlotKey,
      team1,
      team2,
      score1,
      score2,
      winner,
      stage: stageForKey(key),
      isThirdPlace: false,
    };
  }

  return out as Record<KoSlotKey, SlotState>;
}

/**
 * Index actual finished knockout matches by slot key so the live scorer can
 * pair each user's prediction (stored by slot key) with the matching real
 * result. Returns `{ slotKey: { score1, score2, winner } }` for FINISHED slots
 * only — slots whose teams aren't resolved yet are omitted.
 *
 * **Order convention.** A user's `knockoutTree[slot]` stores `{score1, score2}`
 * in the bracket's nominal home/away order (team1 / team2 of the slot).
 * `findMatchForPair` normalizes the actual match home/away to that same order.
 * No further flip needed at scoring time.
 */
export function indexKnockoutResultsBySlot(
  matches: FinishedMatch[],
  thirdsOverride?: string[] | null,
): Record<string, { score1: number; score2: number; winner: string | null; stage: SlotState["stage"] }> {
  const tree = resolveKnockoutTree(matches, thirdsOverride);
  const out: Record<string, { score1: number; score2: number; winner: string | null; stage: SlotState["stage"] }> = {};
  for (const slot of Object.values(tree)) {
    if (slot.score1 === null || slot.score2 === null) continue;
    out[slot.key] = {
      score1: slot.score1,
      score2: slot.score2,
      winner: slot.winner,
      stage: slot.stage,
    };
  }
  return out;
}

/** Minimal match shape for kickoff lookup — includes scheduled (un-played) matches. */
export interface ScheduleMatch {
  homeTla: string;
  awayTla: string;
  date: string;
  status?: string | null;
}

/**
 * Kickoff time + status for the real match that fills a resolved knockout slot.
 *
 * `tree` is the output of `resolveKnockoutTree` (so callers resolve once and
 * reuse). `schedule` is the FULL match list including not-yet-played matches
 * (e.g. /api/matches), used to find the upcoming match's date. Returns null
 * when the slot's teams aren't resolved yet (→ the slot is not yet openable)
 * or no scheduled match exists for the pair.
 *
 * The Tree-2 per-match lock is then `date − match_prediction_lock_before_minutes`
 * (default 30 → 30 min before kickoff); the slot reveals to opponents at`date`.
 */
export function findKickoffForSlot(
  slotKey: KoSlotKey | "third_place",
  tree: Record<KoSlotKey, SlotState>,
  schedule: ScheduleMatch[],
  thirdPlaceTeams?: { team1: string | null; team2: string | null } | null,
): { date: string; status: string | null } | null {
  let team1: string | null = null;
  let team2: string | null = null;
  if (slotKey === "third_place") {
    team1 = thirdPlaceTeams?.team1 ?? null;
    team2 = thirdPlaceTeams?.team2 ?? null;
  } else {
    const slot = tree[slotKey];
    team1 = slot?.team1 ?? null;
    team2 = slot?.team2 ?? null;
  }
  if (!team1 || !team2) return null;
  const m = schedule.find(
    (x) =>
      (x.homeTla === team1 && x.awayTla === team2) ||
      (x.homeTla === team2 && x.awayTla === team1),
  );
  if (!m) return null;
  return { date: m.date, status: m.status ?? null };
}

/**
 * Separate path for the third-place play-off. The bracket tree doesn't have
 * a slot for it (it's outside the main knockout chain), but users can predict
 * it via a dedicated `third_place` key in `knockoutTree`. Look up the actual
 * THIRD_PLACE match if present.
 */
export function findThirdPlaceMatch(
  matches: FinishedMatch[],
): { score1: number; score2: number; winner: string | null; team1: string; team2: string } | null {
  const m = matches.find(
    (x) => x.stage === "THIRD_PLACE" || x.stage === "THIRD",
  );
  if (!m) return null;
  let winner: string | null = null;
  if (m.homeGoals > m.awayGoals) winner = m.homeTla;
  else if (m.awayGoals > m.homeGoals) winner = m.awayTla;
  else if (m.homePenalties != null && m.awayPenalties != null && m.homePenalties !== m.awayPenalties) {
    winner = m.homePenalties > m.awayPenalties ? m.homeTla : m.awayTla;
  }
  return {
    team1: m.homeTla,
    team2: m.awayTla,
    score1: m.homeGoals,
    score2: m.awayGoals,
    winner,
  };
}
