import { describe, it, expect } from "vitest";
import { computeLiveScores, KO_TOTO_PTS } from "@/lib/scoring/live-scorer";
import type { BettorBracket } from "@/lib/supabase/shared-data";
import type { FinishedMatch } from "@/lib/results-hits";
import { SCORING } from "@/types";

// ── Fixture: groups A + B fully played so r32l_0 (= A2 v B2) resolves, plus the
// real R32 match between them. Group "home team wins 1-0" gives a clean
// 9/6/3/0 ladder, so the standings order == the order array passed in.
let mid = 1;
const gm = (h: string, a: string, hg: number, ag: number, group: string, stage = "GROUP_STAGE"): FinishedMatch => ({
  id: mid++, date: "2026-06-15T16:00:00Z", homeTla: h, awayTla: a, group, stage, homeGoals: hg, awayGoals: ag,
});
function groupMatches(letter: string, order: [string, string, string, string]): FinishedMatch[] {
  const [a, b, c, d] = order;
  const g = `GROUP_${letter}`;
  return [gm(a, b, 1, 0, g), gm(a, c, 1, 0, g), gm(a, d, 1, 0, g), gm(b, c, 1, 0, g), gm(b, d, 1, 0, g), gm(c, d, 1, 0, g)];
}

// A2 = KOR, B2 = CAN; real R32 result KOR 2-1 CAN (KOR advances).
const MATCHES: FinishedMatch[] = [
  ...groupMatches("A", ["MEX", "KOR", "CZE", "RSA"]),
  ...groupMatches("B", ["SUI", "CAN", "QAT", "BIH"]),
  gm("KOR", "CAN", 2, 1, "", "LAST_16"),
];

const bracket = (over: Partial<BettorBracket> = {}): BettorBracket => ({
  userId: "u1",
  displayName: "U1",
  groupPredictions: {},
  knockoutTree: {},
  knockoutTreeLive: {},
  champion: null,
  lockedAt: null,
  ...over,
});

describe("two-tree knockout scoring split", () => {
  it("Tree 1 (simulation) earns ZERO knockout match-result points", () => {
    const b = bracket({ knockoutTree: { r32l_0: { score1: 2, score2: 1, winner: "KOR" } } });
    const scores = computeLiveScores([b], MATCHES);
    expect(scores["u1"].totoKnockout).toBe(0);
    expect(scores["u1"].exactKnockout).toBe(0);
  });

  it("Tree 2 (real-data) earns toto + exact on a correct prediction", () => {
    const b = bracket({ knockoutTreeLive: { r32l_0: { score1: 2, score2: 1, winner: "KOR" } } });
    const scores = computeLiveScores([b], MATCHES);
    expect(scores["u1"].totoKnockout).toBe(KO_TOTO_PTS);
    expect(scores["u1"].exactKnockout).toBe(SCORING.exact.R32);
  });

  it("both trees filled → scored only ONCE (from Tree 2), no double-count", () => {
    const b = bracket({
      knockoutTree: { r32l_0: { score1: 2, score2: 1, winner: "KOR" } },
      knockoutTreeLive: { r32l_0: { score1: 2, score2: 1, winner: "KOR" } },
    });
    const scores = computeLiveScores([b], MATCHES);
    expect(scores["u1"].totoKnockout).toBe(KO_TOTO_PTS);
    expect(scores["u1"].exactKnockout).toBe(SCORING.exact.R32);
  });

  it("Tree 2 right winner / wrong score → toto only, no exact bonus", () => {
    const b = bracket({ knockoutTreeLive: { r32l_0: { score1: 3, score2: 0, winner: "KOR" } } });
    const scores = computeLiveScores([b], MATCHES);
    expect(scores["u1"].totoKnockout).toBe(KO_TOTO_PTS);
    expect(scores["u1"].exactKnockout).toBe(0);
  });
});
