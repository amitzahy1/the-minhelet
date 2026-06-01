import { describe, it, expect } from "vitest";
import { toAppCode, findUnmappedTeams, FD_TLA_TO_APP } from "@/lib/fd-team-mapping";

// Snapshot of the 48 group-stage TLAs as football-data.org returns them after
// the 2026 draw (fetched from /v4/competitions/WC/matches?season=2026).
// This is the contract: every TLA the live feed sends must resolve to a code
// the app knows. If a future groups.ts edit drops a code, or an alias gets
// removed, this test fails BEFORE the matchday order silently breaks again.
const FD_GROUP_STAGE_TLAS = [
  "ALG", "ARG", "AUS", "AUT", "BEL", "BIH", "BRA", "CAN", "CIV", "COD",
  "COL", "CPV", "CRO", "CUW", "CZE", "ECU", "EGY", "ENG", "ESP", "FRA",
  "GER", "GHA", "HAI", "IRN", "IRQ", "JOR", "JPN", "KOR", "KSA", "MAR",
  "MEX", "NED", "NOR", "NZL", "PAN", "PAR", "POR", "QAT", "RSA", "SCO",
  "SEN", "SUI", "SWE", "TUN", "TUR", "URY", "USA", "UZB",
];

describe("football-data → app team mapping", () => {
  it("maps every live group-stage TLA to a known app code", () => {
    const fixtures = FD_GROUP_STAGE_TLAS.map((tla) => ({
      homeTla: toAppCode(tla),
      awayTla: toAppCode(tla),
      group: "GROUP_X",
    }));
    expect(findUnmappedTeams(fixtures)).toEqual([]);
  });

  it("covers all 48 teams", () => {
    expect(FD_GROUP_STAGE_TLAS).toHaveLength(48);
  });

  it("normalises the two known divergent TLAs", () => {
    expect(toAppCode("CUW")).toBe("CUR"); // Curaçao
    expect(toAppCode("URY")).toBe("URU"); // Uruguay
  });

  it("passes through codes that already match and TBD placeholders", () => {
    expect(toAppCode("GER")).toBe("GER");
    expect(toAppCode(undefined)).toBe("TBD");
  });

  it("flags an unknown code so a future unmapped draw fails loudly", () => {
    const unmapped = findUnmappedTeams([
      { homeTla: "ZZZ", awayTla: "GER", group: "GROUP_A" },
    ]);
    expect(unmapped).toEqual(["ZZZ"]);
  });

  it("ignores TBD knockout placeholders", () => {
    expect(findUnmappedTeams([{ homeTla: "TBD", awayTla: "TBD" }])).toEqual([]);
  });

  it("every alias target is itself a real app code (no typos)", () => {
    const targets = Object.values(FD_TLA_TO_APP).map((code) => ({
      homeTla: code,
      awayTla: code,
    }));
    expect(findUnmappedTeams(targets)).toEqual([]);
  });
});
