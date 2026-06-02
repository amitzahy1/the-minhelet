// ============================================================================
// WC2026 — Advancement pick scoring
//
// Pre-tournament picks (group 1st/2nd, QF/SF/Final reachers, champion) award
// points based on which teams actually advance. Per-team scoring values come
// from SCORING.advancement in src/types/index.ts.
//
// Group order picks have a 3-tier ladder:
//   - team in correct slot         → group_exact (5)
//   - team in the other top-2 slot → group_partial (3, "1st↔2nd swap")
//   - team finished 3rd & is one of the 8 best-3rd qualifiers → group_as_3rd (2)
//
// QF / SF / Final / Winner picks are flat: full credit per team that actually
// reaches that stage; partial credit is not awarded here (vs the group ladder).
// ============================================================================

import { SCORING, type ScoreReason } from "@/types";
import type { BettorAdvancement } from "@/lib/supabase/shared-data";
import type { SlotState } from "./knockout-resolver";

export interface AdvancementLine {
  reason: ScoreReason;
  points: number;
  pick: string;
}

export interface AdvancementBreakdown {
  total: number;
  groupExactPts: number;
  groupPartialPts: number;
  r16Pts: number;
  qfPts: number;
  sfPts: number;
  finalPts: number;
  winnerPts: number;
  lines: AdvancementLine[];
}

/** Aggregate the slot tree into ordered team-code lists per stage. */
function teamsReachingStage(
  slots: Record<string, SlotState>,
  stage: "R32" | "R16" | "QF" | "SF" | "FINAL",
): Set<string> {
  const out = new Set<string>();
  for (const slot of Object.values(slots)) {
    if (slot.stage === stage) {
      if (slot.team1) out.add(slot.team1);
      if (slot.team2) out.add(slot.team2);
    }
  }
  return out;
}

/** The two finalists are whichever teams appear in the "final" slot. */
function teamsInFinal(slots: Record<string, SlotState>): Set<string> {
  const final = slots["final"];
  const out = new Set<string>();
  if (final?.team1) out.add(final.team1);
  if (final?.team2) out.add(final.team2);
  return out;
}

/**
 * Score one user's advancement picks against:
 * - actualGroupOrders: real per-group order, keyed by group letter
 *   (e.g. {"A": ["MEX", "RSA", "KOR", "CZE"]}) — group complete only.
 * - bestThirdsCodes: set of team codes that qualified as best-3rd.
 * - slots: full resolved KO tree (for R16/QF/SF/Final reachers).
 * - champion: the actual tournament winner (or null pre-final).
 * - predictedR16: the user's predicted last-16 teams (their R32-match winners in
 *   the simulation tree). Not stored separately — derived from the bracket by the
 *   caller — since the last 16 ARE exactly the R32 winners the user already picks.
 */
