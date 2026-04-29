import { describe, it, expect } from "vitest";
import {
  rankBestThirds,
  type ThirdsInputRow,
} from "@/lib/tournament/thirds-ranker";

function row(
  group: string,
  code: string,
  points: number,
  gd: number,
  gf: number,
  fair = 0,
  played = 3,
): ThirdsInputRow {
  return {
    group,
    team_code: code,
    played,
    points,
    goal_difference: gd,
    goals_for: gf,
    fair_play_score: fair,
  };
}

describe("rankBestThirds", () => {
  it("picks top 8 by FIFA tiebreakers (pts → GD → GF)", () => {
    const thirds = [
      row("A", "MEX", 4, 1, 4),
      row("B", "QAT", 4, 0, 3),
      row("C", "SCO", 3, 2, 5),
      row("D", "PAR", 3, 1, 3),
      row("E", "CIV", 3, 0, 2),
      row("F", "SWE", 3, -1, 2),
      row("G", "EGY", 2, -1, 1),
      row("H", "URU", 2, -2, 1),
      // Bottom 4:
      row("I", "NOR", 1, -2, 1),
      row("J", "ALG", 1, -3, 0),
      row("K", "UZB", 0, -4, 0),
      row("L", "GHA", 0, -5, 0),
    ];
    const out = rankBestThirds(thirds);
    expect(out.qualifiedGroups).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(out.ranked[0].team_code).toBe("MEX"); // 4pts, GD+1, GF4
    expect(out.ranked[1].team_code).toBe("QAT"); // 4pts, GD 0
    expect(out.qualified.length).toBe(8);
    expect(out.isFinal).toBe(true);
  });

  it("falls back to fair-play then group letter for full ties", () => {
    const thirds = [
      row("A", "MEX", 3, 0, 2, 3), // more cards (worse)
      row("B", "QAT", 3, 0, 2, 1), // fewer cards (better)
      ...["C", "D", "E", "F", "G", "H", "I", "J", "K", "L"].map((g, i) =>
        row(g, `T${g}`, 0, -1, 0, i),
      ),
    ];
    const out = rankBestThirds(thirds);
    // QAT wins fair-play tiebreak over MEX
    expect(out.ranked[0].team_code).toBe("QAT");
    expect(out.ranked[1].team_code).toBe("MEX");
  });

  it("ranks incomplete group stages (isFinal=false)", () => {
    const thirds = [
      row("A", "MEX", 3, 1, 2, 0, 2), // only 2 games played
      row("B", "QAT", 1, 0, 1, 0, 2),
    ];
    const out = rankBestThirds(thirds);
    expect(out.isFinal).toBe(false);
    expect(out.qualified.length).toBe(2);
    expect(out.qualifiedGroups).toEqual(["A", "B"]);
  });

  it("returns empty qualifiedGroups when no 3rds supplied", () => {
    const out = rankBestThirds([]);
    expect(out.qualified).toEqual([]);
    expect(out.qualifiedGroups).toEqual([]);
    expect(out.isFinal).toBe(false);
  });

  it("teamByGroup maps each qualifying group to its 3rd team", () => {
    const thirds = ["A", "B", "C", "D", "E", "F", "G", "H"].map((g) =>
      row(g, `T_${g}`, 3, 0, 1),
    );
    const out = rankBestThirds(thirds);
    expect(out.teamByGroup).toEqual({
      A: "T_A", B: "T_B", C: "T_C", D: "T_D",
      E: "T_E", F: "T_F", G: "T_G", H: "T_H",
    });
  });
});
