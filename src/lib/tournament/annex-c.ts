// ============================================================================
// WC2026 — Annex C Resolver
//
// FIFA publishes a lookup table (the "Annex C" of the WC2026 regulations)
// that maps the set of 8 groups whose 3rd-placed teams qualified for R32 to
// a specific matchup assignment — i.e. which group's 3rd plays each of the
// 8 winner-vs-3rd R32 slots.
//
//   8 qualifying groups out of 12  →  C(12, 8) = 495 possible scenarios.
//
// This file encodes the assignment as a lookup keyed by the sorted
// 8-letter combination. For each entry the value is a map:
//
//   { [winnerSlotGroup]: qualifiedGroupOf3rd }
//
// where winnerSlotGroup ∈ { A, B, D, E, G, I, K, L } — the 8 group winners
// that face a 3rd-placed team (the other 4 winners — C, F, H, J — face
// runners-up per the fixed matchups in r32-structure.ts).
//
// ✅ All 495 scenarios are now encoded in `annex-c-table.generated.ts`, parsed
//    from the official FIFA regulations PDF and cross-verified cell-by-cell
//    against the Wikipedia template (3960/3960 cells agree). `resolveAnnexC`
//    returns the official assignment for ANY of the 495 combinations.
//    https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf
// ============================================================================

import { ANNEX_C_TABLE_GENERATED } from "./annex-c-table.generated";

export type ThirdsAssignment = Record<string, string>;

/**
 * Default scenario (qualifying groups: B, C, D, E, F, H, I, J) — FIFA Annexe C
 * Option 155. NB: this is the OFFICIAL assignment; the legacy hardcoded matchup
 * had 1B and 1K swapped (1B→3E / 1K→3J), which was wrong.
 */
export const DEFAULT_ASSIGNMENT: ThirdsAssignment = {
  A: "C",
  B: "J",
  D: "B",
  E: "D",
  G: "H",
  I: "F",
  K: "E",
  L: "I",
};

export const DEFAULT_QUALIFIED_GROUPS = ["B", "C", "D", "E", "F", "H", "I", "J"];

/** Group letters of the 8 winners that face a 3rd-placed team. */
export const WINNER_SLOTS_VS_THIRD = ["A", "B", "D", "E", "G", "I", "K", "L"];

/**
 * Official FIFA WC2026 per-winner-slot candidate sets: the 3rd-placed team facing
 * each winner can ONLY come from one of these groups (FIFA regulations). Every row
 * of the Annex C table must be a perfect matching respecting these sets, and the
 * matcher below uses them as a legal (if not necessarily official) fallback.
 */
export const THIRD_CANDIDATE_SETS: Record<string, string[]> = {
  A: ["C", "E", "F", "H", "I"],
  B: ["E", "F", "G", "I", "J"],
  D: ["B", "E", "F", "I", "J"],
  E: ["A", "B", "C", "D", "F"],
  G: ["A", "E", "H", "I", "J"],
  I: ["C", "D", "F", "G", "H"],
  K: ["D", "E", "I", "J", "L"],
  L: ["E", "H", "I", "J", "K"],
};

/**
 * True iff `assignment` is a legal matching for `qualifiedGroups`: every winner
 * slot gets a distinct qualifying 3rd drawn from that slot's candidate set, and
 * all 8 qualifying groups are used exactly once. Used to validate Annex C rows.
 */
export function isLegalAssignment(
  qualifiedGroups: string[],
  assignment: ThirdsAssignment,
): boolean {
  const key = normalizeKey(qualifiedGroups);
  if (!key || key.length !== 8) return false;
  const qual = new Set(key.split(""));
  const used = new Set<string>();
  for (const slot of WINNER_SLOTS_VS_THIRD) {
    const third = assignment[slot];
    if (!third || !qual.has(third)) return false;
    if (!THIRD_CANDIDATE_SETS[slot]?.includes(third)) return false;
    if (used.has(third)) return false;
    used.add(third);
  }
  return used.size === 8 && [...qual].every((g) => used.has(g));
}

/**
 * Find a legal candidate-set-respecting assignment via backtracking (a perfect
 * bipartite matching of the 8 winner slots to the 8 qualifying 3rds). Slots are
 * processed in a fixed order and candidate groups tried in their declared order,
 * so the result is deterministic. Every one of the 495 combinations admits at
 * least one such matching, so this never returns null for a valid 8-set — but it
 * is NOT guaranteed to equal FIFA's official choice (that's the Annex C table).
 */
function matchCandidateSets(qualifiedGroups: string[]): ThirdsAssignment | null {
  const key = normalizeKey(qualifiedGroups);
  if (!key || key.length !== 8) return null;
  const qual = new Set(key.split(""));
  const out: ThirdsAssignment = {};
  const used = new Set<string>();
  const bt = (i: number): boolean => {
    if (i === WINNER_SLOTS_VS_THIRD.length) return true;
    const slot = WINNER_SLOTS_VS_THIRD[i];
    for (const g of THIRD_CANDIDATE_SETS[slot]) {
      if (qual.has(g) && !used.has(g)) {
        out[slot] = g;
        used.add(g);
        if (bt(i + 1)) return true;
        used.delete(g);
        delete out[slot];
      }
    }
    return false;
  };
  return bt(0) ? out : null;
}

/**
 * Lookup keyed by the sorted 8-letter qualifier combination → official FIFA
 * Annexe C assignment. All 495 combinations are present (see the generated file).
 */
const ANNEX_C_TABLE: Record<string, ThirdsAssignment> = ANNEX_C_TABLE_GENERATED;

/**
 * Return the Annex C third-place assignment for a given set of 8 qualifier
 * group letters, or null when the combination isn't encoded yet.
 *
 * Input order is normalized (sorted + deduped + uppercased).
 */
export function resolveAnnexC(qualifiedGroups: string[]): ThirdsAssignment | null {
  const key = normalizeKey(qualifiedGroups);
  if (!key) return null;
  return ANNEX_C_TABLE[key] ?? null;
}

/**
 * Legal fallback when a combination isn't in the Annex C table: returns a
 * candidate-set-respecting matching (no same-group matchups, every official
 * candidate constraint honoured). Deterministic, but NOT guaranteed to be FIFA's
 * official choice — `getThirdsAssignment` flags these as `isOfficial: false`.
 */
export function fallbackAssignment(qualifiedGroups: string[]): ThirdsAssignment | null {
  return matchCandidateSets(qualifiedGroups);
}

/**
 * Convenience: resolve or fall back, returning `{ assignment, isOfficial }`.
 * `isOfficial` is true only when the combination is covered by the Annex C
 * lookup, not the deterministic fallback.
 */
export function getThirdsAssignment(
  qualifiedGroups: string[],
): { assignment: ThirdsAssignment | null; isOfficial: boolean } {
  const official = resolveAnnexC(qualifiedGroups);
  if (official) return { assignment: official, isOfficial: true };
  return { assignment: fallbackAssignment(qualifiedGroups), isOfficial: false };
}

function normalizeKey(qualifiedGroups: string[]): string | null {
  if (!Array.isArray(qualifiedGroups)) return null;
  const unique = Array.from(new Set(qualifiedGroups.map((g) => String(g).toUpperCase()))).sort();
  return unique.join("");
}
