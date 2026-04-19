// ============================================================================
// WC2026 — Shared knockout team derivation
// Maps slot references (A1, B2, C3) and match keys to actual team codes
// based on a user's group predictions + knockout winners.
// ============================================================================

import { GROUPS } from "./groups";

export interface GroupStateMinimal {
  order: number[];
}

export interface KOStateMinimal {
  score1: number | null;
  score2: number | null;
  winner: string | null;
}

// FIFA-prescribed R32 matchups. h/a use slot notation:
//   A1 = winner of group A, A2 = runner-up, A3 = 3rd (Annex C resolved externally).
export const R32_MATCHUPS: Record<string, { h: string; a: string }> = {
  r32l_0: { h: "A2", a: "B2" },
  r32l_1: { h: "E1", a: "D3" },
  r32l_2: { h: "F1", a: "C2" },
  r32l_3: { h: "C1", a: "F2" },
  r32l_4: { h: "A1", a: "C3" },
  r32l_5: { h: "H1", a: "J2" },
  r32l_6: { h: "B1", a: "E3" },
  r32l_7: { h: "D2", a: "G2" },
  r32r_0: { h: "I1", a: "F3" },
  r32r_1: { h: "G1", a: "H3" },
  r32r_2: { h: "K2", a: "L2" },
  r32r_3: { h: "J1", a: "H2" },
  r32r_4: { h: "D1", a: "B3" },
  r32r_5: { h: "L1", a: "I3" },
  r32r_6: { h: "E2", a: "I2" },
  r32r_7: { h: "K1", a: "J3" },
};

// For later rounds, each match is fed by two previous-round matches.
export const LATER_FEEDERS: Record<string, [string, string]> = {
  r16l_0: ["r32l_0", "r32l_1"],
  r16l_1: ["r32l_2", "r32l_3"],
  r16l_2: ["r32l_4", "r32l_5"],
  r16l_3: ["r32l_6", "r32l_7"],
  r16r_0: ["r32r_0", "r32r_1"],
  r16r_1: ["r32r_2", "r32r_3"],
  r16r_2: ["r32r_4", "r32r_5"],
  r16r_3: ["r32r_6", "r32r_7"],
  qfl_0: ["r16l_0", "r16l_1"],
  qfl_1: ["r16l_2", "r16l_3"],
  qfr_0: ["r16r_0", "r16r_1"],
  qfr_1: ["r16r_2", "r16r_3"],
  sfl_0: ["qfl_0", "qfl_1"],
  sfr_0: ["qfr_0", "qfr_1"],
  final: ["sfl_0", "sfr_0"],
};

export const ALL_KO_KEYS = [
  ...Object.keys(R32_MATCHUPS),
  "r16l_0", "r16l_1", "r16l_2", "r16l_3",
  "r16r_0", "r16r_1", "r16r_2", "r16r_3",
  "qfl_0", "qfl_1", "qfr_0", "qfr_1",
  "sfl_0", "sfr_0",
  "final",
];

/** Resolve "A1" / "A2" / "A3" to team code using group order. */
export function resolveGroupSlot(
  slot: string,
  groups: Record<string, GroupStateMinimal>
): string | null {
  const letter = slot[0];
  const position = parseInt(slot[1], 10) - 1;
  const group = groups[letter];
  if (!group) return null;
  const teamIdx = group.order?.[position];
  const teams = GROUPS[letter];
  if (!teams || teamIdx === undefined) return null;
  return teams[teamIdx]?.code ?? null;
}

/** Resolve team codes for a specific knockout match. */
export function deriveMatchTeams(
  matchKey: string,
  groups: Record<string, GroupStateMinimal>,
  knockout: Record<string, KOStateMinimal>
): { team1: string | null; team2: string | null } {
  if (matchKey in R32_MATCHUPS) {
    const { h, a } = R32_MATCHUPS[matchKey];
    return { team1: resolveGroupSlot(h, groups), team2: resolveGroupSlot(a, groups) };
  }
  const feeders = LATER_FEEDERS[matchKey];
  if (!feeders) return { team1: null, team2: null };
  const [f1, f2] = feeders;
  return { team1: knockout[f1]?.winner ?? null, team2: knockout[f2]?.winner ?? null };
}
