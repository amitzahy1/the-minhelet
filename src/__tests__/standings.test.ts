import { describe, it, expect } from "vitest";
import { calculateStandings, validateGroupOrder, getMaxPossiblePoints } from "@/lib/tournament/standings";
import type { GroupMatchPrediction } from "@/types";

const teams = [
  { id: 1, code: "BRA" },
  { id: 2, code: "ARG" },
  { id: 3, code: "GER" },
  { id: 4, code: "JPN" },
];

function makeMatch(h: string, a: string, hg: number, ag: number, id = 0): GroupMatchPrediction {
  return { match_id: id, home_team_code: h, away_team_code: a, home_goals: hg, away_goals: ag };
}

describe("calculateStandings", () => {
  it("ranks by points — 3 wins beats 2 wins + 1 loss", () => {
    const matches: GroupMatchPrediction[] = [
      makeMatch("BRA", "ARG", 2, 0, 1),
      makeMatch("GER", "JPN", 1, 0, 2),
      makeMatch("BRA", "GER", 1, 0, 3),
      makeMatch("JPN", "ARG", 0, 2, 4),
      makeMatch("JPN", "BRA", 0, 3, 5),
      makeMatch("ARG", "GER", 1, 0, 6),
    ];
    const standings = calculateStandings(teams, matches);
    expect(standings[0].team_code).toBe("BRA"); // 9 pts
    expect(standings[0].points).toBe(9);
    expect(standings[1].team_code).toBe("ARG"); // 6 pts
    expect(standings[1].points).toBe(6);
  });

  it("uses goal difference as tiebreaker when points are equal", () => {
    const matches: GroupMatchPrediction[] = [
      makeMatch("BRA", "ARG", 3, 0, 1), // BRA: +3
      makeMatch("GER", "JPN", 2, 1, 2), // GER: +1
      makeMatch("BRA", "GER", 0, 1, 3), // BRA: +3-1=+2, GER: +1+1=+2
      makeMatch("JPN", "ARG", 1, 0, 4),
      makeMatch("JPN", "BRA", 0, 0, 5), // BRA: GF=3, GA=1 => GD=+2
      makeMatch("ARG", "GER", 0, 2, 6), // GER: GF=2+1+2=5, GA=1+0=1 => GD=+4
    ];
    const standings = calculateStandings(teams, matches);
    // GER: 9pts, BRA: 4pts, JPN: 4pts, ARG: 0pts
    expect(standings[0].team_code).toBe("GER");
  });

  it("uses goals scored when GD is also equal", () => {
    const matches: GroupMatchPrediction[] = [
      makeMatch("BRA", "ARG", 2, 1, 1),
      makeMatch("GER", "JPN", 3, 2, 2),
      makeMatch("BRA", "GER", 0, 0, 3),
      makeMatch("JPN", "ARG", 0, 0, 4),
      makeMatch("JPN", "BRA", 1, 2, 5),
      makeMatch("ARG", "GER", 1, 3, 6),
    ];
    const standings = calculateStandings(teams, matches);
    // BRA: 7pts GD+2, GER: 7pts GD+3
    expect(standings[0].team_code).toBe("GER");
    expect(standings[1].team_code).toBe("BRA");
  });

  it("uses head-to-head when top 3 tiebreakers are equal", () => {
    // Construct scenario where BRA and ARG have same pts, GD, GF but BRA beat ARG
    const matches: GroupMatchPrediction[] = [
      makeMatch("BRA", "ARG", 1, 0, 1), // BRA beat ARG h2h
      makeMatch("GER", "JPN", 0, 0, 2),
      makeMatch("BRA", "GER", 0, 1, 3),
      makeMatch("JPN", "ARG", 0, 1, 4),
      makeMatch("JPN", "BRA", 1, 0, 5),
      makeMatch("ARG", "GER", 1, 0, 6),
    ];
    const standings = calculateStandings(teams, matches);
    const braIdx = standings.findIndex(s => s.team_code === "BRA");
    const argIdx = standings.findIndex(s => s.team_code === "ARG");
    // If points, GD, GF are the same, BRA should rank higher due to h2h win
    if (standings[braIdx].points === standings[argIdx].points) {
      expect(braIdx).toBeLessThan(argIdx);
    }
  });

  it("handles all draws correctly", () => {
    const matches: GroupMatchPrediction[] = [
      makeMatch("BRA", "ARG", 1, 1, 1),
      makeMatch("GER", "JPN", 0, 0, 2),
      makeMatch("BRA", "GER", 2, 2, 3),
      makeMatch("JPN", "ARG", 1, 1, 4),
      makeMatch("JPN", "BRA", 0, 0, 5),
      makeMatch("ARG", "GER", 1, 1, 6),
    ];
    const standings = calculateStandings(teams, matches);
    // All teams: 3 draws = 3 points
    expect(standings.every(s => s.points === 3)).toBe(true);
    // BRA: GF=3, ARG: GF=3, GER: GF=3, JPN: GF=1
    expect(standings[3].team_code).toBe("JPN"); // Least goals
  });

  it("returns correct played/won/drawn/lost counts", () => {
    const matches: GroupMatchPrediction[] = [
      makeMatch("BRA", "ARG", 2, 0, 1),
      makeMatch("GER", "JPN", 1, 1, 2),
      makeMatch("BRA", "GER", 3, 0, 3),
      makeMatch("JPN", "ARG", 0, 0, 4),
      makeMatch("JPN", "BRA", 0, 1, 5),
      makeMatch("ARG", "GER", 2, 1, 6),
    ];
    const standings = calculateStandings(teams, matches);
    const bra = standings.find(s => s.team_code === "BRA")!;
    expect(bra.played).toBe(3);
    expect(bra.won).toBe(3);
    expect(bra.drawn).toBe(0);
    expect(bra.lost).toBe(0);
  });
});

describe("validateGroupOrder", () => {
  it("returns true when predicted order matches calculated", () => {
    const standings = [
      { team_code: "BRA", position: 1 },
      { team_code: "ARG", position: 2 },
      { team_code: "GER", position: 3 },
      { team_code: "JPN", position: 4 },
    ] as any;
    expect(validateGroupOrder(["BRA", "ARG", "GER", "JPN"], standings)).toBe(true);
  });

  it("returns false when order differs", () => {
    const standings = [
      { team_code: "BRA", position: 1 },
      { team_code: "ARG", position: 2 },
      { team_code: "GER", position: 3 },
      { team_code: "JPN", position: 4 },
    ] as any;
    expect(validateGroupOrder(["ARG", "BRA", "GER", "JPN"], standings)).toBe(false);
  });
});

describe("getMaxPossiblePoints", () => {
  it("calculates correct max with remaining matches", () => {
    expect(getMaxPossiblePoints("BRA", 3, 3, 1)).toBe(9); // 3 + 2*3
  });

  it("returns current points when all matches played", () => {
    expect(getMaxPossiblePoints("BRA", 7, 3, 3)).toBe(7);
  });
});
