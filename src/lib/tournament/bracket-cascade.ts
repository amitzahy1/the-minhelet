// ============================================================================
// WC2026 — Bracket cascade helpers (pure, framework-agnostic)
//
// Shared by the betting store (live editing) and the bracket re-validator (the
// migration that runs on hydrate + the admin bulk endpoint). Kept free of React
// / zustand so client and server use ONE implementation — the exact class of
// divergence bug this whole effort is fixing.
// ============================================================================

export interface KoMatch {
  score1: number | null;
  score2: number | null;
  winner: string | null;
}

/** The advancement-bet fields synced from / cleared against the simulation tree. */
export interface AdvancementBets {
  winner: string;
  finalist1: string;
  finalist2: string;
  semifinalists: string[];
  quarterfinalists: string[];
  /** The 16 teams reaching the round of 16 (= the R32-match winners). */
  roundOf16: string[];
}

/** Each match key → the downstream match it feeds. */
export const NEXT_MATCH: Record<string, string> = {
  // R32 → R16
  r32l_0: "r16l_0", r32l_1: "r16l_0",
  r32l_2: "r16l_1", r32l_3: "r16l_1",
  r32l_4: "r16l_2", r32l_5: "r16l_2",
  r32l_6: "r16l_3", r32l_7: "r16l_3",
  r32r_0: "r16r_0", r32r_1: "r16r_0",
  r32r_2: "r16r_1", r32r_3: "r16r_1",
  r32r_4: "r16r_2", r32r_5: "r16r_2",
  r32r_6: "r16r_3", r32r_7: "r16r_3",
  // R16 → QF
  r16l_0: "qfl_0", r16l_1: "qfl_0",
  r16l_2: "qfl_1", r16l_3: "qfl_1",
  r16r_0: "qfr_0", r16r_1: "qfr_0",
  r16r_2: "qfr_1", r16r_3: "qfr_1",
  // QF → SF
  qfl_0: "sfl_0", qfl_1: "sfl_0",
  qfr_0: "sfr_0", qfr_1: "sfr_0",
  // SF → Final
  sfl_0: "final", sfr_0: "final",
};

export function getStageFromKey(matchKey: string): string {
  if (matchKey.startsWith("r32")) return "r32";
  if (matchKey.startsWith("r16")) return "r16";
  if (matchKey.startsWith("qf")) return "qf";
  if (matchKey.startsWith("sf")) return "sf";
  return "final";
}

/** Recursively clear downstream matches whose winner is the removed team.
 *  Returns the number of downstream matches cleared (for a toast). */
export function cascadeClear(
  knockout: Record<string, KoMatch>,
  matchKey: string,
  oldWinner: string,
): number {
  const nextKey = NEXT_MATCH[matchKey];
  if (!nextKey) return 0;
  const nextMatch = knockout[nextKey];
  if (nextMatch?.winner === oldWinner) {
    knockout[nextKey] = { score1: null, score2: null, winner: null };
    return 1 + cascadeClear(knockout, nextKey, oldWinner);
  }
  return 0;
}

/** Clear an eliminated team from the advancement bets at the appropriate levels.
 *  Returns the number of advancement slots cleared. */
export function clearTeamFromSpecialBets(
  sb: AdvancementBets,
  teamCode: string,
  fromStage: string,
): number {
  const STAGES = ["r32", "r16", "qf", "sf", "final"];
  const idx = STAGES.indexOf(fromStage);
  let cleared = 0;

  // R32 change → team can't reach the round of 16.
  if (idx <= 0) {
    sb.roundOf16 = (sb.roundOf16 ?? []).map((s) => {
      if (s === teamCode) { cleared++; return ""; }
      return s;
    });
  }
  if (idx <= 1) {
    sb.quarterfinalists = (sb.quarterfinalists ?? []).map((s) => {
      if (s === teamCode) { cleared++; return ""; }
      return s;
    });
  }
  if (idx <= 2) {
    sb.semifinalists = (sb.semifinalists ?? []).map((s) => {
      if (s === teamCode) { cleared++; return ""; }
      return s;
    });
  }
  if (idx <= 3) {
    if (sb.finalist1 === teamCode) { sb.finalist1 = ""; cleared++; }
    if (sb.finalist2 === teamCode) { sb.finalist2 = ""; cleared++; }
  }
  if (sb.winner === teamCode) { sb.winner = ""; cleared++; }
  return cleared;
}

/** Forward-fill advancement picks from the simulation tree (bracket is source
 *  of truth). Only fills EMPTY slots — never clobbers a manual entry. */
export function syncAdvancementPicks(
  knockout: Record<string, KoMatch>,
  sb: AdvancementBets,
): void {
  // Round of 16 = the 16 R32-match winners (left bracket then right).
  const r16 = [
    knockout.r32l_0?.winner, knockout.r32l_1?.winner, knockout.r32l_2?.winner, knockout.r32l_3?.winner,
    knockout.r32l_4?.winner, knockout.r32l_5?.winner, knockout.r32l_6?.winner, knockout.r32l_7?.winner,
    knockout.r32r_0?.winner, knockout.r32r_1?.winner, knockout.r32r_2?.winner, knockout.r32r_3?.winner,
    knockout.r32r_4?.winner, knockout.r32r_5?.winner, knockout.r32r_6?.winner, knockout.r32r_7?.winner,
  ];
  // Map over the canonical-length tree array (r16), so an undefined/short
  // sb.roundOf16 (e.g. from pre-roundOf16 persisted state) can't throw and the
  // result is always the right length. Tree winner wins; else keep existing.
  sb.roundOf16 = r16.map((w, i) => w || sb.roundOf16?.[i] || "");

  const qf = [
    knockout.r16l_0?.winner, knockout.r16l_1?.winner,
    knockout.r16l_2?.winner, knockout.r16l_3?.winner,
    knockout.r16r_0?.winner, knockout.r16r_1?.winner,
    knockout.r16r_2?.winner, knockout.r16r_3?.winner,
  ];
  sb.quarterfinalists = qf.map((w, i) => w || sb.quarterfinalists?.[i] || "");

  const sf = [
    knockout.qfl_0?.winner, knockout.qfl_1?.winner,
    knockout.qfr_0?.winner, knockout.qfr_1?.winner,
  ];
  sb.semifinalists = sf.map((w, i) => w || sb.semifinalists?.[i] || "");

  const f1 = knockout.sfl_0?.winner;
  const f2 = knockout.sfr_0?.winner;
  if (f1) sb.finalist1 = f1;
  if (f2) sb.finalist2 = f2;

  const w = knockout.final?.winner;
  if (w) sb.winner = w;
}
