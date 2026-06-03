import { describe, it, expect } from "vitest";
import { computeLiveScores } from "@/lib/scoring/live-scorer";
import { resolveKnockoutTree } from "@/lib/scoring/knockout-resolver";
import { computeMatchDays } from "@/lib/tournament/group-live-state";
import { computePredictionLockRows, type LockSyncMatch } from "@/lib/scoring/compute-prediction-locks";
import type { BettorBracket } from "@/lib/supabase/shared-data";
import type { FinishedMatch } from "@/lib/results-hits";

// ============================================================================
// End-to-end "real results arrive" smoke: feed football-data-shaped FINISHED
// matches through the REAL pipeline (resolver → live scorer → match-day locks)
// and assert it never throws and feeds every consumer. Specifically pins the
// 90-minute-score rule and the true-winner advancement for knockouts:
//   • the exact/toto bet is judged on the 90' score (regularTime),
//   • the bracket advances the REAL qualifier (ET / shootout), derived from the
//     feed `winner` (covers an ET win with NO shootout) then the penalty score.
// ============================================================================

let mid = 1;
type Extra = Partial<Pick<FinishedMatch, "homePenalties" | "awayPenalties" | "winner">>;
const gm = (
  h: string, a: string, hg: number, ag: number, group: string, stage = "GROUP_STAGE", extra: Extra = {},
): FinishedMatch => ({
  id: mid++, date: "2026-06-15T16:00:00Z", homeTla: h, awayTla: a, group, stage, homeGoals: hg, awayGoals: ag, ...extra,
});

// Group "home team wins 1-0" → clean 9/6/3/0 ladder, so standings == this order.
// FinishedMatch.group is the NORMALIZED letter (consumers run normalizeGroupLetter
// before building it), so we store the letter — what computeGroupHits expects.
function groupMatches(letter: string, order: [string, string, string, string]): FinishedMatch[] {
  const [a, b, c, d] = order;
  const g = letter;
  return [gm(a, b, 1, 0, g), gm(a, c, 1, 0, g), gm(a, d, 1, 0, g), gm(b, c, 1, 0, g), gm(b, d, 1, 0, g), gm(c, d, 1, 0, g)];
}

// Groups A + B fully played → r32l_0 = A2 v B2 = KOR v CAN resolves.
const GROUPS_AB: FinishedMatch[] = [
  ...groupMatches("A", ["MEX", "KOR", "CZE", "RSA"]),
  ...groupMatches("B", ["SUI", "CAN", "QAT", "BIH"]),
];

const withKo = (ko: FinishedMatch): FinishedMatch[] => [...GROUPS_AB, ko];

describe("live-results pipeline — knockout 90' score + true-winner advancement", () => {
  it("90'-decisive KO: winner from goals, score = 90'", () => {
    const tree = resolveKnockoutTree(withKo(gm("KOR", "CAN", 2, 1, "", "LAST_32", { winner: "HOME_TEAM" })), null);
    expect(tree.r32l_0.winner).toBe("KOR");
    expect([tree.r32l_0.score1, tree.r32l_0.score2].sort()).toEqual([1, 2]);
  });

  it("extra-time win, NO shootout: 90' draw stored, winner from feed (the gap that broke without it)", () => {
    // 0-0 at 90', KOR win in ET → no penalty score to read; only the feed winner saves it.
    const tree = resolveKnockoutTree(withKo(gm("KOR", "CAN", 0, 0, "", "LAST_32", { winner: "HOME_TEAM" })), null);
    expect(tree.r32l_0.score1).toBe(0);
    expect(tree.r32l_0.score2).toBe(0);
    expect(tree.r32l_0.winner).toBe("KOR"); // advances the ET winner, not null
  });

  it("penalty shootout: score = 90' (NOT the shootout aggregate), winner from penalties", () => {
    const tree = resolveKnockoutTree(
      withKo(gm("KOR", "CAN", 1, 1, "", "LAST_32", { homePenalties: 4, awayPenalties: 2 })),
      null,
    );
    expect(tree.r32l_0.score1).toBe(1); // 90' — never 1+penalties
    expect(tree.r32l_0.score2).toBe(1);
    expect(tree.r32l_0.winner).toBe("KOR"); // shootout winner
  });

  it("scores the exact KO bet on the 90' draw while crediting the advancing pick", () => {
    const matches = withKo(gm("KOR", "CAN", 0, 0, "", "LAST_32", { homePenalties: 5, awayPenalties: 4 }));
    const b: BettorBracket = {
      userId: "u1", displayName: "U1", groupPredictions: {}, knockoutTree: {},
      knockoutTreeLive: { r32l_0: { score1: 0, score2: 0, winner: "KOR" } },
      champion: null, lockedAt: null,
    };
    const scores = computeLiveScores([b], matches);
    expect(scores["u1"].exactKnockout).toBeGreaterThan(0); // 0-0 matched the 90' score
    expect(scores["u1"].totoKnockout).toBeGreaterThan(0);   // KOR was the qualifier
  });
});

describe("live-results pipeline — group scoring + locks don't crash and feed the site", () => {
  it("group exact/toto scoring works off finished results", () => {
    // Predict MEX 1-0 KOR (group A, canonical pair 0) → exact.
    const b: BettorBracket = {
      userId: "u1", displayName: "U1",
      groupPredictions: { A: { order: [0, 1, 2, 3], scores: [{ home: 1, away: 0 }, { home: null, away: null }, { home: null, away: null }, { home: null, away: null }, { home: null, away: null }, { home: null, away: null }] } },
      knockoutTree: {}, knockoutTreeLive: {}, champion: null, lockedAt: null,
    };
    const scores = computeLiveScores([b], GROUPS_AB);
    expect(scores["u1"].exactGroup).toBeGreaterThan(0);
    expect(scores["u1"].totoGroup).toBeGreaterThan(0);
  });

  it("match-day + prediction-lock computation runs over the full fixture without throwing", () => {
    const fixture: LockSyncMatch[] = withKo(gm("KOR", "CAN", 1, 1, "", "LAST_32", { homePenalties: 4, awayPenalties: 2 }))
      .map((m) => ({ ...m, status: "FINISHED" as const }));
    expect(() => computeMatchDays(fixture)).not.toThrow();
    const rows = computePredictionLockRows(fixture);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.scope === "group")).toBe(true);
  });
});
