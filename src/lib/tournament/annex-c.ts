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
// ⚠️  Only one scenario is encoded today (the default hardcoded matchup
//    inherited from knockout-derivation.ts). The remaining 494 scenarios
//    need to be digitized from the official FIFA regulations PDF:
//    https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf
//    Until then, `resolveAnnexC` returns null for unknown combinations —
//    callers should fall back to the admin manual override.
// ============================================================================

export type ThirdsAssignment = Record<string, string>;

/**
 * Default scenario (qualifying groups: B, C, D, E, F, H, I, J).
 * Derived from the legacy hardcoded R32 matchups in knockout-derivation.ts.
 */
export const DEFAULT_ASSIGNMENT: ThirdsAssignment = {
  A: "C",
  B: "E",
  D: "B",
  E: "D",
  G: "H",
  I: "F",
  K: "J",
  L: "I",
};

export const DEFAULT_QUALIFIED_GROUPS = ["B", "C", "D", "E", "F", "H", "I", "J"];

/** Group letters of the 8 winners that face a 3rd-placed team. */
export const WINNER_SLOTS_VS_THIRD = ["A", "B", "D", "E", "G", "I", "K", "L"];

/**
 * Lookup keyed by the sorted 8-letter qualifier combination.
 * Extend this as the Annex C rows get digitized.
 */
const ANNEX_C_TABLE: Record<string, ThirdsAssignment> = {
  [DEFAULT_QUALIFIED_GROUPS.join("")]: DEFAULT_ASSIGNMENT,
};

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
 * Deterministic fallback when Annex C isn't encoded: assigns each winner
 * slot to a qualifier group by stable sort order. Not FIFA-official, but
 * keeps the bracket renderable. Admin override is the preferred path.
 */
export function fallbackAssignment(qualifiedGroups: string[]): ThirdsAssignment | null {
  const key = normalizeKey(qualifiedGroups);
  if (!key || key.length !== 8) return null;
  const qualifiers = key.split("").sort();
  const slots = [...WINNER_SLOTS_VS_THIRD].sort();

  // Avoid assigning a slot to its own group (can't play yourself).
  const out: ThirdsAssignment = {};
  const used = new Set<string>();
  for (const slot of slots) {
    const pick = qualifiers.find((g) => g !== slot && !used.has(g));
    if (!pick) return null;
    out[slot] = pick;
    used.add(pick);
  }
  // If any qualifier is left unassigned (happens when the only remaining
  // qualifier matches the last unfilled slot), swap with a previous pick.
  const unused = qualifiers.find((g) => !used.has(g));
  if (unused) {
    const victimSlot = slots.find((s) => s !== unused && out[s] !== unused);
    if (victimSlot) {
      const displaced = out[victimSlot];
      out[victimSlot] = unused;
      // And place the displaced into whichever slot still equals itself.
      const selfSlot = slots.find((s) => s === displaced);
      if (selfSlot) out[selfSlot] = displaced;
    }
  }
  return out;
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
