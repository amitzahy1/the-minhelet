import { describe, it, expect } from "vitest";
import {
  DEFAULT_ASSIGNMENT,
  DEFAULT_QUALIFIED_GROUPS,
  WINNER_SLOTS_VS_THIRD,
  resolveAnnexC,
  fallbackAssignment,
  getThirdsAssignment,
} from "@/lib/tournament/annex-c";

describe("resolveAnnexC", () => {
  it("returns the official assignment for the default combination", () => {
    expect(resolveAnnexC(DEFAULT_QUALIFIED_GROUPS)).toEqual(DEFAULT_ASSIGNMENT);
  });

  it("ignores input order and casing", () => {
    const shuffled = ["j", "D", "B", "C", "h", "F", "I", "E"];
    expect(resolveAnnexC(shuffled)).toEqual(DEFAULT_ASSIGNMENT);
  });

  it("returns null for unencoded combinations", () => {
    // Swap J → A → not the default, not yet encoded.
    expect(resolveAnnexC(["A", "B", "C", "D", "E", "F", "H", "I"])).toBeNull();
  });
});

describe("fallbackAssignment", () => {
  it("fills all 8 winner slots with 8 distinct qualifier groups", () => {
    const out = fallbackAssignment(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(out).not.toBeNull();
    const slots = Object.keys(out!).sort();
    const values = Object.values(out!).sort();
    expect(slots).toEqual([...WINNER_SLOTS_VS_THIRD].sort());
    // 8 distinct qualifier groups used
    expect(new Set(values).size).toBe(8);
    // No slot plays its own group
    for (const [slot, qualifier] of Object.entries(out!)) {
      expect(slot).not.toBe(qualifier);
    }
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

  it("falls back with isOfficial=false for unencoded combos", () => {
    const { assignment, isOfficial } = getThirdsAssignment(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(isOfficial).toBe(false);
    expect(assignment).not.toBeNull();
  });
});
