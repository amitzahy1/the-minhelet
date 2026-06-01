import { describe, it, expect } from "vitest";
import { deriveUserR32Matchups } from "@/lib/tournament/user-bracket-derivation";
import { isLegalAssignment } from "@/lib/tournament/annex-c";
import { GROUPS, GROUP_LETTERS } from "@/lib/tournament/groups";

// Real sample bettor's group scores (scores[] in generateMatchups order:
// [0-1],[2-3],[0-2],[3-1],[3-0],[1-2]). Computed best-8 thirds = A,B,E,F,G,I,K,L
// (CZE, BIH, CIV, SWE, EGY, SEN, UZB, GHA) — NOT the legacy fixed {B,C,D,E,F,H,I,J}.
const SCORES: Record<string, [number, number][]> = {
  A: [[1, 1], [2, 0], [2, 1], [0, 2], [0, 2], [1, 1]],
  B: [[2, 0], [2, 0], [1, 2], [2, 0], [0, 1], [0, 1]],
  C: [[2, 0], [2, 0], [3, 0], [0, 2], [0, 2], [1, 0]],
  D: [[2, 0], [2, 0], [1, 1], [1, 0], [1, 2], [0, 2]],
  E: [[2, 1], [1, 0], [2, 1], [0, 2], [0, 2], [0, 0]],
  F: [[2, 1], [2, 0], [2, 1], [0, 2], [0, 2], [1, 1]],
  G: [[2, 0], [1, 0], [1, 0], [0, 2], [0, 2], [1, 1]],
  H: [[2, 0], [0, 0], [2, 0], [0, 1], [0, 3], [2, 1]],
  I: [[2, 0], [2, 0], [2, 1], [0, 2], [0, 3], [0, 1]],
  J: [[3, 0], [1, 0], [2, 0], [0, 2], [0, 3], [1, 0]],
  K: [[2, 1], [1, 0], [2, 0], [0, 1], [0, 3], [0, 0]],
  L: [[2, 0], [2, 0], [2, 1], [0, 1], [0, 2], [1, 0]],
};

function buildGroups(scores: Record<string, [number, number][]>) {
  const groups: Record<string, { order: number[]; scores: { home: number | null; away: number | null }[] }> = {};
  for (const letter of GROUP_LETTERS) {
    groups[letter] = {
      order: [0, 1, 2, 3],
      scores: (scores[letter] ?? []).map(([home, away]) => ({ home, away })),
    };
  }
  return groups;
}

describe("deriveUserR32Matchups", () => {
  it("computes the user's REAL best-8 thirds (not the legacy fixed set)", () => {
    const d = deriveUserR32Matchups(buildGroups(SCORES));
    expect(d.thirdsReady).toBe(true);
    expect(d.qualifiedGroups).toEqual(["A", "B", "E", "F", "G", "I", "K", "L"]);
    // The legacy hardcoded set {B,C,D,E,F,H,I,J} must NOT be what we get.
    expect(d.qualifiedGroups).not.toEqual(["B", "C", "D", "E", "F", "H", "I", "J"]);
  });

  it("produces a legal candidate-set-respecting R32 assignment", () => {
    const d = deriveUserR32Matchups(buildGroups(SCORES));
    // Reconstruct the assignment {slotGroup: thirdGroup} from the third slots
    // (the slots whose away ref ends in "3").
    const assignment: Record<string, string> = {};
    for (const key of Object.keys(d.matchups)) {
      const { h, a } = d.matchups[key];
      if (a.endsWith("3")) assignment[h[0]] = a[0];
    }
    expect(isLegalAssignment(d.qualifiedGroups, assignment)).toBe(true);
  });

  it("places the correct third teams into the winner slots (per the assignment)", () => {
    const d = deriveUserR32Matchups(buildGroups(SCORES));
    // Each third slot's away team must be the 3rd-placed team of an actually
    // qualifying group, and must be a real team code.
    const qualified = new Set(d.qualifiedGroups);
    for (const key of Object.keys(d.matchups)) {
      const { a } = d.matchups[key];
      if (!a.endsWith("3")) continue;
      const grp = a[0];
      expect(qualified.has(grp)).toBe(true);
      expect(GROUPS[grp]).toBeTruthy();
    }
  });

  it("leaves thirds unresolved until all 12 groups are predicted", () => {
    const partial = buildGroups(SCORES);
    partial.A.scores = [{ home: null, away: null }]; // group A incomplete
    const d = deriveUserR32Matchups(partial);
    expect(d.thirdsReady).toBe(false);
    // Third slots should reference the "?" sentinel group.
    const thirdSlot = Object.values(d.matchups).find((m) => m.a.endsWith("3"));
    expect(thirdSlot?.a[0]).toBe("?");
    // Winner/runner-up slots still resolve normally (e.g. A2 vs B2).
    expect(d.matchups.r32l_0).toEqual({ h: "A2", a: "B2" });
  });
});
