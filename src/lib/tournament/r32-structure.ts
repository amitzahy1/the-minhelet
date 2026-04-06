// ============================================================================
// WC2026 — Round of 32 Structure (from FIFA official regulations)
//
// 16 R32 matches:
// - 8 matches: Group Winner vs 3rd-place team (variable, depends on Annex C)
// - 4 matches: Group Winner vs Runner-up (fixed)
// - 4 matches: Runner-up vs Runner-up (fixed)
//
// Source: FIFA World Cup 2026 Regulations, Annex C
// https://digitalhub.fifa.com/m/636f5c9c6f29771f/original/FWC2026_regulations_EN.pdf
// ============================================================================

export interface R32Match {
  matchNumber: number;  // FIFA match number (73-88)
  home: string;         // e.g. "1A" (winner of A), "2B" (runner-up of B), "3rd" (variable)
  away: string;         // same format, or "3rd_X" where X is resolved from Annex C
  type: "W_vs_3rd" | "W_vs_RU" | "RU_vs_RU";
  // For W_vs_3rd matches: which groups the 3rd-place team could come from
  possibleThirdFrom?: string[];
}

/**
 * Fixed R32 structure — the 16 matches with their slots.
 * For "W_vs_3rd" matches, the actual 3rd-place team depends on Annex C.
 */
export const R32_MATCHES: R32Match[] = [
  // Match 73-88 as per FIFA schedule
  { matchNumber: 73, home: "2A", away: "2B", type: "RU_vs_RU" },
  { matchNumber: 74, home: "1E", away: "3rd", type: "W_vs_3rd", possibleThirdFrom: ["A","B","C","D","F"] },
  { matchNumber: 75, home: "1F", away: "2C", type: "W_vs_RU" },
  { matchNumber: 76, home: "1C", away: "2F", type: "W_vs_RU" },
  { matchNumber: 77, home: "1I", away: "3rd", type: "W_vs_3rd", possibleThirdFrom: ["C","D","F","G","H"] },
  { matchNumber: 78, home: "2E", away: "2I", type: "RU_vs_RU" },
  { matchNumber: 79, home: "1A", away: "3rd", type: "W_vs_3rd", possibleThirdFrom: ["C","E","F","H","I"] },
  { matchNumber: 80, home: "1L", away: "3rd", type: "W_vs_3rd", possibleThirdFrom: ["E","H","I","J","K"] },
  { matchNumber: 81, home: "1D", away: "3rd", type: "W_vs_3rd", possibleThirdFrom: ["B","E","F","I","J"] },
  { matchNumber: 82, home: "1G", away: "3rd", type: "W_vs_3rd", possibleThirdFrom: ["A","E","H","I","J"] },
  { matchNumber: 83, home: "2K", away: "2L", type: "RU_vs_RU" },
  { matchNumber: 84, home: "1H", away: "2J", type: "W_vs_RU" },
  { matchNumber: 85, home: "1B", away: "3rd", type: "W_vs_3rd", possibleThirdFrom: ["E","F","G","I","J"] },
  { matchNumber: 86, home: "1J", away: "2H", type: "W_vs_RU" },
  { matchNumber: 87, home: "1K", away: "3rd", type: "W_vs_3rd", possibleThirdFrom: ["D","E","I","J","L"] },
  { matchNumber: 88, home: "2D", away: "2G", type: "RU_vs_RU" },
];

/**
 * The 8 group winners that face 3rd-place teams.
 * The other 4 (C, F, H, J) face runners-up.
 */
export const WINNERS_VS_THIRD = ["E", "I", "A", "L", "D", "G", "B", "K"];

/**
 * Fixed matchups (not dependent on Annex C):
 * - 4 Winner vs Runner-up: 1F-2C, 1C-2F, 1H-2J, 1J-2H
 * - 4 Runner-up vs Runner-up: 2A-2B, 2E-2I, 2K-2L, 2D-2G
 */
export const FIXED_MATCHUPS = {
  winnerVsRunnerup: [
    { winner: "F", runnerup: "C" },
    { winner: "C", runnerup: "F" },
    { winner: "H", runnerup: "J" },
    { winner: "J", runnerup: "H" },
  ],
  runnerupVsRunnerup: [
    { ru1: "A", ru2: "B" },
    { ru1: "E", ru2: "I" },
    { ru1: "K", ru2: "L" },
    { ru1: "D", ru2: "G" },
  ],
};

/**
 * R16 bracket structure — which R32 matches feed into which R16 match.
 * (Winners of these R32 matches play each other in R16)
 */
export const R16_FEEDERS: { match: number; feeder1: number; feeder2: number }[] = [
  { match: 89, feeder1: 73, feeder2: 74 },  // Winner of M73 vs Winner of M74
  { match: 90, feeder1: 75, feeder2: 76 },  // Winner of M75 vs Winner of M76
  { match: 91, feeder1: 77, feeder2: 78 },  // Winner of M77 vs Winner of M78
  { match: 92, feeder1: 79, feeder2: 80 },  // Winner of M79 vs Winner of M80
  { match: 93, feeder1: 81, feeder2: 82 },  // Winner of M81 vs Winner of M82
  { match: 94, feeder1: 83, feeder2: 84 },  // Winner of M83 vs Winner of M84
  { match: 95, feeder1: 85, feeder2: 86 },  // Winner of M85 vs Winner of M86
  { match: 96, feeder1: 87, feeder2: 88 },  // Winner of M87 vs Winner of M88
];

/**
 * QF bracket structure
 */
export const QF_FEEDERS: { match: number; feeder1: number; feeder2: number }[] = [
  { match: 97, feeder1: 89, feeder2: 90 },
  { match: 98, feeder1: 91, feeder2: 92 },
  { match: 99, feeder1: 93, feeder2: 94 },
  { match: 100, feeder1: 95, feeder2: 96 },
];

/**
 * SF bracket structure
 */
export const SF_FEEDERS: { match: number; feeder1: number; feeder2: number }[] = [
  { match: 101, feeder1: 97, feeder2: 98 },
  { match: 102, feeder1: 99, feeder2: 100 },
];

/**
 * Final
 */
export const FINAL_FEEDERS = { match: 103, feeder1: 101, feeder2: 102 };

/**
 * Third-place match
 */
export const THIRD_PLACE_FEEDERS = { match: 104, feeder1: 101, feeder2: 102 }; // losers of SF

/**
 * Resolve a slot like "1A" or "2B" to actual team code based on group standings.
 * @param slot - e.g. "1A" (winner of group A), "2B" (runner-up of group B)
 * @param groupOrders - map of group letter to ordered team indices
 * @param groupTeamCodes - map of group letter to team codes array
 */
export function resolveSlot(
  slot: string,
  groupOrders: Record<string, number[]>,
  groupTeamCodes: Record<string, string[]>
): string | null {
  const position = parseInt(slot[0]) - 1; // "1" -> 0, "2" -> 1, "3" -> 2
  const groupLetter = slot[1];

  const order = groupOrders[groupLetter];
  const codes = groupTeamCodes[groupLetter];

  if (!order || !codes) return null;
  const teamIndex = order[position];
  return codes[teamIndex] ?? null;
}
