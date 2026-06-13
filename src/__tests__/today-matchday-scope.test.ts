import { describe, it, expect } from "vitest";
import { computeTodayScores } from "@/lib/scoring/live-scorer";
import { matchDayKey } from "@/lib/tournament/group-live-state";
import type { BettorBracket } from "@/lib/supabase/shared-data";
import type { FinishedMatch } from "@/lib/results-hits";

// ============================================================================
// "+היום" scope = the CURRENT day-of-play (17:00→17:00 Israel bucket), NOT the
// calendar date. A 04:00 kickoff and a 22:00 kickoff fall on the same calendar
// date but DIFFERENT days-of-play, so an early-morning match from last night's
// batch must not inflate "+היום" once tonight's games begin. (Regression: on
// 2026-06-13 "היום" showed 4 — USA-PAR 04:00 + live QAT-SUI 22:00 — when only
// the live 22:00 match should have counted.)
// ============================================================================

// Group A canonical pair order: [0,1],[2,3],...  → pair0 = MEX(0) v KOR(1),
// pair1 = CZE(2) v RSA(3). Predicts pair0 MEX 1-0 (exact) and pair1 CZE 2-0 (exact).
const bracket: BettorBracket = {
  userId: "u1",
  displayName: "Tester",
  groupPredictions: {
    A: {
      order: [0, 1, 2, 3],
      scores: [
        { home: 1, away: 0 }, // pair0 MEX-KOR
        { home: 2, away: 0 }, // pair1 CZE-RSA
        { home: 0, away: 0 },
        { home: 0, away: 0 },
        { home: 0, away: 0 },
        { home: 0, away: 0 },
      ],
    },
  },
  knockoutTree: {},
  knockoutTreeLive: {},
  champion: null,
  lockedAt: null,
};

const fm = (h: string, a: string, hg: number, ag: number, date: string, id: number): FinishedMatch => ({
  id,
  date,
  homeTla: h,
  awayTla: a,
  group: "A",
  stage: "GROUP_STAGE",
  homeGoals: hg,
  awayGoals: ag,
});

// Last night's batch (04:00 IL Jun 13 → day-of-play Jun 12) — an EXACT hit (3 pts).
const lastNight = fm("MEX", "KOR", 1, 0, "2026-06-13T01:00:00Z", 1);
// Tonight's batch (22:00 IL Jun 13 → day-of-play Jun 13) — an EXACT hit (3 pts).
const tonight = fm("CZE", "RSA", 2, 0, "2026-06-13T19:00:00Z", 2);

describe("+היום scope = current day-of-play (17:00 boundary)", () => {
  it("buckets a 04:00 and a 22:00 kickoff on the SAME date into DIFFERENT days-of-play", () => {
    expect(matchDayKey("2026-06-13T01:00:00Z")).toBe("2026-06-12"); // 04:00 IL → previous day-of-play
    expect(matchDayKey("2026-06-13T19:00:00Z")).toBe("2026-06-13"); // 22:00 IL → its own day-of-play
  });

  it("during tonight's batch, counts ONLY tonight's match (not last night's 04:00)", () => {
    // now = 23:00 IL Jun 13 (mid-evening) → day-of-play Jun 13.
    const today = computeTodayScores([bracket], [lastNight, tonight], undefined, "2026-06-13T20:00:00Z");
    expect(today.u1).toBe(3); // CZE-RSA exact only — NOT 6
  });

  it("during last night's batch (late morning), counts ONLY last night's match", () => {
    // now = 11:00 IL Jun 13 (before the 17:00 rollover) → day-of-play Jun 12.
    const today = computeTodayScores([bracket], [lastNight, tonight], undefined, "2026-06-13T08:00:00Z");
    expect(today.u1).toBe(3); // MEX-KOR exact only
  });

  it("rolls over to the new day-of-play exactly at 17:00 Israel", () => {
    // 16:59 IL Jun 13 = 13:59Z → still Jun 12; 17:00 IL Jun 13 = 14:00Z → Jun 13.
    expect(matchDayKey("2026-06-13T13:59:00Z")).toBe("2026-06-12");
    expect(matchDayKey("2026-06-13T14:00:00Z")).toBe("2026-06-13");
  });

  it("returns 0 for everyone when no match belongs to the current day-of-play", () => {
    // now in an empty future day-of-play → no matches counted.
    const today = computeTodayScores([bracket], [lastNight, tonight], undefined, "2026-06-20T20:00:00Z");
    expect(today.u1).toBe(0);
  });
});
