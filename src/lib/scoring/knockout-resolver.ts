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
  LIVE_FEEDERS,
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

/**
 * Set of teams ELIMINATED from the tournament, derived from finished matches.
 * A team is out when:
 *   - it lost a decided knockout match (the resolved slot's non-winner — this
 *     correctly covers ties decided on penalties, since `winner` already folds
 *     in the shootout), or
 *   - the group stage is complete and it isn't one of the 32 R32 participants.
 *
 * A team ABSENT from this set is still alive (or its fate isn't decided yet) —
 * so before the group stage finishes nothing is marked dead, and an in-progress
 * knockout match keeps both teams alive until a winner is resolved. Uses
 * `LIVE_FEEDERS` (the official bracket) to match the real-data tree.
 */
export function computeEliminatedTeams(matches: FinishedMatch[]): Set<string> {
  const tree = resolveKnockoutTree(matches, null, undefined, LIVE_FEEDERS);
  const eliminated = new Set<string>();
  // Knockout losers — the non-winning side of every decided slot.
  for (const slot of Object.values(tree)) {
    if (slot.winner && slot.team1 && slot.team2) {
      eliminated.add(slot.winner === slot.team1 ? slot.team2 : slot.team1);
    }
  }
  // Group-stage non-qualifiers — only once all 12 groups are decided, otherwise
  // the R32 slots aren't fully resolved and we'd wrongly bury qualifiers.
  const groupStageComplete = Object.keys(computeGroupOrders(matches)).length === 12;
  if (groupStageComplete) {
    const r32Teams = new Set<string>();
    for (const key of KO_SLOT_KEYS) {
      if (!key.startsWith("r32")) continue;
      const s = tree[key];
      if (s.team1) r32Teams.add(s.team1);
      if (s.team2) r32Teams.add(s.team2);
    }
    for (const teams of Object.values(GROUPS)) {
      for (const t of teams) if (!r32Teams.has(t.code)) eliminated.add(t.code);
    }
  }
  return eliminated;
}

// Child slot → the slot it feeds into, in the REAL bracket. Two teams whose
// paths merge at slot S can never both get PAST S, so they can't both reach the
// round that S decides. Built once from LIVE_FEEDERS.
const PARENT_OF: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [parent, [f1, f2]] of Object.entries(LIVE_FEEDERS)) {
    out[f1] = parent;
    out[f2] = parent;
  }
  return out;
})();

export interface ReachableStages {
  r16: number;
  qf: number;
  sf: number;
  final: number;
  champion: number; // 0 or 1
}

/**
 * Collision-aware count of how many of a bettor's per-stage picks can STILL
 * reach each stage, given the REAL (LIVE_FEEDERS) bracket — i.e. points still
 * CATCHABLE, NOT points already banked.
 *
 * Two refinements over a naive "not eliminated" count:
 *  1. COLLISIONS — the official bracket can force two picks to meet before the
 *     round they both predicted, so only one can get there. (Real here: the
 *     pre-tournament bets used LATER_FEEDERS, whose R16 pairings differ.) We
 *     count DISTINCT bracket REGIONS, not picks — the sub-tree funneling into a
 *     single stage slot:
 *       reach R16  ← win your R32 match  → region = the R32 match
 *       reach QF   ← win your R16 match  → region = the R16 match
 *       reach SF   ← win your QF match   → region = the QF match
 *       reach Final← win your SF match   → region = the SF match
 *     Two alive picks sharing a region collapse to 1.
 *  2. ALREADY-REACHED — a team that has ALREADY reached a stage banked those
 *     points; they're no longer "catchable", so that team is excluded from that
 *     stage's count (it still counts toward the deeper stages it hasn't reached).
 *
 * `tree` is a LIVE_FEEDERS-resolved tree. A pick whose bracket position can't be
 * resolved yet degrades to its own unique region (plain not-eliminated count).
 */
export function computeCatchableStages(
  picks: { r16: string[]; qf: string[]; sf: string[]; final: string[]; champion: string },
  tree: Record<KoSlotKey, SlotState>,
  eliminated: Set<string>,
): ReachableStages {
  // team code → its R32 match slot, plus the set of teams that have ALREADY
  // reached each stage (occupy that round's slots).
  const teamToR32: Record<string, string> = {};
  const reachedR16 = new Set<string>();
  const reachedQF = new Set<string>();
  const reachedSF = new Set<string>();
  const reachedFinal = new Set<string>();
  for (const key of KO_SLOT_KEYS) {
    const s = tree[key];
    if (!s) continue;
    if (key.startsWith("r32")) {
      if (s.team1) teamToR32[s.team1] = key;
      if (s.team2) teamToR32[s.team2] = key;
    } else if (key.startsWith("r16")) {
      if (s.team1) reachedR16.add(s.team1);
      if (s.team2) reachedR16.add(s.team2);
    } else if (key.startsWith("qf")) {
      if (s.team1) reachedQF.add(s.team1);
      if (s.team2) reachedQF.add(s.team2);
    } else if (key.startsWith("sf")) {
      if (s.team1) reachedSF.add(s.team1);
      if (s.team2) reachedSF.add(s.team2);
    } else if (key === "final") {
      if (s.team1) reachedFinal.add(s.team1);
      if (s.team2) reachedFinal.add(s.team2);
    }
  }
  const champion = tree["final"]?.winner ?? null;
  // Region id for `team` at a given depth above its R32 match (0=R32 match,
  // 1=R16 match, 2=QF match, 3=SF match). Unknown position → unique per team.
  const regionAt = (team: string, depth: number): string => {
    let region = teamToR32[team];
    if (!region) return `team:${team}`;
    for (let i = 0; i < depth; i++) region = PARENT_OF[region] ?? region;
    return region;
  };
  // Distinct still-catchable regions: alive picks that haven't ALREADY reached
  // this stage (those banked it). A region whose stage team is already decided
  // contributes 0 here — its other teams are eliminated, the reacher is excluded.
  const distinct = (codes: string[], depth: number, reached: Set<string>): number => {
    const regions = new Set<string>();
    for (const t of codes) {
      if (!t || eliminated.has(t) || reached.has(t)) continue;
      regions.add(regionAt(t, depth));
    }
    return regions.size;
  };
  return {
    r16: distinct(picks.r16, 0, reachedR16),
    qf: distinct(picks.qf, 1, reachedQF),
    sf: distinct(picks.sf, 2, reachedSF),
    final: distinct(picks.final, 3, reachedFinal),
    // Champion is catchable while the pick is alive AND hasn't already won it.
    champion: picks.champion && !eliminated.has(picks.champion) && champion !== picks.champion ? 1 : 0,
  };
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
  slotKey: KoSlotKey,
  tree: Record<KoSlotKey, SlotState>,
  schedule: ScheduleMatch[],
): { date: string; status: string | null } | null {
  const slot = tree[slotKey];
  const team1: string | null = slot?.team1 ?? null;
  const team2: string | null = slot?.team2 ?? null;
  if (!team1 || !team2) return null;
  const m = schedule.find(
    (x) =>
      (x.homeTla === team1 && x.awayTla === team2) ||
      (x.homeTla === team2 && x.awayTla === team1),
  );
  if (!m) return null;
  return { date: m.date, status: m.status ?? null };
}

