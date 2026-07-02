import { describe, it, expect } from "vitest";
import { ninetyMinuteScore, type MatchResult } from "@/lib/api-football-data";
import { buildResultRows } from "@/lib/sync-results";

// ============================================================================
// Regression: the 90-minute (regulation) score football-data reports THREE
// different ways depending on how a KO match ended. The old `regularTime ??
// fullTime` mis-read the extra-time-win-NO-shootout case, storing the 120'
// score (BEL–SEN R32 2026-07-01: fullTime 3–2 / regularTime null / extraTime
// 1–0 → the app scored the score bet as a 3–2 Belgium win instead of the real
// 2–2 draw). ninetyMinuteScore strips ET + shootout goals off the aggregate.
// ============================================================================

const score = (s: Partial<MatchResult["score"]>): MatchResult["score"] =>
  ({ winner: null, fullTime: { home: null, away: null }, halfTime: { home: null, away: null }, ...s });

describe("ninetyMinuteScore", () => {
  it("REGULAR (decided in 90'): fullTime IS the 90' score", () => {
    expect(ninetyMinuteScore(score({ fullTime: { home: 2, away: 1 } }))).toEqual({ home: 2, away: 1 });
  });

  it("PENALTY_SHOOTOUT: uses regularTime, ignores the shootout-inflated fullTime", () => {
    // Verified FD shape: fullTime AGGREGATES the shootout (4–5), regularTime is 1–1.
    expect(
      ninetyMinuteScore(
        score({ fullTime: { home: 4, away: 5 }, regularTime: { home: 1, away: 1 }, extraTime: { home: 0, away: 0 }, penalties: { home: 3, away: 4 } }),
      ),
    ).toEqual({ home: 1, away: 1 });
  });

  it("EXTRA_TIME win, NO shootout, regularTime NULL: strips ET off fullTime (the bug)", () => {
    // The exact BEL–SEN payload. Old code returned 3–2; correct 90' is 2–2.
    expect(
      ninetyMinuteScore(
        score({ winner: "HOME_TEAM", fullTime: { home: 3, away: 2 }, regularTime: { home: null, away: null }, extraTime: { home: 1, away: 0 } }),
      ),
    ).toEqual({ home: 2, away: 2 });
  });

  it("missing fullTime → null (FD FINISHED-but-no-score window)", () => {
    expect(ninetyMinuteScore(score({ fullTime: { home: null, away: null } }))).toEqual({ home: null, away: null });
    expect(ninetyMinuteScore(undefined)).toEqual({ home: null, away: null });
  });
});

describe("buildResultRows — 90' score for an ET-decided knockout", () => {
  const fd = (s: Partial<MatchResult["score"]>): MatchResult => ({
    id: 537422, utcDate: "2026-07-01T20:00:00Z", status: "FINISHED", matchday: 0, stage: "LAST_32", group: null,
    homeTeam: { id: 1, name: "Belgium", shortName: "Belgium", tla: "BEL", crest: "" },
    awayTeam: { id: 2, name: "Senegal", shortName: "Senegal", tla: "SEN", crest: "" },
    score: score(s),
  });

  it("stores the 2–2 regulation score (not the 3–2 aggregate), penalties null", () => {
    const rows = buildResultRows(
      [fd({ winner: "HOME_TEAM", duration: "EXTRA_TIME", fullTime: { home: 3, away: 2 }, regularTime: { home: null, away: null }, extraTime: { home: 1, away: 0 } })],
      "test",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      match_id: "537422", stage: "R32", home_team: "BEL", away_team: "SEN",
      home_goals: 2, away_goals: 2, home_penalties: null, away_penalties: null,
    });
  });
});
