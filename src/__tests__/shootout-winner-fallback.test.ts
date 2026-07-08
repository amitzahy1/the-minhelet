import { describe, it, expect } from "vitest";
import { koWinnerFromScore, decisivePenalties, type MatchResult } from "@/lib/api-football-data";
import { buildResultRows } from "@/lib/sync-results";
import {
  fillKnockoutFixturesFromTree,
  type KoSlotKey,
  type SlotState,
} from "@/lib/scoring/knockout-resolver";

// ============================================================================
// Regression: SUI–COL R16 (2026-07-07). FD's free tier published the finished
// shootout with winner:null and penalties 3–3 (a decided shootout can't tie) —
// only fullTime (4–3, shootout-inclusive) carried the truth. The resolver got
// no winner → SUI never advanced to the QF slot → 4 bettors were short 3
// advancement points each, AND FD left the ARG QF fixture TBD-vs-TBD so it
// had no kickoff, no lock row, and unsaveable picks.
// ============================================================================

const score = (s: Partial<MatchResult["score"]>): MatchResult["score"] =>
  ({ winner: null, fullTime: { home: null, away: null }, halfTime: { home: null, away: null }, ...s });

// The exact broken payload FD served for the finished SUI–COL match.
const SUI_COL_SCORE = score({
  winner: null,
  duration: "PENALTY_SHOOTOUT",
  fullTime: { home: 4, away: 3 },
  regularTime: { home: 0, away: 0 },
  extraTime: { home: 0, away: 0 },
  penalties: { home: 3, away: 3 },
});

describe("koWinnerFromScore", () => {
  it("passes through FD's explicit winner untouched", () => {
    expect(koWinnerFromScore(score({ winner: "AWAY_TEAM", fullTime: { home: 4, away: 3 } }), "FINISHED")).toBe("AWAY_TEAM");
    expect(koWinnerFromScore(score({ winner: "DRAW", fullTime: { home: 1, away: 1 } }), "FINISHED")).toBe("DRAW");
  });

  it("SUI–COL regression: derives the winner from the decisive shootout-inclusive fullTime", () => {
    expect(koWinnerFromScore(SUI_COL_SCORE, "FINISHED")).toBe("HOME_TEAM");
  });

  it("never synthesizes a winner for an unfinished match", () => {
    expect(koWinnerFromScore(SUI_COL_SCORE, "IN_PLAY")).toBeNull();
    expect(koWinnerFromScore(SUI_COL_SCORE, "TIMED")).toBeNull();
    expect(koWinnerFromScore(SUI_COL_SCORE, null)).toBeNull();
  });

  it("returns null when fullTime is tied or missing (nothing to derive from)", () => {
    expect(koWinnerFromScore(score({ fullTime: { home: 1, away: 1 } }), "FINISHED")).toBeNull();
    expect(koWinnerFromScore(score({}), "FINISHED")).toBeNull();
    expect(koWinnerFromScore(null, "FINISHED")).toBeNull();
  });
});

describe("decisivePenalties", () => {
  it("passes a real shootout score through", () => {
    expect(decisivePenalties(score({ penalties: { home: 4, away: 3 } }))).toEqual({ home: 4, away: 3 });
  });

  it("drops the impossible tied-pens pair FD served on SUI–COL", () => {
    expect(decisivePenalties(SUI_COL_SCORE)).toEqual({ home: null, away: null });
  });

  it("drops partial/missing pens", () => {
    expect(decisivePenalties(score({ penalties: { home: 4, away: null } }))).toEqual({ home: null, away: null });
    expect(decisivePenalties(score({}))).toEqual({ home: null, away: null });
  });

  it("buildResultRows never persists a tied shootout score", () => {
    const rows = buildResultRows(
      [
        {
          id: 537382, utcDate: "2026-07-07T20:00:00Z", status: "FINISHED", matchday: 5,
          stage: "LAST_16", group: null,
          homeTeam: { id: 1, name: "Switzerland", shortName: "Switzerland", tla: "SUI", crest: "" },
          awayTeam: { id: 2, name: "Colombia", shortName: "Colombia", tla: "COL", crest: "" },
          score: SUI_COL_SCORE,
        } as MatchResult,
      ],
      "test-sync",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].home_goals).toBe(0);
    expect(rows[0].away_goals).toBe(0);
    expect(rows[0].home_penalties).toBeNull();
    expect(rows[0].away_penalties).toBeNull();
  });
});

describe("fillKnockoutFixturesFromTree", () => {
  // Minimal hand-built tree: only the QF slots matter for the fixture fill.
  const slot = (key: string, stage: SlotState["stage"], team1: string | null, team2: string | null): SlotState =>
    ({ key: key as KoSlotKey, team1, team2, score1: null, score2: null, winner: null, stage, isThirdPlace: false });
  const qfTree = {
    qfl_0: slot("qfl_0", "QF", "FRA", "MAR"),
    qfl_1: slot("qfl_1", "QF", "ESP", "BEL"),
    qfr_0: slot("qfr_0", "QF", "NOR", "ENG"),
    qfr_1: slot("qfr_1", "QF", "ARG", "SUI"),
  } as Record<KoSlotKey, SlotState>;

  const fixture = (homeTla: string, awayTla: string, stage = "QUARTER_FINALS") =>
    ({ stage, homeTla, awayTla, homeTeam: homeTla, awayTeam: awayTla });

  it("SUI–COL regression: fills the single TBD-vs-TBD QF fixture once the other three anchor", () => {
    const fixtures = [
      fixture("FRA", "MAR"),
      fixture("ESP", "BEL"),
      fixture("NOR", "ENG"),
      fixture("TBD", "TBD"),
    ];
    expect(fillKnockoutFixturesFromTree(fixtures, qfTree)).toBe(1);
    expect(fixtures[3].homeTla).toBe("ARG");
    expect(fixtures[3].awayTla).toBe("SUI");
  });

  it("fills the TBD side of a fixture whose other side is known", () => {
    const fixtures = [fixture("ARG", "TBD")];
    expect(fillKnockoutFixturesFromTree(fixtures, qfTree)).toBe(1);
    expect(fixtures[0].awayTla).toBe("SUI");
  });

  it("refuses to guess when two fully-TBD fixtures compete for slots", () => {
    const fixtures = [
      fixture("FRA", "MAR"),
      fixture("ESP", "BEL"),
      fixture("TBD", "TBD"),
      fixture("TBD", "TBD"),
    ];
    expect(fillKnockoutFixturesFromTree(fixtures, qfTree)).toBe(0);
    expect(fixtures[2].homeTla).toBe("TBD");
    expect(fixtures[3].homeTla).toBe("TBD");
  });

  it("does not fill from an unresolved slot", () => {
    const partial = { qfr_1: slot("qfr_1", "QF", "ARG", null) } as Record<KoSlotKey, SlotState>;
    const fixtures = [fixture("TBD", "TBD")];
    expect(fillKnockoutFixturesFromTree(fixtures, partial)).toBe(0);
  });

  it("leaves anchored (already-known) fixtures untouched", () => {
    const fixtures = [fixture("FRA", "MAR")];
    fillKnockoutFixturesFromTree(fixtures, qfTree);
    expect(fixtures[0]).toMatchObject({ homeTla: "FRA", awayTla: "MAR" });
  });
});

