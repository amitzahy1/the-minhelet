import { describe, it, expect } from "vitest";
import { revalidateTree1 } from "@/lib/tournament/revalidate-bracket";
import { deriveUserR32Matchups } from "@/lib/tournament/user-bracket-derivation";
import { resolveGroupSlot } from "@/lib/tournament/knockout-derivation";
import { GROUP_LETTERS } from "@/lib/tournament/groups";

// Same sample bettor scores as user-bracket-derivation.test (best-8 thirds = A,B,E,F,G,I,K,L).
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
    groups[letter] = { order: [0, 1, 2, 3], scores: (scores[letter] ?? []).map(([home, away]) => ({ home, away })) };
  }
  return groups;
}

const emptyAdvancement = () => ({
  winner: "", finalist1: "", finalist2: "",
  semifinalists: ["", "", "", ""], quarterfinalists: ["", "", "", "", "", "", "", ""],
  roundOf16: ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
});

describe("revalidateTree1", () => {
  it("clears ONLY the invalid pick + its advancement, keeps valid picks", () => {
    const groups = buildGroups(SCORES);
    const { matchups } = deriveUserR32Matchups(groups);
    const validWinner = resolveGroupSlot(matchups.r32l_2.h, groups)!; // a real participant of r32l_2

    const knockout = {
      // RSA finished 4th in group A → can never be in any R32 slot → invalid.
      r32l_0: { score1: null, score2: null, winner: "RSA" },
      // A genuine participant of r32l_2 → must be kept.
      r32l_2: { score1: null, score2: null, winner: validWinner },
    };
    const sb = { ...emptyAdvancement(), quarterfinalists: ["RSA", "", "", "", "", "", "", ""] };

    const res = revalidateTree1(groups, knockout, sb);
    expect(res.changed).toBe(true);
    expect(res.invalidSlots).toContain("r32l_0");
    expect(res.invalidSlots).not.toContain("r32l_2");
    expect(res.knockout.r32l_0.winner).toBeNull();
    expect(res.knockout.r32l_2.winner).toBe(validWinner); // preserved
    expect(res.clearedTeams).toContain("RSA");
    expect(res.specialBets.quarterfinalists).not.toContain("RSA");
  });

  it("is a no-op when every stored winner is a valid participant", () => {
    const groups = buildGroups(SCORES);
    const { matchups } = deriveUserR32Matchups(groups);
    const knockout: Record<string, { score1: number | null; score2: number | null; winner: string | null }> = {};
    // Fill every R32 slot's winner with a real participant (team1).
    for (const key of Object.keys(matchups)) {
      const w = resolveGroupSlot(matchups[key].h, groups);
      if (w) knockout[key] = { score1: null, score2: null, winner: w };
    }
    const res = revalidateTree1(groups, knockout, emptyAdvancement());
    expect(res.changed).toBe(false);
    expect(res.invalidSlots).toHaveLength(0);
  });

  it("never clears picks while the group stage is incomplete (thirds not resolvable)", () => {
    const partial = buildGroups(SCORES);
    partial.A.scores = [{ home: null, away: null }];
    // A pick that WOULD look invalid, but thirds aren't ready → leave it alone.
    const knockout = { r32l_4: { score1: null, score2: null, winner: "RSA" } };
    const res = revalidateTree1(partial, knockout, emptyAdvancement());
    expect(res.changed).toBe(false);
    expect(res.knockout.r32l_4.winner).toBe("RSA");
  });
});
