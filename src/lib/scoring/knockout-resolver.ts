// ============================================================================
// WC2026 — Knockout slot resolver (shared by live bracket + scoring engine)
//
// Given the list of finished matches, computes the real bracket state: which
// teams currently occupy each KO slot (r32l_0 … final) and the result/winner
// of each match. Used by `live-scorer` to map each FINISHED knockout match
// back to its bracket slot so user predictions for that slot can be scored.
// ============================================================================

import { GROUPS, GROUP_LETTERS } from "@/lib/tournament/groups";
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

function computeGroupStandings(
  groupLetter: string,
  matches: FinishedMatch[],
): GroupRow[] {
  const teams = GROUPS[groupLetter] || [];
  const rows: Record<string, GroupRow> = {};
  for (const t of teams) {
    rows[t.code] = {
      code: t.code,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      pts: 0,
    };
  }
  for (const m of matches) {
    if (normalizeGroupLetter(m.group) !== groupLetter) continue;
    const home = rows[m.homeTla];
    const away = rows[m.awayTla];
    if (!home || !away) continue;
    home.played += 1;
    away.played += 1;
    home.gf += m.homeGoals;
    home.ga += m.awayGoals;
    away.gf += m.awayGoals;
    away.ga += m.homeGoals;
    if (m.homeGoals > m.awayGoals) {
      home.wins += 1;
      home.pts += 3;
      away.losses += 1;
    } else if (m.homeGoals < m.awayGoals) {
      away.wins += 1;
      away.pts += 3;
      home.losses += 1;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.pts += 1;
      away.pts += 1;
    }
  }
  for (const r of Object.values(rows)) r.gd = r.gf - r.ga;
  return Object.values(rows).sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.code.localeCompare(b.code),
  );
}

/** Each group's 3rd-placed team, formatted for the best-thirds ranker. */
function extractThirds(matches: FinishedMatch[]): ThirdsInputRow[] {
  const out: ThirdsInputRow[] = [];
  for (const letter of GROUP_LETTERS) {
    const standings = computeGroupStandings(letter, matches);
    const third = standings[2];
    if (!third) continue;
    out.push({
      group: letter,
      team_code: third.code,
      played: third.played,
      points: third.pts,
      goal_difference: third.gd,
      goals_for: third.gf,
    });
  }
  return out;
}

/**
 * Return per-group team-index orderings, but only for groups whose 6 matches
 * are all FINISHED (each team played 3). Groups with incomplete play are
 * omitted, so downstream slot resolution returns null for those positions.
 */
export function computeGroupOrders(matches: FinishedMatch[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const letter of GROUP_LETTERS) {
    const standings = computeGroupStandings(letter, matches);
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
 * normalizing FIFA-vs-FD code aliases. Returns the result + computed winner
 * (handles penalty shootouts when both teams provide pen scores).
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
): Record<KoSlotKey, SlotState> {
  const groupOrders = computeGroupOrders(matches);
  const groupState = asGroupState(groupOrders);

  // Decide on the third-place qualifier set.
  let assignment: ThirdsAssignment;
  if (thirdsOverride && thirdsOverride.length === 8) {
    assignment = getThirdsAssignment(thirdsOverride).assignment ?? DEFAULT_ASSIGNMENT;
  } else {
    const ranking = rankBestThirds(extractThirds(matches));
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
    } else if (key in LATER_FEEDERS) {
      const [f1, f2] = LATER_FEEDERS[key];
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
  return {
    team1: m.homeTla,
    team2: m.awayTla,
    score1: m.homeGoals,
    score2: m.awayGoals,
    winner,
  };
}
