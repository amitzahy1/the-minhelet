import { describe, it, expect } from "vitest";
import { computeLiveScores } from "@/lib/scoring/live-scorer";
import type { BettorBracket, BettorAdvancement } from "@/lib/supabase/shared-data";
import type { FinishedMatch } from "@/lib/results-hits";

// ============================================================================
// LIVE leaderboard scope: the `liveMatches` option folds in-play matches into
// MATCH-RESULT points only — advancement / who-qualifies / specials stay on the
// FINISHED `matches` arg. Pins two guarantees:
//   (A) omitting liveMatches (or passing the finished set as liveMatches) is
//       byte-identical to the old behavior → no regression to the live table;
//   (B) an in-play result moves match points but NEVER advancement.
// ============================================================================

// Group A canonical order: MEX(0) KOR(1) CZE(2) RSA(3); pair 0 = MEX vs KOR.
const fm = (h: string, a: string, hg: number, ag: number, group: string, id: number): FinishedMatch =>
  ({ id, date: "2026-06-15T16:00:00Z", homeTla: h, awayTla: a, group, stage: "GROUP_STAGE", homeGoals: hg, awayGoals: ag });

// Predicts MEX 1-0 KOR (group A, pair 0) — an EXACT hit for that scoreline.
const bracket: BettorBracket = {
  userId: "u1",
  displayName: "Tester",
  groupPredictions: {
    A: { order: [0, 1, 2, 3], scores: [{ home: 1, away: 0 }, { home: 0, away: 0 }, { home: 0, away: 0 }, { home: 0, away: 0 }, { home: 0, away: 0 }, { home: 0, away: 0 }] },
  },
  knockoutTree: {},
  knockoutTreeLive: {},
  champion: null,
  lockedAt: null,
};

describe("live leaderboard scoping", () => {
  it("(A) liveMatches === finished set is identical to omitting it", () => {
    const finished = [fm("MEX", "KOR", 1, 0, "A", 1)];
    const base = computeLiveScores([bracket], finished, {});
    const equiv = computeLiveScores([bracket], finished, { liveMatches: finished });
    expect(equiv.u1.matchPts).toBe(base.u1.matchPts);
    expect(equiv.u1.advPts).toBe(base.u1.advPts);
    expect(equiv.u1.specPts).toBe(base.u1.specPts);
    expect(equiv.u1.total).toBe(base.u1.total);
  });

  it("(B) an in-play match folds into match points but advancement stays frozen", () => {
    const adv: BettorAdvancement = {
      userId: "u1", displayName: "Tester",
      groupQualifiers: { A: ["MEX", "KOR"] },
      advanceToR16: [], advanceToQF: [], advanceToSF: [], advanceToFinal: [], winner: "",
    };
    // No FINISHED matches; one in-play MEX 1-0 KOR passed only as liveMatches.
    const live = [fm("MEX", "KOR", 1, 0, "A", 1)];
    const noLive = computeLiveScores([bracket], [], { advancements: [adv] });
    const withLive = computeLiveScores([bracket], [], { advancements: [adv], liveMatches: live });

    // Match points move: exact MEX 1-0 → toto(2) + exact(1) = 3.
    expect(noLive.u1.matchPts).toBe(0);
    expect(withLive.u1.matchPts).toBe(3);
    // Advancement must NOT move on a single in-play match (group not resolved).
    expect(noLive.u1.advPts).toBe(0);
    expect(withLive.u1.advPts).toBe(0);
    expect(withLive.u1.advPts).toBe(noLive.u1.advPts);
  });
});
