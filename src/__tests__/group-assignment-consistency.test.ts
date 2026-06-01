import { describe, it, expect } from "vitest";
import { GROUPS, GROUP_LETTERS, ALL_TEAMS } from "@/lib/tournament/groups";

// ============================================================================
// Guard: the static draw (GROUPS) stays structurally sound and self-consistent.
// The actual team→group assignments were verified 1:1 against the official FIFA
// 2026 draw; this test prevents silent drift (a team moved, a group_id mismatch,
// a missing FIFA ranking that the thirds tiebreaker relies on).
// ============================================================================

describe("group data consistency", () => {
  it("has exactly 12 groups of 4 teams (48 total)", () => {
    expect(GROUP_LETTERS).toHaveLength(12);
    for (const letter of GROUP_LETTERS) {
      expect(GROUPS[letter]).toHaveLength(4);
    }
    expect(ALL_TEAMS).toHaveLength(48);
  });

  it("each team's group_id matches the group it is listed under", () => {
    for (const letter of GROUP_LETTERS) {
      for (const team of GROUPS[letter]) {
        expect(team.group_id).toBe(letter);
      }
    }
  });

  it("every team code is unique across all groups", () => {
    const codes = ALL_TEAMS.map((t) => t.code);
    expect(new Set(codes).size).toBe(48);
  });

  it("every team has a positive FIFA ranking (used by the thirds tiebreaker)", () => {
    for (const team of ALL_TEAMS) {
      expect(typeof team.fifa_ranking).toBe("number");
      expect(team.fifa_ranking).toBeGreaterThan(0);
    }
  });

  it("hosts are seeded per the official draw (MEX=A1, CAN=B1, USA=D1)", () => {
    expect(GROUPS.A[0].code).toBe("MEX");
    expect(GROUPS.B[0].code).toBe("CAN");
    expect(GROUPS.D[0].code).toBe("USA");
  });
});