// FD/app stage labels → the slot tree's stage buckets (THIRD_PLACE excluded —
// it has no slot).
const FIXTURE_STAGE_TO_SLOT_STAGE: Record<string, SlotState["stage"]> = {
  LAST_32: "R32", ROUND_OF_32: "R32", R32: "R32",
  LAST_16: "R16", ROUND_OF_16: "R16", R16: "R16",
  QUARTER_FINALS: "QF", QF: "QF",
  SEMI_FINALS: "SF", SF: "SF",
  FINAL: "FINAL",
};

/** Minimal mutable fixture shape (matches /api/matches' Match). */
export interface FillableKoFixture {
  stage?: string | null;
  homeTla: string;
  awayTla: string;
  homeTeam?: string;
  awayTeam?: string;
}

/**
 * Fill TBD sides of knockout FIXTURES from the resolved bracket TREE, so the
 * schedule (and everything downstream of it: kickoff lookup → prediction-lock
 * rows → saveability of picks) shows the real matchup even when the feed
 * hasn't assigned the teams. Real case (2026-07-08): FD published the SUI–COL
 * R16 shootout with winner:null, so FD ALSO left the ARG–SUI QF fixture as
 * TBD-vs-TBD — while our tree (via koWinnerFromScore) already knew both teams.
 *
 * Per stage: fixtures already carrying both teams anchor to their slot by team
 * pair; a fixture with ONE known side fills from the resolved slot containing
 * that team; fully-TBD fixtures are filled only when exactly one of them and
 * exactly one unconsumed resolved slot remain (any wider mapping would be a
 * guess). Mutates `fixtures` in place; returns the number of fixtures filled.
 */
export function fillKnockoutFixturesFromTree(
  fixtures: FillableKoFixture[],
  tree: Record<KoSlotKey, SlotState>,
): number {
  const isTbd = (t: string | null | undefined) => !t || t === "TBD";
  const pairEq = (s: SlotState, a: string, b: string) =>
    (s.team1 === a && s.team2 === b) || (s.team1 === b && s.team2 === a);
  const setSide = (f: FillableKoFixture, side: "home" | "away", code: string) => {
    if (side === "home") { f.homeTla = code; f.homeTeam = code; }
    else { f.awayTla = code; f.awayTeam = code; }
  };

  let filled = 0;
  const stages: SlotState["stage"][] = ["R32", "R16", "QF", "SF", "FINAL"];
  for (const stage of stages) {
    const remaining = KO_SLOT_KEYS
      .map((k) => tree[k])
      .filter((s) => s && s.stage === stage && s.team1 && s.team2);
    const fx = fixtures.filter(
      (f) => FIXTURE_STAGE_TO_SLOT_STAGE[(f.stage || "").toUpperCase()] === stage,
    );

    // Pass 1 — fixtures with both teams anchor (consume) their slot.
    const pending: FillableKoFixture[] = [];
    for (const f of fx) {
      if (!isTbd(f.homeTla) && !isTbd(f.awayTla)) {
        const i = remaining.findIndex((s) => pairEq(s, f.homeTla, f.awayTla));
        if (i >= 0) remaining.splice(i, 1);
      } else {
        pending.push(f);
      }
    }

    // Pass 2 — one known side: its slot names the opponent.
    const fullyTbd: FillableKoFixture[] = [];
    for (const f of pending) {
      const known = !isTbd(f.homeTla) ? f.homeTla : !isTbd(f.awayTla) ? f.awayTla : null;
      if (!known) { fullyTbd.push(f); continue; }
      const i = remaining.findIndex((s) => s.team1 === known || s.team2 === known);
      if (i < 0) continue;
      const s = remaining.splice(i, 1)[0];
      const opp = (s.team1 === known ? s.team2 : s.team1) as string;
      setSide(f, isTbd(f.homeTla) ? "home" : "away", opp);
      filled++;
    }

    // Pass 3 — fully TBD: only the unambiguous one-fixture-one-slot case.
    if (fullyTbd.length === 1 && remaining.length === 1) {
      const [f] = fullyTbd;
      const [s] = remaining;
      setSide(f, "home", s.team1 as string);
      setSide(f, "away", s.team2 as string);
      filled++;
    }
  }
  return filled;
}
