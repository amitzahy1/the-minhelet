import { describe, it, expect } from "vitest";
import { validateGroup, validateSpecialBets } from "@/lib/validation/engine";
import type { BettingState, GroupMatchScore } from "@/stores/betting-store";

// Helper to create scores array for 6 matches in a group
function makeScores(...pairs: [number, number][]): GroupMatchScore[] {
  return pairs.map(([h, a]) => ({ home: h, away: a }));
}

describe("validateGroup", () => {
  it("returns valid when scores match predicted order", () => {
    // Group A: MEX(0), KOR(1), CZE(2), RSA(3)
    // Matchups from generateMatchups([MEX, KOR, CZE, RSA]):
    // 0: MEX vs KOR, 1: CZE vs RSA, 2: MEX vs CZE, 3: RSA vs KOR, 4: RSA vs MEX, 5: KOR vs CZE
    const scores = makeScores(
      [2, 1], // MEX vs KOR: MEX wins (MEX 3pts)
      [2, 0], // CZE vs RSA: CZE wins (CZE 3pts)
      [1, 0], // MEX vs CZE: MEX wins (MEX 6pts)
      [0, 2], // RSA vs KOR: KOR wins (KOR 3pts)
      [0, 3], // RSA vs MEX: MEX wins (MEX 9pts)
      [0, 1], // KOR vs CZE: CZE wins (CZE 6pts, KOR 3pts)
    );
    // MEX: 9pts, CZE: 6pts, KOR: 3pts, RSA: 0pts
    // Predicted order: MEX(0), CZE(2), KOR(1), RSA(3)
    const result = validateGroup("A", [0, 2, 1, 3], scores);
    expect(result.isValid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it("detects conflict when scores contradict predicted order", () => {
    // Scores that would put RSA first but we predict MEX first
    const scores = makeScores(
      [0, 2], // MEX vs KOR: KOR wins
      [0, 3], // CZE vs RSA: RSA wins
      [0, 1], // MEX vs CZE: CZE wins
      [0, 2], // RSA vs KOR: RSA wins (wrong position for "away" — RSA is away)
      [2, 0], // RSA vs MEX: RSA wins
      [1, 0], // KOR vs CZE: KOR wins
    );
    // Predict MEX 1st but they lost all games
    const result = validateGroup("A", [0, 1, 2, 3], scores);
    expect(result.isValid).toBe(false);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("returns valid when no scores are entered", () => {
    const emptyScores: GroupMatchScore[] = Array.from({ length: 6 }, () => ({ home: null, away: null }));
    const result = validateGroup("A", [0, 1, 2, 3], emptyScores);
    expect(result.isValid).toBe(true);
  });

  it("returns valid for non-existent group", () => {
    const result = validateGroup("Z", [0, 1, 2, 3], []);
    expect(result.isValid).toBe(true);
  });
});

describe("validateSpecialBets", () => {
  const baseState: BettingState = {
    groups: {},
    knockout: {},
    specialBets: {
      winner: "",
      finalist1: "",
      finalist2: "",
      semifinalists: [],
      quarterfinalists: [],
      topScorer: { team: "", player: "" },
      topAssists: { team: "", player: "" },
      bestAttack: "",
      dirtiestTeam: "",
      prolificGroup: "",
      driestGroup: "",
      matchups: [],
      penaltiesOverUnder: null,
    },
  };

  it("is valid when all empty", () => {
    const result = validateSpecialBets(baseState);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when winner not in finalists", () => {
    const state = {
      ...baseState,
      specialBets: {
        ...baseState.specialBets,
        winner: "BRA",
        finalist1: "ARG",
        finalist2: "GER",
      },
    };
    const result = validateSpecialBets(state);
    expect(result.isValid).toBe(false);
    expect(result.warnings.some(w => w.includes("הזוכה"))).toBe(true);
  });

  it("is valid when winner is one of the finalists", () => {
    const state = {
      ...baseState,
      specialBets: {
        ...baseState.specialBets,
        winner: "ARG",
        finalist1: "ARG",
        finalist2: "GER",
      },
    };
    const result = validateSpecialBets(state);
    expect(result.warnings.filter(w => w.includes("הזוכה"))).toHaveLength(0);
  });

  it("warns when prolific and driest group are the same", () => {
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
    expect(result.warnings.some(w => w.includes("פורה"))).toBe(true);
  });

  it("warns when finalist not in semifinalists", () => {
    const state = {
      ...baseState,
      specialBets: {
        ...baseState.specialBets,
        finalist1: "BRA",
        semifinalists: ["ARG", "GER", "FRA", "ESP"],
      },
    };
    const result = validateSpecialBets(state);
    expect(result.isValid).toBe(false);
    expect(result.warnings.some(w => w.includes("BRA"))).toBe(true);
  });

  it("warns when semifinalist not in quarterfinalists", () => {
    const state = {
      ...baseState,
      specialBets: {
        ...baseState.specialBets,
        semifinalists: ["BRA"],
        quarterfinalists: ["ARG", "GER", "FRA", "ESP", "ENG", "POR", "NED", "URU"],
      },
    };
    const result = validateSpecialBets(state);
    expect(result.isValid).toBe(false);
    expect(result.warnings.some(w => w.includes("BRA"))).toBe(true);
  });
});
