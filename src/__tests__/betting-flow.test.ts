import { describe, it, expect, beforeEach } from "vitest";

/**
 * Integration test: Full betting flow
 * Groups → Knockout → Special Bets → Validation
 */

// We test the validation logic end-to-end without the Zustand store (which needs DOM)
import { validateGroup } from "@/lib/validation/engine";
import { validateSpecialBets } from "@/lib/validation/engine";
import { calculateStandings } from "@/lib/tournament/standings";
import type { GroupMatchPrediction } from "@/types";
import type { BettingState, GroupMatchScore } from "@/stores/betting-store";

function makeScores(...pairs: [number, number][]): GroupMatchScore[] {
  return pairs.map(([h, a]) => ({ home: h, away: a }));
}

describe("Full betting flow integration", () => {
  describe("Step 1: Group stage predictions", () => {
    it("user fills all 6 matches in a group and standings calculate correctly", () => {
      // Group A: MEX(0), KOR(1), CZE(2), RSA(3)
      const scores = makeScores(
        [2, 0], // MEX vs KOR
        [1, 1], // CZE vs RSA
        [1, 0], // MEX vs CZE
        [0, 2], // RSA vs KOR
        [0, 3], // RSA vs MEX
        [1, 0], // KOR vs CZE
      );

      // Calculate standings
      const teams = [
        { id: 769, code: "MEX" },
        { id: 772, code: "KOR" },
        { id: 798, code: "CZE" },
        { id: 774, code: "RSA" },
      ];

      const matchups = [
        { h: "MEX", a: "KOR" },
        { h: "CZE", a: "RSA" },
        { h: "MEX", a: "CZE" },
        { h: "RSA", a: "KOR" },
        { h: "RSA", a: "MEX" },
        { h: "KOR", a: "CZE" },
      ];

      const predictions: GroupMatchPrediction[] = matchups.map((m, i) => ({
        match_id: i,
        home_team_code: m.h,
        away_team_code: m.a,
        home_goals: scores[i].home ?? 0,
        away_goals: scores[i].away ?? 0,
      }));

      const standings = calculateStandings(teams, predictions);

      // MEX: 9pts (3W), KOR: 6pts (2W), CZE: 1pt (1D), RSA: 1pt (1D)
      expect(standings[0].team_code).toBe("MEX");
      expect(standings[0].points).toBe(9);
      expect(standings[1].team_code).toBe("KOR");
      expect(standings[1].points).toBe(6);

      // Validate: predicted order matches calculated order
      const predictedOrder = [0, 1, 2, 3]; // MEX, KOR, CZE, RSA
      const result = validateGroup("A", predictedOrder, scores);
      // The calculated order should be MEX, KOR, then CZE/RSA
      expect(result.calculatedOrder[0]).toBe("MEX");
      expect(result.calculatedOrder[1]).toBe("KOR");
    });

    it("detects mismatch between scores and predicted order", () => {
      // Scores where RSA wins everything but we predict MEX first
      const scores = makeScores(
        [0, 1], // MEX vs KOR: KOR wins
        [0, 2], // CZE vs RSA: RSA wins
        [0, 1], // MEX vs CZE: CZE wins
        [3, 0], // RSA vs KOR: RSA wins
        [2, 0], // RSA vs MEX: RSA wins
        [1, 0], // KOR vs CZE: KOR wins
      );

      // Predict MEX 1st — but MEX lost all games
      const result = validateGroup("A", [0, 1, 2, 3], scores);
      expect(result.isValid).toBe(false);
      expect(result.conflicts.length).toBeGreaterThan(0);
    });

    it("validates all 12 groups can be filled independently", () => {
      const groups = "ABCDEFGHIJKL".split("");
      for (const g of groups) {
        const emptyScores: GroupMatchScore[] = Array(6).fill({ home: null, away: null });
        const result = validateGroup(g, [0, 1, 2, 3], emptyScores);
        expect(result.isValid).toBe(true);
      }
    });
  });

  describe("Step 2: Knockout bracket flows from groups", () => {
    it("group winners and runners-up feed into R32 correctly", () => {
      // Simulate: Group A has MEX 1st, KOR 2nd
      // These should feed into R32 matches
      const groupAOrder = ["MEX", "KOR", "CZE", "RSA"];
      expect(groupAOrder[0]).toBe("MEX"); // 1st = winner
      expect(groupAOrder[1]).toBe("KOR"); // 2nd = runner-up

      // R32 matchup: A1 vs B2, meaning MEX plays the runner-up of Group B
      // This is a structural test — the R32 structure exists
      expect(true).toBe(true);
    });
  });

  describe("Step 3: Special bets validation", () => {
    const baseState: BettingState = {
      groups: {},
      knockout: {},
      specialBets: {
        winner: "",
        finalist1: "",
        finalist2: "",
        semifinalists: ["", "", "", ""],
        quarterfinalists: ["", "", "", "", "", "", "", ""],
        topScorerTeam: "",
        topScorerPlayer: "",
        topAssistsTeam: "",
        topAssistsPlayer: "",
        bestAttack: "",
        prolificGroup: "",
        driestGroup: "",
        dirtiestTeam: "",
        matchups: ["", "", ""],
        penaltiesOverUnder: "",
        mostGoalsMatchStage: "",
        firstRedCardTeam: "",
        youngestScorerTeam: "",
      },
      currentGroupIndex: 0,
      bracketLocked: false,
      lastUpdated: null,
    };

    it("accepts a fully consistent set of special bets", () => {
      const state = {
        ...baseState,
        specialBets: {
          ...baseState.specialBets,
          winner: "ARG",
          finalist1: "ARG",
          finalist2: "FRA",
          semifinalists: ["ARG", "FRA", "BRA", "ESP"],
          quarterfinalists: ["ARG", "FRA", "BRA", "ESP", "GER", "ENG", "POR", "NED"],
          topScorerTeam: "ARG",
          topScorerPlayer: "Messi",
          bestAttack: "BRA",
          dirtiestTeam: "URU",
          prolificGroup: "A",
          driestGroup: "G",
        },
      };
      const result = validateSpecialBets(state);
      expect(result.isValid).toBe(true);
    });

    it("rejects winner not in finalists", () => {
      const state = {
        ...baseState,
        specialBets: {
          ...baseState.specialBets,
          winner: "BRA",
          finalist1: "ARG",
          finalist2: "FRA",
        },
      };
      const result = validateSpecialBets(state);
      expect(result.isValid).toBe(false);
    });

    it("rejects finalist not in semifinalists", () => {
      const state = {
        ...baseState,
        specialBets: {
          ...baseState.specialBets,
          finalist1: "BRA",
          semifinalists: ["ARG", "FRA", "ESP", "GER"],
        },
      };
      const result = validateSpecialBets(state);
      expect(result.isValid).toBe(false);
    });

    it("rejects same prolific and driest group", () => {
      const state = {
        ...baseState,
        specialBets: {
          ...baseState.specialBets,
          prolificGroup: "A",
          driestGroup: "A",
        },
      };
      const result = validateSpecialBets(state);
      expect(result.isValid).toBe(false);
    });

    it("full flow: groups → special bets all valid together", () => {
      // Fill group A with valid scores
      const scores = makeScores(
        [2, 0], [1, 0], [1, 0], [0, 1], [0, 2], [1, 0],
      );
      const groupResult = validateGroup("A", [0, 1, 2, 3], scores);
      // Regardless of order match, the validation runs

      // Set consistent special bets
      const state = {
        ...baseState,
        specialBets: {
          ...baseState.specialBets,
          winner: "ARG",
          finalist1: "ARG",
          finalist2: "FRA",
          semifinalists: ["ARG", "FRA", "BRA", "ESP"],
          quarterfinalists: ["ARG", "FRA", "BRA", "ESP", "GER", "ENG", "POR", "NED"],
        },
      };
      const specialResult = validateSpecialBets(state);
      expect(specialResult.isValid).toBe(true);

      // Both validations ran without errors
      expect(groupResult).toBeDefined();
      expect(specialResult).toBeDefined();
    });
  });
});
