import { describe, it, expect } from "vitest";
import { calculateKnockoutScore } from "@/lib/scoring/calculator";
import { scoreSpecialBetsForUser, type TournamentActuals, type PlayerStat } from "@/lib/scoring/special-bets-scorer";
import type { BettorSpecialBets } from "@/lib/supabase/shared-data";
import { SCORING } from "@/types";

const baseBet = (overrides: Partial<BettorSpecialBets> = {}): BettorSpecialBets => ({
  userId: "u1",
  displayName: "User 1",
  topScorerTeam: null,
  topScorerPlayer: null,
  topAssistsTeam: null,
  topAssistsPlayer: null,
  bestAttackTeam: null,
  prolificGroup: null,
  driestGroup: null,
  dirtiestTeam: null,
  matchupPick: null,
  penaltiesOverUnder: null,
  ...overrides,
});

const noActuals: TournamentActuals = {
  top_scorer_player: null,
  top_assists_player: null,
  best_attack_team: null,
  most_prolific_group: null,
  driest_group: null,
  dirtiest_team: null,
  matchup_winner: null,
  penalties_over_under: null,
};

describe("calculateKnockoutScore — penalties + exact + toto", () => {
  it("decisive 90-min result: toto only when types match, no exact unless scores identical", () => {
    const r = calculateKnockoutScore(
      "R32",
      { homeGoals: 2, awayGoals: 1, penaltyWinner: null, team1: "BRA", team2: "JPN" },
      { score1: 3, score2: 1, winner: "BRA" }, // predicted home win 3-1
    );
    expect(r.toto).toBe(SCORING.toto.R32);
    expect(r.exact).toBe(0);
  });

  it("exact prediction earns toto + exact bonus", () => {
    const r = calculateKnockoutScore(
      "R32",
      { homeGoals: 2, awayGoals: 1, penaltyWinner: null, team1: "BRA", team2: "JPN" },
      { score1: 2, score2: 1, winner: "BRA" },
    );
    expect(r.toto).toBe(SCORING.toto.R32);
    expect(r.exact).toBe(SCORING.exact.R32);
  });

  it("regulation draw + correct penalty pick: full toto", () => {
    const r = calculateKnockoutScore(
      "R16",
      { homeGoals: 1, awayGoals: 1, penaltyWinner: "BRA", team1: "BRA", team2: "JPN" },
      { score1: 1, score2: 1, winner: "BRA" },
    );
    expect(r.toto).toBe(SCORING.toto.R16);
    expect(r.exact).toBe(SCORING.exact.R16);
  });

  it("regulation draw + WRONG penalty pick: zero toto, but exact bonus still applies", () => {
    const r = calculateKnockoutScore(
      "QF",
      { homeGoals: 0, awayGoals: 0, penaltyWinner: "JPN", team1: "BRA", team2: "JPN" },
      { score1: 0, score2: 0, winner: "BRA" }, // predicted BRA wins pens, but JPN actually did
    );
    expect(r.toto).toBe(0);
    expect(r.exact).toBe(SCORING.exact.QF);
  });

  it("null prediction → zero", () => {
    const r = calculateKnockoutScore(
      "FINAL",
      { homeGoals: 1, awayGoals: 0, penaltyWinner: null, team1: "BRA", team2: "JPN" },
      { score1: null, score2: null, winner: null },
    );
    expect(r.total).toBe(0);
  });

  it("Final stage uses Final-tier point values", () => {
    const r = calculateKnockoutScore(
      "FINAL",
      { homeGoals: 3, awayGoals: 2, penaltyWinner: null, team1: "BRA", team2: "ENG" },
      { score1: 3, score2: 2, winner: "BRA" },
    );
    expect(r.toto).toBe(SCORING.toto.FINAL);
    expect(r.exact).toBe(SCORING.exact.FINAL);
  });
});

describe("scoreSpecialBetsForUser — final outcome path", () => {
  const actuals: TournamentActuals = {
    ...noActuals,
    top_scorer_player: "Mbappé",
    top_assists_player: "Bellingham",
    best_attack_team: "BRA",
  };
  const stats: PlayerStat[] = [
    { name: "Mbappé", goals: 8, assists: 3 },
    { name: "Haaland", goals: 6, assists: 1 },
    { name: "Kane", goals: 3, assists: 1 },
    { name: "Pulisic", goals: 1, assists: 0 },
  ];

  it("exact top-scorer pick awards 9", () => {
    const r = scoreSpecialBetsForUser(baseBet({ topScorerPlayer: "Mbappé" }), actuals, stats);
    expect(r.total).toBe(SCORING.specials.top_scorer_exact);
    expect(r.hasInterim).toBe(false);
  });

  it("relative top-scorer pick (≥3 goals) awards 5", () => {
    const r = scoreSpecialBetsForUser(baseBet({ topScorerPlayer: "Haaland" }), actuals, stats);
    expect(r.total).toBe(SCORING.specials.top_scorer_relative);
  });

  it("under-threshold pick (1 goal) awards 0", () => {
    const r = scoreSpecialBetsForUser(baseBet({ topScorerPlayer: "Pulisic" }), actuals, stats);
    expect(r.total).toBe(0);
  });

  it("best-attack exact awards 6", () => {
    const r = scoreSpecialBetsForUser(baseBet({ bestAttackTeam: "BRA" }), actuals, stats);
    expect(r.total).toBe(SCORING.specials.best_attack);
  });
});

describe("scoreSpecialBetsForUser — live tentative path", () => {
  const stats: PlayerStat[] = [
    { name: "Mbappé", goals: 5, assists: 2, minutes: 270 },
    { name: "Vinícius Júnior", goals: 4, assists: 1, minutes: 250 },
    { name: "Haaland", goals: 3, assists: 0, minutes: 270 },
  ];

  it("when admin hasn't finalized: pick currently leading awards exact-tier with interim flag", () => {
    const r = scoreSpecialBetsForUser(baseBet({ topScorerPlayer: "Mbappé" }), null, stats);
    expect(r.total).toBe(SCORING.specials.top_scorer_exact);
    expect(r.hasInterim).toBe(true);
    expect(r.lines[0].liveLeader).toBe("Mbappé");
  });

  it("when not leading but ≥3 goals: relative tier with interim flag", () => {
    const r = scoreSpecialBetsForUser(baseBet({ topScorerPlayer: "Haaland" }), null, stats);
    expect(r.total).toBe(SCORING.specials.top_scorer_relative);
    expect(r.hasInterim).toBe(true);
  });

  it("when player not in stats yet: zero", () => {
    const r = scoreSpecialBetsForUser(baseBet({ topScorerPlayer: "Random Guy" }), null, stats);
    expect(r.total).toBe(0);
  });
});
