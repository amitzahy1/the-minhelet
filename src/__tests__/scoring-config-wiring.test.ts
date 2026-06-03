import { describe, it, expect } from "vitest";
import { SCORING } from "@/types";
import { scoringFromConfig } from "@/lib/scoring/config";
import { scoreAdvancementForUser } from "@/lib/scoring/advancement-scorer";
import { scoreSpecialBetsForUser, type TournamentActuals } from "@/lib/scoring/special-bets-scorer";
import { calculateKnockoutScore } from "@/lib/scoring/calculator";
import type { SlotState } from "@/lib/scoring/knockout-resolver";
import type { BettorAdvancement, BettorSpecialBets } from "@/lib/supabase/shared-data";

// These tests prove the admin-editable `scoring_config` row actually drives the
// scorers: a custom config resolved via scoringFromConfig changes the points,
// and omitting it falls back to the SCORING constant (existing behavior).

describe("scoringFromConfig", () => {
  it("returns the SCORING constant when given null/undefined", () => {
    expect(scoringFromConfig(null)).toEqual(SCORING);
    expect(scoringFromConfig(undefined)).toEqual(SCORING);
  });

  it("overrides supplied fields and falls back to the constant for the rest", () => {
    const s = scoringFromConfig({ advance_winner: 25, advance_r16: 4 });
    expect(s.advancement.winner).toBe(25);
    expect(s.advancement.r16).toBe(4);
    expect(s.advancement.qf).toBe(SCORING.advancement.qf); // not supplied
    expect(s.toto.GROUP).toBe(SCORING.toto.GROUP); // not supplied
  });

  it("maps the two added columns + the renamed minimums", () => {
    const s = scoringFromConfig({ group_advance_as_3rd: 7, top_scorer_min_goals: 9, top_assists_min: 8 });
    expect(s.advancement.group_as_3rd).toBe(7);
    expect(s.relative_minimums.top_scorer_goals).toBe(9);
    expect(s.relative_minimums.top_assists).toBe(8);
  });

  it("ignores non-finite DB values and uses the constant", () => {
    const s = scoringFromConfig({ advance_winner: NaN as unknown as number, advance_qf: null as unknown as number });
    expect(s.advancement.winner).toBe(SCORING.advancement.winner);
    expect(s.advancement.qf).toBe(SCORING.advancement.qf);
  });
});

const r16Slot = (key: string, t1: string, t2: string): SlotState => ({
  key: key as SlotState["key"],
  team1: t1, team2: t2, score1: null, score2: null, winner: null, stage: "R16", isThirdPlace: false,
});

const baseBet = (over: Partial<BettorSpecialBets>): BettorSpecialBets => ({
  userId: "u", displayName: "", topScorerTeam: null, topScorerPlayer: null,
  topAssistsTeam: null, topAssistsPlayer: null, bestAttackTeam: null,
  prolificGroup: null, driestGroup: null, dirtiestTeam: null, matchupPick: null,
  penaltiesOverUnder: null, ...over,
});

const noActuals: TournamentActuals = {
  top_scorer_player: null, top_assists_player: null, best_attack_team: null,
  most_prolific_group: null, driest_group: null, dirtiest_team: null,
  matchup_result_1: null, matchup_result_2: null, matchup_result_3: null,
  penalties_over_under: null,
};

describe("scorers honor a passed scoring config (admin edits flow through)", () => {
  it("advancement scorer uses the passed r16 value; default uses the constant", () => {
    const adv: BettorAdvancement = {
      userId: "u", displayName: "", groupQualifiers: {},
      advanceToR16: ["BRA"], advanceToQF: [], advanceToSF: [], advanceToFinal: [], winner: "",
    };
    const slots: Record<string, SlotState> = { a: r16Slot("r16l_0", "BRA", "GER") };

    const custom = scoringFromConfig({ advance_r16: 50 });
    expect(scoreAdvancementForUser(adv, {}, new Set(), slots, null, custom).r16Pts).toBe(50);
    // No config passed → constant default.
    expect(scoreAdvancementForUser(adv, {}, new Set(), slots, null).r16Pts).toBe(SCORING.advancement.r16);
  });

  it("special-bets scorer uses the passed top_scorer_exact value", () => {
    const bets = baseBet({ topScorerPlayer: "Mbappé" });
    const actuals: TournamentActuals = { ...noActuals, top_scorer_player: "Mbappé" };
    const custom = scoringFromConfig({ top_scorer_exact: 99 });
    expect(scoreSpecialBetsForUser(bets, actuals, [], custom).total).toBe(99);
    expect(scoreSpecialBetsForUser(bets, actuals, []).total).toBe(SCORING.specials.top_scorer_exact);
  });

  it("knockout calculator uses the passed toto/exact values", () => {
    const custom = scoringFromConfig({ toto_qf: 7, exact_qf: 5 });
    const r = calculateKnockoutScore(
      "QF",
      { homeGoals: 2, awayGoals: 1, penaltyWinner: null, team1: "BRA", team2: "GER" },
      { score1: 2, score2: 1, winner: "BRA" },
      custom,
    );
    expect(r.toto).toBe(7);
    expect(r.exact).toBe(5);
    expect(r.total).toBe(12);
  });
});
