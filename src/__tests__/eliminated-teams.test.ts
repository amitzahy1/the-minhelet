import { describe, it, expect } from "vitest";
import {
  computeEliminatedTeams,
  computeCatchableStages,
  type KoSlotKey,
  type SlotState,
} from "@/lib/scoring/knockout-resolver";
import type { FinishedMatch } from "@/lib/results-hits";

// Reuse the clean "home wins 1-0" group ladder so the standings order matches
// the order array (same pattern as two-tree-knockout-scoring.test.ts).
let mid = 1;
const gm = (h: string, a: string, hg: number, ag: number, group: string, stage = "GROUP_STAGE"): FinishedMatch => ({
  id: mid++, date: "2026-06-15T16:00:00Z", homeTla: h, awayTla: a, group, stage, homeGoals: hg, awayGoals: ag,
});
function groupMatches(letter: string, order: [string, string, string, string]): FinishedMatch[] {
  const [a, b, c, d] = order;
  const g = `GROUP_${letter}`;
  return [gm(a, b, 1, 0, g), gm(a, c, 1, 0, g), gm(a, d, 1, 0, g), gm(b, c, 1, 0, g), gm(b, d, 1, 0, g), gm(c, d, 1, 0, g)];
}

describe("computeEliminatedTeams", () => {
  it("marks the loser of a decided knockout match eliminated, not the winner", () => {
    // Groups A + B complete → r32l_0 (A2 v B2 = KOR v CAN) resolves; KOR 2-1 CAN.
    const matches: FinishedMatch[] = [
      ...groupMatches("A", ["MEX", "KOR", "CZE", "RSA"]),
      ...groupMatches("B", ["SUI", "CAN", "QAT", "BIH"]),
      gm("KOR", "CAN", 2, 1, "", "LAST_16"),
    ];
    const out = computeEliminatedTeams(matches);
    expect(out.has("CAN")).toBe(true); // lost the knockout match → out
    expect(out.has("KOR")).toBe(false); // advanced → alive
  });

  it("does NOT bury group teams before the whole group stage is decided", () => {
    // Only 2 of 12 groups played → group-stage non-qualifier pruning must stay
    // off, so a bottom team (A4 = RSA) isn't yet treated as eliminated.
    const matches: FinishedMatch[] = [
      ...groupMatches("A", ["MEX", "KOR", "CZE", "RSA"]),
      ...groupMatches("B", ["SUI", "CAN", "QAT", "BIH"]),
    ];
    const out = computeEliminatedTeams(matches);
    expect(out.has("RSA")).toBe(false);
    expect(out.has("KOR")).toBe(false);
  });

  it("nothing is eliminated from an empty result set", () => {
    expect(computeEliminatedTeams([]).size).toBe(0);
  });
});

// computeReachableStages reads only the R32 slots + the static LIVE_FEEDERS
// map, so a hand-built partial tree is enough to target a known collision.
// LIVE_FEEDERS: r16l_1 = [r32l_0, r32l_2] — those two R32 matches feed the SAME
// R16 match, so their winners meet there and can't both reach the QF.
const r32Slot = (key: KoSlotKey, t1: string, t2: string): SlotState => ({
  key, team1: t1, team2: t2, score1: null, score2: null, winner: null, stage: "R32", isThirdPlace: false,
});
const TREE = {
  r32l_0: r32Slot("r32l_0" as KoSlotKey, "AAA", "aaa"),
  r32l_2: r32Slot("r32l_2" as KoSlotKey, "BBB", "bbb"),
} as Record<KoSlotKey, SlotState>;

describe("computeCatchableStages (collision-aware, catchable-only)", () => {
  it("two QF picks that share an R16 match collapse to one catchable QF", () => {
    const picks = { r16: ["AAA", "BBB"], qf: ["AAA", "BBB"], sf: [], final: [], champion: "" };
    const reach = computeCatchableStages(picks, TREE, new Set());
    expect(reach.r16).toBe(2); // distinct R32 matches → both can reach R16
    expect(reach.qf).toBe(1); // both feed r16l_1 → only one can reach the QF
  });

  it("an eliminated pick drops out before the collision is counted", () => {
    const picks = { r16: ["AAA", "BBB"], qf: ["AAA", "BBB"], sf: [], final: [], champion: "" };
    const reach = computeCatchableStages(picks, TREE, new Set(["AAA"]));
    expect(reach.r16).toBe(1);
    expect(reach.qf).toBe(1);
  });

  it("a team that ALREADY reached a stage is no longer catchable there (banked), but still catchable deeper", () => {
    // AAA already reached the R16 (sits in an r16 slot) → R16 is banked; it can
    // still catch the QF. BBB is still in its R32 match → can still reach R16.
    const tree = {
      ...TREE,
      r16l_1: { key: "r16l_1" as KoSlotKey, team1: "AAA", team2: null, score1: null, score2: null, winner: null, stage: "R16" as const, isThirdPlace: false as const },
    } as Record<KoSlotKey, SlotState>;
    const picks = { r16: ["AAA", "BBB"], qf: ["AAA"], sf: [], final: [], champion: "" };
    const reach = computeCatchableStages(picks, tree, new Set());
    expect(reach.r16).toBe(1); // only BBB can still reach R16; AAA already banked it
    expect(reach.qf).toBe(1); // AAA hasn't reached the QF yet → still catchable
  });

  it("champion counts 1 while alive & uncrowned, 0 once eliminated or crowned", () => {
    const base = { r16: [], qf: [], sf: [], final: [], champion: "AAA" };
    expect(computeCatchableStages(base, TREE, new Set()).champion).toBe(1);
    expect(computeCatchableStages(base, TREE, new Set(["AAA"])).champion).toBe(0);
    const crowned = { ...TREE, final: { key: "final" as KoSlotKey, team1: "AAA", team2: "BBB", score1: 1, score2: 0, winner: "AAA", stage: "FINAL" as const, isThirdPlace: false as const } } as Record<KoSlotKey, SlotState>;
    expect(computeCatchableStages(base, crowned, new Set()).champion).toBe(0); // already won → banked
  });

  it("with no tree it degrades to the plain not-eliminated count", () => {
    const picks = { r16: [], qf: ["AAA", "BBB"], sf: [], final: [], champion: "" };
    const reach = computeCatchableStages(picks, {} as Record<KoSlotKey, SlotState>, new Set());
    expect(reach.qf).toBe(2); // no bracket info → no collision detection
  });
});
