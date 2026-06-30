import { describe, it, expect } from "vitest";
import { computePlayerHistories } from "@/lib/scoring/live-scorer";
import type { BettorBracket } from "@/lib/supabase/shared-data";
import type { FinishedMatch } from "@/lib/results-hits";
import { SCORING } from "@/types";

// Groups A + B fully played (clean home-wins-1-0 ladder) so r32l_0 = A2 v B2
// (KOR v CAN) resolves, plus the real R32 match KOR 2-1 CAN.
let mid = 1;
const gm = (h: string, a: string, hg: number, ag: number, group: string, stage = "GROUP_STAGE"): FinishedMatch => ({
  id: mid++, date: "2026-06-15T16:00:00Z", homeTla: h, awayTla: a, group, stage, homeGoals: hg, awayGoals: ag,
});
const groupMatches = (letter: string, order: [string, string, string, string]): FinishedMatch[] => {
  const [a, b, c, d] = order;
  const g = `GROUP_${letter}`;
  return [gm(a, b, 1, 0, g), gm(a, c, 1, 0, g), gm(a, d, 1, 0, g), gm(b, c, 1, 0, g), gm(b, d, 1, 0, g), gm(c, d, 1, 0, g)];
};
const MATCHES: FinishedMatch[] = [
  ...groupMatches("A", ["MEX", "KOR", "CZE", "RSA"]),
  ...groupMatches("B", ["SUI", "CAN", "QAT", "BIH"]),
  { id: 999, date: "2026-06-29T20:00:00Z", homeTla: "KOR", awayTla: "CAN", group: "", stage: "LAST_32", homeGoals: 2, awayGoals: 1 },
];

const bracket = (over: Partial<BettorBracket> = {}): BettorBracket => ({
  userId: "u", displayName: "U", groupPredictions: {}, knockoutTree: {}, knockoutTreeLive: {},
  champion: null, lockedAt: null, ...over,
});

describe("computePlayerHistories — knockout matches now move the trend", () => {
  it("adds KO toto+exact at the KO match (no longer frozen at the group stage)", () => {
    const nailed = bracket({ userId: "a", knockoutTreeLive: { r32l_0: { score1: 2, score2: 1, winner: "KOR" } } });
    const blank = bracket({ userId: "b" });
    const hist = computePlayerHistories([nailed, blank], MATCHES, SCORING);

    // One point per match plus the leading zero.
    expect(hist["a"]).toHaveLength(MATCHES.length + 1);
    // The KO match (last step) lifts the nailer by exactly R32 toto+exact...
    const a = hist["a"];
    expect(a[a.length - 1] - a[a.length - 2]).toBe(SCORING.toto.R32 + SCORING.exact.R32);
    // ...while the blank bracket flatlines across the KO match.
    const b = hist["b"];
    expect(b[b.length - 1]).toBe(b[b.length - 2]);
  });
});
