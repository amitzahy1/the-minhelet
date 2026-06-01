// ============================================================================
// WC2026 — Tree 1 re-validator (pure, framework-agnostic)
//
// When the simulation tree's R32 third-place teams change (the FIFA Annex C fix),
// a user's stored winner picks can reference a team no longer present in its slot.
// Those orphaned picks silently score 0. This re-validator does a top-down pass:
// for each knockout slot it resolves the CURRENT participants (R32 from the user's
// group predictions + the official Annex C assignment; R16+ from the surviving
// feeder winners) and clears any stored winner that is no longer a participant,
// cascading naturally because later rounds read the just-cleared feeders.
//
// Cleared teams are also removed from the advancement bets, and the advancement
// picks are re-synced from the cleaned tree. Shared by the store (silent
// auto-clear on hydrate) and the admin bulk endpoint — one implementation.
// ============================================================================

import { resolveGroupSlot, LATER_FEEDERS } from "./knockout-derivation";
import { deriveUserR32Matchups, type UserGroupState } from "./user-bracket-derivation";
import {
  clearTeamFromSpecialBets,
  syncAdvancementPicks,
  type KoMatch,
  type AdvancementBets,
} from "./bracket-cascade";

/** Knockout slot keys, R32 → final, in resolution (top-down) order. */
const KO_ORDER = [
  "r32l_0", "r32l_1", "r32l_2", "r32l_3", "r32l_4", "r32l_5", "r32l_6", "r32l_7",
  "r32r_0", "r32r_1", "r32r_2", "r32r_3", "r32r_4", "r32r_5", "r32r_6", "r32r_7",
  "r16l_0", "r16l_1", "r16l_2", "r16l_3", "r16r_0", "r16r_1", "r16r_2", "r16r_3",
  "qfl_0", "qfl_1", "qfr_0", "qfr_1", "sfl_0", "sfr_0", "final",
];

export interface RevalidationResult<S extends AdvancementBets> {
  knockout: Record<string, KoMatch>;
  specialBets: S;
  /** Slot keys whose stored winner was cleared. */
  invalidSlots: string[];
  /** Distinct teams removed (winners of cleared slots). */
  clearedTeams: string[];
  /** True iff anything was cleared. */
  changed: boolean;
}

/**
 * Re-validate a user's simulation tree (`knockout`) + advancement bets against
 * their current group predictions and the official Annex C thirds. Pure: inputs
 * are deep-cloned, never mutated. Returns the cleaned copies + what changed.
 *
 * If the thirds aren't resolvable yet (the user hasn't predicted all 12 groups),
 * nothing is cleared — we never wipe picks mid-fill.
 */
export function revalidateTree1<S extends AdvancementBets>(
  groups: Record<string, UserGroupState>,
  knockout: Record<string, KoMatch>,
  specialBets: S,
): RevalidationResult<S> {
  const ko: Record<string, KoMatch> = JSON.parse(JSON.stringify(knockout ?? {}));
  const sb: S = JSON.parse(JSON.stringify(specialBets));

  const { matchups, thirdsReady } = deriveUserR32Matchups(groups);
  if (!thirdsReady) {
    return { knockout: ko, specialBets: sb, invalidSlots: [], clearedTeams: [], changed: false };
  }

  const invalidSlots: string[] = [];
  const clearedTeams = new Set<string>();

  for (const key of KO_ORDER) {
    let t1: string | null = null;
    let t2: string | null = null;
    if (key in matchups) {
      t1 = resolveGroupSlot(matchups[key].h, groups);
      t2 = resolveGroupSlot(matchups[key].a, groups);
    } else if (key in LATER_FEEDERS) {
      const [f1, f2] = LATER_FEEDERS[key];
      t1 = ko[f1]?.winner ?? null;
      t2 = ko[f2]?.winner ?? null;
    }
    const w = ko[key]?.winner;
    if (w && w !== t1 && w !== t2) {
      ko[key] = { score1: null, score2: null, winner: null };
      invalidSlots.push(key);
      clearedTeams.add(w);
    }
  }

  if (invalidSlots.length > 0) {
    // A cleared team is no longer anywhere in the bracket → strip it from every
    // advancement level (r32 = most aggressive), then re-sync from the cleaned tree.
    for (const team of clearedTeams) clearTeamFromSpecialBets(sb, team, "r32");
    syncAdvancementPicks(ko, sb);
  }

  return {
    knockout: ko,
    specialBets: sb,
    invalidSlots,
    clearedTeams: [...clearedTeams],
    changed: invalidSlots.length > 0,
  };
}
