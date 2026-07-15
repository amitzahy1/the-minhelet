import { describe, it, expect } from "vitest";
import { ninetyMinuteScore, fullTime120Score, type MatchResult } from "@/lib/api-football-data";
import { buildResultRows } from "@/lib/sync-results";
import { aggregateTeamStats } from "@/lib/tournament-stats";

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
    // The SPECIAL bets count the full match: the ET goal makes it 3–2 at 120'.
    expect(rows[0]).toMatchObject({ home_goals_120: 3, away_goals_120: 2 });
  });
});

// ============================================================================
// The 120' score (regulation + extra time, EXCLUDING the shootout) is what the
// special bets count (best-attack team goals). An extra-time goal must count; a
// shootout kick must NOT.
// ============================================================================
describe("fullTime120Score", () => {
  it("REGULAR (90'): equals fullTime", () => {
    expect(fullTime120Score(score({ fullTime: { home: 2, away: 1 } }))).toEqual({ home: 2, away: 1 });
  });

  it("EXTRA_TIME win, no shootout (BEL–SEN): counts the ET goal → 3–2", () => {
    expect(
      fullTime120Score(
        score({ winner: "HOME_TEAM", fullTime: { home: 3, away: 2 }, regularTime: { home: null, away: null }, extraTime: { home: 1, away: 0 } }),
      ),
    ).toEqual({ home: 3, away: 2 });
  });

  it("PENALTY_SHOOTOUT: drops the shootout (fullTime 4–5, reg 1–1) → 1–1", () => {
    expect(
      fullTime120Score(
        score({ fullTime: { home: 4, away: 5 }, regularTime: { home: 1, away: 1 }, extraTime: { home: 0, away: 0 }, penalties: { home: 3, away: 4 } }),
      ),
    ).toEqual({ home: 1, away: 1 });
  });

  it("ET goals THEN a shootout: keeps ET goals, drops the shootout → 2–2", () => {
    // 90' 1–1, each scores in ET → 2–2, then shootout (fullTime aggregates it).
    expect(
      fullTime120Score(
        score({ fullTime: { home: 5, away: 4 }, regularTime: { home: 1, away: 1 }, extraTime: { home: 1, away: 1 }, penalties: { home: 3, away: 2 } }),
      ),
    ).toEqual({ home: 2, away: 2 });
  });

  it("missing fullTime → null", () => {
    expect(fullTime120Score(score({ fullTime: { home: null, away: null } }))).toEqual({ home: null, away: null });
  });
});

describe("aggregateTeamStats — best attack counts 120' goals", () => {
  const row = (
    home: string, away: string, hg: number, ag: number,
    extra: { home_goals_120?: number; away_goals_120?: number; stage?: string } = {},
  ) => ({
    home_team: home, away_team: away, home_goals: hg, away_goals: ag,
    home_goals_120: extra.home_goals_120 ?? null, away_goals_120: extra.away_goals_120 ?? null,
    group_id: null, stage: extra.stage ?? "R16", status: "FINISHED",
  });

  it("adds the extra-time goal to goalsFor (not just the 90' score)", () => {
    // BEL 2–2 at 90', 3–2 at 120'. Best-attack must credit BEL with 3, not 2.
    const stats = aggregateTeamStats([row("BEL", "SEN", 2, 2, { home_goals_120: 3, away_goals_120: 2 })]);
    const bel = stats.find((s) => s.code === "BEL");
    expect(bel?.goalsFor).toBe(3);
  });

  it("falls back to the 90' score when the 120' columns are null", () => {
    const stats = aggregateTeamStats([row("ARG", "FRA", 2, 1)]);
    expect(stats.find((s) => s.code === "ARG")?.goalsFor).toBe(2);
  });
});
