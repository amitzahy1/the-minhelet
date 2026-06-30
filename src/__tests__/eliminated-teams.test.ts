import { describe, it, expect } from "vitest";
import { computeEliminatedTeams } from "@/lib/scoring/knockout-resolver";
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
