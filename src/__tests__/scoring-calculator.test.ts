import { describe, it, expect } from "vitest";
import { calculateGroupAdvancementScore } from "@/lib/scoring/calculator";
import { SCORING } from "@/types";

describe("calculateGroupAdvancementScore", () => {
  const { group_exact, group_partial, group_as_3rd } = SCORING.advancement;

  it("awards full 5+5 when both picks are exact", () => {
    const r = calculateGroupAdvancementScore("ARG", "MEX", "ARG", "MEX");
    expect(r.points).toBe(group_exact * 2);
    expect(r.reasons.map((x) => x.reason)).toEqual([
      "GROUP_ADVANCE_EXACT",
      "GROUP_ADVANCE_EXACT",
    ]);
  });

  it("awards 3+3 when 1st and 2nd are swapped", () => {
    const r = calculateGroupAdvancementScore("ARG", "MEX", "MEX", "ARG");
    expect(r.points).toBe(group_partial * 2);
    expect(r.reasons.every((x) => x.reason === "GROUP_ADVANCE_PARTIAL")).toBe(true);
  });

  it("awards 0 when both picks missed top-2 and no 3rd context", () => {
    const r = calculateGroupAdvancementScore("ARG", "MEX", "BRA", "ENG");
    expect(r.points).toBe(0);
    expect(r.reasons).toHaveLength(0);
  });

  it("awards 2 (AS_3RD) when predicted 1st actually finished 3rd AND qualified", () => {
    const r = calculateGroupAdvancementScore(
      "MEX",   // predicted 1st
      "KOR",   // predicted 2nd — wrong
      "BRA",   // actual 1st
      "CZE",   // actual 2nd
      "MEX",   // actual 3rd — our 1st pick
      true,    // qualified as best-3rd
    );
    expect(r.points).toBe(group_as_3rd);
    expect(r.reasons).toEqual([{ reason: "GROUP_ADVANCE_AS_3RD", points: 2 }]);
  });

  it("does NOT award AS_3RD when the 3rd team did not qualify", () => {
    const r = calculateGroupAdvancementScore(
      "MEX", "KOR", "BRA", "CZE", "MEX", false,
    );
    expect(r.points).toBe(0);
    expect(r.reasons).toHaveLength(0);
  });

  it("stacks: 1 pick exact + other pick as qualifying 3rd = 5 + 2", () => {
    const r = calculateGroupAdvancementScore(
      "BRA",   // predicted 1st — exact
      "MEX",   // predicted 2nd — actually 3rd but qualified
      "BRA",
      "CZE",
      "MEX",
      true,
    );
    expect(r.points).toBe(group_exact + group_as_3rd);
    expect(r.reasons.map((x) => x.reason).sort()).toEqual([
      "GROUP_ADVANCE_AS_3RD",
      "GROUP_ADVANCE_EXACT",
    ]);
  });

  it("stacks: 1 pick partial-swap + other pick as qualifying 3rd = 3 + 2", () => {
    const r = calculateGroupAdvancementScore(
      "CZE",   // predicted 1st — actually 2nd → partial
      "MEX",   // predicted 2nd — actually 3rd but qualified
      "BRA",
      "CZE",
      "MEX",
      true,
    );
    expect(r.points).toBe(group_partial + group_as_3rd);
  });

  it("does not double-award when both picks are the same team that qualified as 3rd", () => {
    const r = calculateGroupAdvancementScore(
      "MEX", "MEX",     // same team in both slots (silly but possible)
      "BRA", "CZE",
      "MEX", true,
    );
    expect(r.points).toBe(group_as_3rd);
    expect(r.reasons).toHaveLength(1);
  });
});
