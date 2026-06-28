import { describe, it, expect } from "vitest";
import { calculateKnockoutScore } from "@/lib/scoring/calculator";
import { scoreSpecialBetsForUser, computeSpecialBetsPool, type TournamentActuals, type PlayerStat } from "@/lib/scoring/special-bets-scorer";
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
  matchup_result_1: null,
  matchup_result_2: null,
  matchup_result_3: null,
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

  it("90' draw predicted as a draw → toto + exact (who advances on penalties is irrelevant)", () => {
    const r = calculateKnockoutScore(
      "R16",
      { homeGoals: 1, awayGoals: 1, penaltyWinner: "BRA", team1: "BRA", team2: "JPN" },
      { score1: 1, score2: 1, winner: "BRA" },
    );
    expect(r.toto).toBe(SCORING.toto.R16);
    expect(r.exact).toBe(SCORING.exact.R16);
  });

  it("90' draw predicted as a draw with NO winner pick → STILL toto (90' result only)", () => {
    const r = calculateKnockoutScore(
      "QF",
      { homeGoals: 0, awayGoals: 0, penaltyWinner: "JPN", team1: "BRA", team2: "JPN" },
      { score1: 0, score2: 0, winner: null }, // no who-advances pick — doesn't matter anymore
    );
    expect(r.toto).toBe(SCORING.toto.QF);
    expect(r.exact).toBe(SCORING.exact.QF);
  });

  it("predicted a decisive winner but the 90' result was a draw → no toto, no exact", () => {
    const r = calculateKnockoutScore(
      "QF",
      { homeGoals: 1, awayGoals: 1, penaltyWinner: "JPN", team1: "BRA", team2: "JPN" },
      { score1: 2, score2: 1, winner: "BRA" }, // predicted BRA 2-1, real 90' was 1-1
    );
    expect(r.toto).toBe(0);
    expect(r.exact).toBe(0);
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

describe("Penalty-shootout goals NEVER count toward player/team stats", () => {
  it("calculateKnockoutScore uses regulation goals for exact bonus, ignores penalty count", () => {
    // 1-1 after ET, won 5-4 on penalties — exact prediction of the regulation result still earns exact bonus.
    const r = calculateKnockoutScore(
      "FINAL",
      { homeGoals: 1, awayGoals: 1, penaltyWinner: "BRA", team1: "BRA", team2: "ARG" },
      { score1: 1, score2: 1, winner: "BRA" },
    );
    expect(r.exact).toBe(SCORING.exact.FINAL);
    // The 5 + 4 shootout kicks must NOT have inflated anyone's totals — the
    // calculator only takes regulation home/awayGoals, never penalty counts.
    // (We can't directly assert "shootout not counted" inside this fn because
    // shootout isn't an input; this test enforces the API contract instead.)
  });

  it("a 0-0 regulation result with shootout win awards exact (0-0) + toto when penalty pick matches", () => {
    const r = calculateKnockoutScore(
      "SF",
      { homeGoals: 0, awayGoals: 0, penaltyWinner: "ARG", team1: "ARG", team2: "NED" },
      { score1: 0, score2: 0, winner: "ARG" },
    );
    expect(r.exact).toBe(SCORING.exact.SF);
    expect(r.toto).toBe(SCORING.toto.SF);
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

  it("exact top-scorer pick awards top_scorer_exact (12)", () => {
    const r = scoreSpecialBetsForUser(baseBet({ topScorerPlayer: "Mbappé" }), actuals, stats);
    expect(r.total).toBe(SCORING.specials.top_scorer_exact);
    expect(r.hasInterim).toBe(false);
  });

  it("relative top-scorer pick wins when pool reports a relative value (closest among bettors)", () => {
    // Haaland has 6 goals; pool relative value = 6 → a Haaland pick wins relative.
    const r = scoreSpecialBetsForUser(baseBet({ topScorerPlayer: "Haaland" }), actuals, stats, SCORING, { topScorerGoals: 6, topAssistsCount: null });
    expect(r.total).toBe(SCORING.specials.top_scorer_relative);
  });

  it("no relative when pool reports none (someone got the exact)", () => {
    const r = scoreSpecialBetsForUser(baseBet({ topScorerPlayer: "Haaland" }), actuals, stats, SCORING, { topScorerGoals: null, topAssistsCount: null });
    expect(r.total).toBe(0);
  });

  it("relative pick whose count doesn't match the pool value awards 0", () => {
    // Pulisic has 1 goal — not the relative winner (6) → 0.
    const r = scoreSpecialBetsForUser(baseBet({ topScorerPlayer: "Pulisic" }), actuals, stats, SCORING, { topScorerGoals: 6, topAssistsCount: null });
    expect(r.total).toBe(0);
  });

  it("best-attack exact awards best_attack (8)", () => {
    const r = scoreSpecialBetsForUser(baseBet({ bestAttackTeam: "BRA" }), actuals, stats);
    expect(r.total).toBe(SCORING.specials.best_attack);
  });
});

describe("scoreSpecialBetsForUser — best-attack / dirtiest LIVE tentative path", () => {
  const REL = { topScorerGoals: null, topAssistsCount: null };

  it("best-attack: no final → current top-scoring team scores INTERIM", () => {
    const r = scoreSpecialBetsForUser(baseBet({ bestAttackTeam: "GER" }), noActuals, [], SCORING, REL, { GER: 10, FRA: 8, BRA: 7 });
    expect(r.total).toBe(SCORING.specials.best_attack);
    expect(r.hasInterim).toBe(true);
  });

  it("best-attack: a non-leading pick scores 0 while live", () => {
    const r = scoreSpecialBetsForUser(baseBet({ bestAttackTeam: "BRA" }), noActuals, [], SCORING, REL, { GER: 10, FRA: 8, BRA: 7 });
    expect(r.total).toBe(0);
  });

  it("best-attack: a TIE for most goals → every co-leader's pick catches it", () => {
    const ger = scoreSpecialBetsForUser(baseBet({ bestAttackTeam: "GER" }), noActuals, [], SCORING, REL, { GER: 10, FRA: 10, BRA: 7 });
    const fra = scoreSpecialBetsForUser(baseBet({ bestAttackTeam: "FRA" }), noActuals, [], SCORING, REL, { GER: 10, FRA: 10, BRA: 7 });
    expect(ger.total).toBe(SCORING.specials.best_attack);
    expect(fra.total).toBe(SCORING.specials.best_attack);
    expect(ger.lines[0].interim).toBe(true);
  });

  it("best-attack: an entered FINAL overrides the live leader (exact, not interim)", () => {
    const fin: TournamentActuals = { ...noActuals, best_attack_team: "BRA" };
    const hit = scoreSpecialBetsForUser(baseBet({ bestAttackTeam: "BRA" }), fin, [], SCORING, REL, { GER: 10 });
    expect(hit.total).toBe(SCORING.specials.best_attack);
    expect(hit.hasInterim).toBe(false);
    // the live leader (GER) no longer scores once the final is in
    const miss = scoreSpecialBetsForUser(baseBet({ bestAttackTeam: "GER" }), fin, [], SCORING, REL, { GER: 10 });
    expect(miss.total).toBe(0);
  });

  it("dirtiest: no final → current card-board leader scores INTERIM", () => {
    const withBoard: TournamentActuals = { ...noActuals, dirtiest_board: [{ team: "RSA", yellow: 5, red: 2 }, { team: "PAR", yellow: 7, red: 1 }] };
    const lead = scoreSpecialBetsForUser(baseBet({ dirtiestTeam: "RSA" }), withBoard, [], SCORING, REL);
    expect(lead.total).toBe(SCORING.specials.dirtiest_team);
    expect(lead.hasInterim).toBe(true);
    const other = scoreSpecialBetsForUser(baseBet({ dirtiestTeam: "PAR" }), withBoard, [], SCORING, REL);
    expect(other.total).toBe(0);
  });

  it("best-attack / dirtiest: no live data and no final → 0 (unchanged legacy behavior)", () => {
    const r = scoreSpecialBetsForUser(baseBet({ bestAttackTeam: "BRA", dirtiestTeam: "RSA" }), noActuals, []);
    expect(r.total).toBe(0);
  });
});

describe("scoreSpecialBetsForUser — matchups (3 duels, scored independently)", () => {
  // matchupPick is stored as a comma-joined "1,X,2" string (slot 0..2 = duel 1..3).
  it("all three duels correct → 3 × matchup points", () => {
    const r = scoreSpecialBetsForUser(
      baseBet({ matchupPick: "1,X,2" }),
      { ...noActuals, matchup_result_1: "1", matchup_result_2: "X", matchup_result_3: "2" },
    );
    expect(r.total).toBe(SCORING.specials.matchup * 3);
    expect(r.lines.filter((l) => l.reason === "MATCHUP")).toHaveLength(3);
  });

  it("only the matching duels score (partial credit)", () => {
    const r = scoreSpecialBetsForUser(
      baseBet({ matchupPick: "1,X,2" }),
      { ...noActuals, matchup_result_1: "1", matchup_result_2: "1", matchup_result_3: "1" },
    );
    expect(r.total).toBe(SCORING.specials.matchup); // only duel 1 matches
  });

  it("a single-duel pick does not bleed into other duels", () => {
    const r = scoreSpecialBetsForUser(
      baseBet({ matchupPick: "1" }), // only duel 1 picked
      { ...noActuals, matchup_result_1: "1", matchup_result_2: "1", matchup_result_3: "1" },
    );
    expect(r.total).toBe(SCORING.specials.matchup);
  });

  it("no actuals and no live stats → zero", () => {
    const r = scoreSpecialBetsForUser(baseBet({ matchupPick: "1,X,2" }), noActuals);
    expect(r.total).toBe(0);
  });

  it("live tentative: whoever leads the duel right now catches it (interim)", () => {
    // Duel 0 = Messi vs Ronaldo. Messi leads on goals+assists → result "1".
    const stats: PlayerStat[] = [
      { name: "Messi", goals: 3, assists: 2 },   // 5
      { name: "Ronaldo", goals: 1, assists: 0 }, // 1
    ];
    const win = scoreSpecialBetsForUser(baseBet({ matchupPick: "1" }), noActuals, stats);
    expect(win.total).toBe(SCORING.specials.matchup);
    expect(win.hasInterim).toBe(true);
    const lose = scoreSpecialBetsForUser(baseBet({ matchupPick: "2" }), noActuals, stats);
    expect(lose.total).toBe(0);
  });

  it("final result overrides the live duel state (no double-count)", () => {
    const stats: PlayerStat[] = [{ name: "Messi", goals: 5, assists: 1 }];
    const r = scoreSpecialBetsForUser(
      baseBet({ matchupPick: "1" }),
      { ...noActuals, matchup_result_1: "2" }, // admin says Ronaldo won duel 1
      stats,
    );
    expect(r.total).toBe(0); // pick "1" no longer matches the final "2"
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

  it("when not leading but matching the pool relative value: relative tier with interim flag", () => {
    // Haaland has 3 goals live; pool relative value = 3 → relative (interim).
    const r = scoreSpecialBetsForUser(baseBet({ topScorerPlayer: "Haaland" }), null, stats, SCORING, { topScorerGoals: 3, topAssistsCount: null });
    expect(r.total).toBe(SCORING.specials.top_scorer_relative);
    expect(r.hasInterim).toBe(true);
  });

  it("when player not in stats yet: zero", () => {
    const r = scoreSpecialBetsForUser(baseBet({ topScorerPlayer: "Random Guy" }), null, stats);
    expect(r.total).toBe(0);
  });
});

describe("computeSpecialBetsPool — closest-among-bettors relative + void status", () => {
  const stats: PlayerStat[] = [
    { name: "Mbappé", goals: 8, assists: 3 },
    { name: "Haaland", goals: 6, assists: 1 },
    { name: "Lautaro", goals: 6, assists: 0 },
    { name: "Kane", goals: 4, assists: 2 },
  ];

  it("nobody picked the exact winner → highest pick(s) get relative; ties share, lower gets 0", () => {
    const bets = [
      baseBet({ userId: "a", topScorerPlayer: "Haaland" }), // 6
      baseBet({ userId: "b", topScorerPlayer: "Lautaro" }), // 6 (tie)
      baseBet({ userId: "c", topScorerPlayer: "Kane" }),    // 4
    ];
    const actuals: TournamentActuals = { ...noActuals, top_scorer_player: "Mbappé" };
    const pool = computeSpecialBetsPool(bets, actuals, stats);
    expect(pool.relative.topScorerGoals).toBe(6);
    expect(pool.status.topScorer).toBe("won");
    expect(scoreSpecialBetsForUser(bets[0], actuals, stats, SCORING, pool.relative).total).toBe(SCORING.specials.top_scorer_relative);
    expect(scoreSpecialBetsForUser(bets[1], actuals, stats, SCORING, pool.relative).total).toBe(SCORING.specials.top_scorer_relative);
    expect(scoreSpecialBetsForUser(bets[2], actuals, stats, SCORING, pool.relative).total).toBe(0);
  });

  it("someone picked the exact winner → relative suppressed for everyone else", () => {
    const bets = [
      baseBet({ userId: "a", topScorerPlayer: "Mbappé" }),  // exact
      baseBet({ userId: "b", topScorerPlayer: "Haaland" }), // 6, would-be closest
    ];
    const actuals: TournamentActuals = { ...noActuals, top_scorer_player: "Mbappé" };
    const pool = computeSpecialBetsPool(bets, actuals, stats);
    expect(pool.relative.topScorerGoals).toBeNull();
    expect(scoreSpecialBetsForUser(bets[0], actuals, stats, SCORING, pool.relative).total).toBe(SCORING.specials.top_scorer_exact);
    expect(scoreSpecialBetsForUser(bets[1], actuals, stats, SCORING, pool.relative).total).toBe(0);
  });

  it("no pick clears the floor → no relative; top-scorer is never 'void' (pending, has a catcher in principle)", () => {
    const lowStats: PlayerStat[] = [{ name: "Mbappé", goals: 8, assists: 0 }, { name: "Sub", goals: 2, assists: 0 }];
    const bets = [baseBet({ userId: "a", topScorerPlayer: "Sub" })]; // 2 < floor 3
    const actuals: TournamentActuals = { ...noActuals, top_scorer_player: "Mbappé" };
    const pool = computeSpecialBetsPool(bets, actuals, lowStats);
    expect(pool.relative.topScorerGoals).toBeNull();
    expect(pool.status.topScorer).toBe("pending"); // relative categories never read "אף אחד לא תופס"
  });

  it("exact-only bet status: pending before result, void when resolved + nobody caught, won when caught", () => {
    const missBets = [baseBet({ userId: "a", bestAttackTeam: "ARG" })]; // nobody picked BRA
    expect(computeSpecialBetsPool(missBets, noActuals, stats).status.bestAttack).toBe("pending");
    expect(computeSpecialBetsPool(missBets, { ...noActuals, best_attack_team: "BRA" }, stats).status.bestAttack).toBe("void");
    const hitBets = [baseBet({ userId: "a", bestAttackTeam: "BRA" })];
    expect(computeSpecialBetsPool(hitBets, { ...noActuals, best_attack_team: "BRA" }, stats).status.bestAttack).toBe("won");
  });
});
