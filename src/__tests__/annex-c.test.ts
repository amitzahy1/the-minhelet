import { describe, it, expect } from "vitest";
import {
  DEFAULT_ASSIGNMENT,
  DEFAULT_QUALIFIED_GROUPS,
  WINNER_SLOTS_VS_THIRD,
  THIRD_CANDIDATE_SETS,
  resolveAnnexC,
  fallbackAssignment,
  getThirdsAssignment,
  isLegalAssignment,
} from "@/lib/tournament/annex-c";

// Enumerate all C(12,8) = 495 qualifying-group combinations.
const GROUPS = "ABCDEFGHIJKL".split("");
function* combos(arr: string[], k: number): Generator<string[]> {
  if (k === 0) { yield []; return; }
  if (arr.length < k) return;
  const [h, ...r] = arr;
  for (const c of combos(r, k - 1)) yield [h, ...c];
  yield* combos(r, k);
}
const ALL_COMBOS = [...combos(GROUPS, 8)];

describe("resolveAnnexC", () => {
  it("returns the official assignment for the default combination", () => {
    expect(resolveAnnexC(DEFAULT_QUALIFIED_GROUPS)).toEqual(DEFAULT_ASSIGNMENT);
  });

  it("ignores input order and casing", () => {
    const shuffled = ["j", "D", "B", "C", "h", "F", "I", "E"];
    expect(resolveAnnexC(shuffled)).toEqual(DEFAULT_ASSIGNMENT);
  });

  it("returns an official assignment for EVERY one of the 495 combinations", () => {
    let resolved = 0;
    for (const combo of ALL_COMBOS) {
      const a = resolveAnnexC(combo);
      expect(a).not.toBeNull();
      if (a) resolved++;
    }
    expect(ALL_COMBOS.length).toBe(495);
    expect(resolved).toBe(495);
  });

  it("every official row is a legal candidate-set matching", () => {
    for (const combo of ALL_COMBOS) {
      const a = resolveAnnexC(combo)!;
      expect(isLegalAssignment(combo, a)).toBe(true);
    }
  });

  it("uses the OFFICIAL 1B→3J / 1K→3E for {B,C,D,E,F,H,I,J} (Option 155)", () => {
    const a = resolveAnnexC(["B", "C", "D", "E", "F", "H", "I", "J"])!;
    expect(a.B).toBe("J");
    expect(a.K).toBe("E");
  });
});

describe("candidate sets + matcher", () => {
  it("every candidate set has the expected official membership", () => {
    expect(THIRD_CANDIDATE_SETS.A).toEqual(["C", "E", "F", "H", "I"]);
    expect(THIRD_CANDIDATE_SETS.B).toEqual(["E", "F", "G", "I", "J"]);
    expect(THIRD_CANDIDATE_SETS.L).toEqual(["E", "H", "I", "J", "K"]);
  });

  it("fallbackAssignment yields a legal matching for any 8-set", () => {
    const combo = ["A", "B", "C", "D", "E", "F", "G", "H"];
    const out = fallbackAssignment(combo)!;
    expect(out).not.toBeNull();
    expect(isLegalAssignment(combo, out)).toBe(true);
    expect(Object.keys(out).sort()).toEqual([...WINNER_SLOTS_VS_THIRD].sort());
  });

  it("returns null on invalid input (wrong length)", () => {
    expect(fallbackAssignment(["A", "B"])).toBeNull();
  });
});

describe("getThirdsAssignment", () => {
  it("marks the default combination as official", () => {
    const { assignment, isOfficial } = getThirdsAssignment(DEFAULT_QUALIFIED_GROUPS);
    expect(isOfficial).toBe(true);
    expect(assignment).toEqual(DEFAULT_ASSIGNMENT);
  });

  it("marks ALL 495 combinations as official now", () => {
    for (const combo of ALL_COMBOS) {
      const { isOfficial } = getThirdsAssignment(combo);
      expect(isOfficial).toBe(true);
    }
  });
});
