import { describe, it, expect } from "vitest";
import {
  LIVE_FEEDERS,
  LATER_FEEDERS,
  LIVE_NEXT_MATCH,
  buildR32Matchups,
} from "@/lib/tournament/knockout-derivation";
import { resolveKnockoutTree } from "@/lib/scoring/knockout-resolver";
import type { FinishedMatch } from "@/lib/results-hits";

// ============================================================================
// The real-data tree ("עץ נתוני אמת") must use the OFFICIAL FIFA 2026 bracket.
// These tests (1) pin LIVE_FEEDERS to the official R16 pairings at the
// group-slot level, (2) prove LATER_FEEDERS (the simulation tree + advancement
// wiring) is left UNCHANGED, and (3) prove resolveKnockoutTree actually pairs
// per the feeders it is given.
// ============================================================================

// Canonical token for an R32 slot's matchup, independent of which 3rd-place
// group fills it (Annex-C-dependent): the group-winner / runner-up signature.
//   r32l_0 (A2 v B2) -> "2A|2B"   r32l_1 (E1 v 3rd) -> "1E"
const R32 = buildR32Matchups();
function r32Token(slotKey: string): string {
  const { h, a } = R32[slotKey];
  const norm = (s: string) => (s.endsWith("3") ? "3rd" : `${s[1]}${s[0]}`); // "E1"->"1E"
  return [norm(h), norm(a)].filter((x) => x !== "3rd").sort().join("|");
}
const pairKey = (a: string, b: string) => [a, b].sort().join(" vs ");

describe("LIVE_FEEDERS — official FIFA 2026 bracket", () => {
  it("R16 pairings match the official bracket (group-slot level)", () => {
    // Official R16 (matches 89–96), as group-slot matchup pairs.
    const official = [
      pairKey("1E", "1I"), //          M89
      pairKey("2A|2B", "1F|2C"), //    M90
      pairKey("1C|2F", "2E|2I"), //    M91
      pairKey("1A", "1L"), //          M92
      pairKey("2K|2L", "1H|2J"), //    M93
      pairKey("1D", "1G"), //          M94
      pairKey("1J|2H", "2D|2G"), //    M95
      pairKey("1B", "1K"), //          M96
    ].sort();

    const actual = (["r16l_0","r16l_1","r16l_2","r16l_3","r16r_0","r16r_1","r16r_2","r16r_3"] as const)
      .map((k) => { const [f1, f2] = LIVE_FEEDERS[k]; return pairKey(r32Token(f1), r32Token(f2)); })
      .sort();

    expect(actual).toEqual(official);
  });

  it("QF/SF/final feeders are the standard consecutive grouping", () => {
    expect(LIVE_FEEDERS.qfl_0).toEqual(["r16l_0", "r16l_1"]);
    expect(LIVE_FEEDERS.qfl_1).toEqual(["r16l_2", "r16l_3"]);
    expect(LIVE_FEEDERS.qfr_0).toEqual(["r16r_0", "r16r_1"]);
    expect(LIVE_FEEDERS.qfr_1).toEqual(["r16r_2", "r16r_3"]);
    expect(LIVE_FEEDERS.sfl_0).toEqual(["qfl_0", "qfl_1"]);
    expect(LIVE_FEEDERS.sfr_0).toEqual(["qfr_0", "qfr_1"]);
    expect(LIVE_FEEDERS.final).toEqual(["sfl_0", "sfr_0"]);
  });

  it("LIVE_NEXT_MATCH is the inverse of LIVE_FEEDERS", () => {
    for (const [downstream, [f1, f2]] of Object.entries(LIVE_FEEDERS)) {
      expect(LIVE_NEXT_MATCH[f1]).toBe(downstream);
      expect(LIVE_NEXT_MATCH[f2]).toBe(downstream);
    }
  });
});

describe("LATER_FEEDERS — simulation tree / advancement wiring is UNCHANGED", () => {
  it("still equals the legacy (consecutive) map — proves the sim side did not move", () => {
    expect(LATER_FEEDERS).toEqual({
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
    });
  });
});

// --- resolver actually pairs per the feeders it's handed -------------------
let mid = 1;
type Extra = Partial<Pick<FinishedMatch, "homePenalties" | "awayPenalties" | "winner">>;
const gm = (h: string, a: string, hg: number, ag: number, group: string, stage = "GROUP_STAGE", extra: Extra = {}): FinishedMatch =>
  ({ id: mid++, date: "2026-06-15T16:00:00Z", homeTla: h, awayTla: a, group, stage, homeGoals: hg, awayGoals: ag, ...extra });
function groupMatches(letter: string, order: [string, string, string, string]): FinishedMatch[] {
  const [a, b, c, d] = order;
  return [gm(a, b, 1, 0, letter), gm(a, c, 1, 0, letter), gm(a, d, 1, 0, letter), gm(b, c, 1, 0, letter), gm(b, d, 1, 0, letter), gm(c, d, 1, 0, letter)];
}

describe("resolveKnockoutTree honours the feeder map argument", () => {
  // Groups A,B,C,F complete → r32l_0 (A2·B2), r32l_2 (F1·C2), r32l_3 (C1·F2)
  // resolve without needing best-thirds. Winners: KOR (r32l_0), NED (r32l_2),
  // BRA (r32l_3). An R16 match KOR–NED is the LIVE pairing for r16l_1
  // (LIVE: [r32l_0, r32l_2]); the legacy map pairs [r32l_2, r32l_3] (NED–BRA).
  const matches: FinishedMatch[] = [
    ...groupMatches("A", ["MEX", "KOR", "CZE", "RSA"]), // A2 = KOR
    ...groupMatches("B", ["CAN", "QAT", "SUI", "BIH"]), // B2 = QAT
    ...groupMatches("C", ["BRA", "MAR", "SCO", "HAI"]), // C1 = BRA, C2 = MAR
    ...groupMatches("F", ["NED", "JPN", "SWE", "TUN"]), // F1 = NED, F2 = JPN
    gm("KOR", "QAT", 1, 0, "", "LAST_32", { winner: "HOME_TEAM" }), // r32l_0 → KOR
    gm("NED", "MAR", 1, 0, "", "LAST_32", { winner: "HOME_TEAM" }), // r32l_2 → NED
    gm("BRA", "JPN", 1, 0, "", "LAST_32", { winner: "HOME_TEAM" }), // r32l_3 → BRA
    gm("KOR", "NED", 2, 1, "", "LAST_16", { winner: "HOME_TEAM" }), // R16: LIVE r16l_1
  ];

  it("LIVE_FEEDERS pairs r16l_1 = winner(r32l_0) vs winner(r32l_2) and resolves it", () => {
    const tree = resolveKnockoutTree(matches, null, undefined, LIVE_FEEDERS);
    expect([tree.r16l_1.team1, tree.r16l_1.team2].sort()).toEqual(["KOR", "NED"]);
    expect(tree.r16l_1.winner).toBe("KOR");
  });

  it("legacy (default) feeders pair r16l_1 differently and find no match", () => {
    const tree = resolveKnockoutTree(matches, null); // default = LATER_FEEDERS
    expect([tree.r16l_1.team1, tree.r16l_1.team2].sort()).toEqual(["BRA", "NED"]);
    expect(tree.r16l_1.winner).toBeNull(); // NED–BRA never played
  });
});