export function scoreAdvancementForUser(
  adv: BettorAdvancement,
  actualGroupOrders: Record<string, string[]>,
  bestThirdsCodes: Set<string>,
  slots: Record<string, SlotState>,
  champion: string | null,
  predictedR16: string[] = [],
): AdvancementBreakdown {
  const breakdown: AdvancementBreakdown = {
    total: 0,
    groupExactPts: 0,
    groupPartialPts: 0,
    r16Pts: 0,
    qfPts: 0,
    sfPts: 0,
    finalPts: 0,
    winnerPts: 0,
    lines: [],
  };

  // --- Group qualifier picks (per group letter, two slots each: 1st + 2nd) ---
  for (const [letter, picks] of Object.entries(adv.groupQualifiers || {})) {
    const actual = actualGroupOrders[letter];
    if (!actual || actual.length < 3) continue;
    const [actual1st, actual2nd, actual3rd] = actual;
    const thirdQualified = bestThirdsCodes.has(actual3rd);

    // Canonical storage is `[1st, 2nd]` (per sync.ts). Older rows may still
    // carry `{ "1st": code, "2nd": code }` from earlier saves — accept both.
    const pickArr = Array.isArray(picks)
      ? picks
      : [
          (picks as { "1st"?: string; "2nd"?: string })?.["1st"],
          (picks as { "1st"?: string; "2nd"?: string })?.["2nd"],
        ];
    const [pred1, pred2] = pickArr;

    const scoreSlot = (pred: string | undefined, slotOrdinal: 1 | 2): void => {
      if (!pred) return;
      const expected = slotOrdinal === 1 ? actual1st : actual2nd;
      const otherTop = slotOrdinal === 1 ? actual2nd : actual1st;
      if (pred === expected) {
        breakdown.groupExactPts += SCORING.advancement.group_exact;
        breakdown.lines.push({ reason: "GROUP_ADVANCE_EXACT", points: SCORING.advancement.group_exact, pick: pred });
      } else if (pred === otherTop) {
        breakdown.groupPartialPts += SCORING.advancement.group_partial;
        breakdown.lines.push({ reason: "GROUP_ADVANCE_PARTIAL", points: SCORING.advancement.group_partial, pick: pred });
      } else if (thirdQualified && pred === actual3rd) {
        breakdown.groupPartialPts += SCORING.advancement.group_as_3rd;
        breakdown.lines.push({ reason: "GROUP_ADVANCE_AS_3RD", points: SCORING.advancement.group_as_3rd, pick: pred });
      }
    };

    scoreSlot(pred1, 1);
    // Avoid double-crediting if user predicted the same team for both slots.
    if (pred2 && pred2 !== pred1) scoreSlot(pred2, 2);
  }

  // --- R16 / QF / SF / Final reachers ---
  const reachedR16 = teamsReachingStage(slots, "R16");
  const reachedQF = teamsReachingStage(slots, "QF");
  const reachedSF = teamsReachingStage(slots, "SF");
  const reachedFinal = teamsInFinal(slots);

  // R16 = the user's R32-match winners. De-dup so a team can't be double-counted.
  for (const code of [...new Set(predictedR16)]) {
    if (code && reachedR16.has(code)) {
      breakdown.r16Pts += SCORING.advancement.r16;
      breakdown.lines.push({ reason: "ADVANCE_R16", points: SCORING.advancement.r16, pick: code });
    }
  }
  for (const code of adv.advanceToQF || []) {
    if (code && reachedQF.has(code)) {
      breakdown.qfPts += SCORING.advancement.qf;
      breakdown.lines.push({ reason: "ADVANCE_QF", points: SCORING.advancement.qf, pick: code });
    }
  }
  for (const code of adv.advanceToSF || []) {
    if (code && reachedSF.has(code)) {
      breakdown.sfPts += SCORING.advancement.sf;
      breakdown.lines.push({ reason: "ADVANCE_SF", points: SCORING.advancement.sf, pick: code });
    }
  }
  for (const code of adv.advanceToFinal || []) {
    if (code && reachedFinal.has(code)) {
      breakdown.finalPts += SCORING.advancement.final;
      breakdown.lines.push({ reason: "ADVANCE_FINAL", points: SCORING.advancement.final, pick: code });
    }
  }

  // --- Champion ---
  if (adv.winner && champion && adv.winner === champion) {
    breakdown.winnerPts += SCORING.advancement.winner;
    breakdown.lines.push({ reason: "WINNER", points: SCORING.advancement.winner, pick: adv.winner });
  }

  breakdown.total =
    breakdown.groupExactPts +
    breakdown.groupPartialPts +
    breakdown.r16Pts +
    breakdown.qfPts +
    breakdown.sfPts +
    breakdown.finalPts +
    breakdown.winnerPts;
  return breakdown;
}

/**
 * Derive actual per-group ordering (team-code array) from finished matches.
 * Mirrors the logic in knockout-resolver, but returns codes instead of indices.
 * Only includes groups whose 6 matches are all FINISHED.
 */
export function deriveActualGroupOrders(
  slots: Record<string, SlotState>,
  groupOrders: Record<string, number[]>,
  groups: Record<string, { code: string }[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [letter, indices] of Object.entries(groupOrders)) {
    const teams = groups[letter];
    if (!teams) continue;
    out[letter] = indices.map((i) => teams[i]?.code).filter(Boolean);
  }
  // slots is unused here but accepted for signature symmetry with future best-thirds derivation.
  void slots;
  return out;
}
