import { describe, it, expect } from "vitest";
import { computePlayerHistories, computeKnockoutCeiling, computeRankHistories } from "@/lib/scoring/live-scorer";
import type { BettorBracket } from "@/lib/supabase/shared-data";
import type { FinishedMatch } from "@/lib/results-hits";
import type { SlotState } from "@/lib/scoring/knockout-resolver";
import { SCORING } from "@/types";

// Groups A + B fully played (clean home-wins-1-0 ladder) so r32l_0 = A2 v B2
// (KOR v CAN) resolves, plus the real R32 match KOR 2-1 CAN.
let mid = 1;
const gm = (h: string, a: string, hg: number, ag: number, group: string, stage = "GROUP_STAGE"): FinishedMatch => ({
  id: mid++, date: "2026-06-15T16:00:00Z", homeTla: h, awayTla: a, group, stage, homeGoals: hg, awayGoals: ag,
});
const groupMatches = (letter: string, order: [string, string, string, string]): FinishedMatch[] => {
  const [a, b, c, d] = order;
  const g = `GROUP_${letter}`;
  return [gm(a, b, 1, 0, g), gm(a, c, 1, 0, g), gm(a, d, 1, 0, g), gm(b, c, 1, 0, g), gm(b, d, 1, 0, g), gm(c, d, 1, 0, g)];
};
const MATCHES: FinishedMatch[] = [
  ...groupMatches("A", ["MEX", "KOR", "CZE", "RSA"]),
  ...groupMatches("B", ["SUI", "CAN", "QAT", "BIH"]),
  { id: 999, date: "2026-06-29T20:00:00Z", homeTla: "KOR", awayTla: "CAN", group: "", stage: "LAST_32", homeGoals: 2, awayGoals: 1 },
];

const bracket = (over: Partial<BettorBracket> = {}): BettorBracket => ({
  userId: "u", displayName: "U", groupPredictions: {}, knockoutTree: {}, knockoutTreeLive: {},
  champion: null, lockedAt: null, ...over,
});

describe("computePlayerHistories — knockout matches now move the trend", () => {
  it("adds KO toto+exact at the KO match (no longer frozen at the group stage)", () => {
    const nailed = bracket({ userId: "a", knockoutTreeLive: { r32l_0: { score1: 2, score2: 1, winner: "KOR" } } });
    const blank = bracket({ userId: "b" });
    const hist = computePlayerHistories([nailed, blank], MATCHES, SCORING);

    // One point per match plus the leading zero.
    expect(hist["a"]).toHaveLength(MATCHES.length + 1);
    // The KO match (last step) lifts the nailer by exactly R32 toto+exact...
    const a = hist["a"];
    expect(a[a.length - 1] - a[a.length - 2]).toBe(SCORING.toto.R32 + SCORING.exact.R32);
    // ...while the blank bracket flatlines across the KO match.
    const b = hist["b"];
    expect(b[b.length - 1]).toBe(b[b.length - 2]);
  });
});

describe("computeKnockoutCeiling — caught on played + open on unplayed", () => {
  const slot = (over: Partial<SlotState>): SlotState => ({
    key: "r32l_0", team1: null, team2: null, score1: null, score2: null, winner: null, stage: "R32", isThirdPlace: false, ...over,
  });
  const tree = {
    r32l_0: slot({ key: "r32l_0", team1: "KOR", team2: "CAN", score1: 2, score2: 1, winner: "KOR" }), // played
    r32l_1: slot({ key: "r32l_1", team1: "GER", team2: "PAR" }), // set matchup, not played
    r16l_0: slot({ key: "r16l_0", stage: "R16" }), // future round — teams not drawn yet
  } as Record<string, SlotState>;
  const KO_R32 = SCORING.toto.R32 + SCORING.exact.R32;

  it("caught counts only the bettor's prediction on a played match; pot = caughtMax + open", () => {
    const b = bracket({ knockoutTreeLive: { r32l_0: { score1: 2, score2: 1, winner: "KOR" } } }); // exact hit
    const c = computeKnockoutCeiling(b, tree, SCORING);
    expect(c.caught).toBe(KO_R32); // nailed the played match
    expect(c.pot).toBe(KO_R32 + KO_R32); // caughtMax (r32l_0) + open (r32l_1)
  });

  it("missing a played match you bet keeps pot above alive", () => {
    const b = bracket({ knockoutTreeLive: { r32l_0: { score1: 0, score2: 3, winner: "CAN" } } }); // wrong
    const c = computeKnockoutCeiling(b, tree, SCORING);
    expect(c.caught).toBe(0); // missed it
    expect(c.total).toBe(KO_R32); // alive = open only
    expect(c.pot).toBe(KO_R32 + KO_R32); // pot still counts the max he could have had
  });

  it("open is EQUAL regardless of whether the bettor pre-filled it (equal opportunity)", () => {
    const filled = bracket({ knockoutTreeLive: { r32l_1: { score1: 1, score2: 0, winner: "GER" } } });
    const blank = bracket();
    // Only r32l_1 is a set-but-unplayed matchup; r16l_0 (no teams) isn't bettable yet.
    expect(computeKnockoutCeiling(filled, tree, SCORING).open).toBe(KO_R32);
    expect(computeKnockoutCeiling(blank, tree, SCORING).open).toBe(KO_R32);
  });

  it("a bettor who predicted nothing still has the open opportunity, just no caught", () => {
    const c = computeKnockoutCeiling(bracket(), tree, SCORING);
    expect(c.caught).toBe(0);
    expect(c.open).toBe(KO_R32);
    expect(c.total).toBe(KO_R32);
  });
});

describe("computeRankHistories — rank moves up/down (not a flat ramp)", () => {
  it("a bettor who scores at the KO climbs above a blank one by the end", () => {
    const a = bracket({ userId: "a", knockoutTreeLive: { r32l_0: { score1: 2, score2: 1, winner: "KOR" } } });
    const z = bracket({ userId: "z" });
    const rh = computeRankHistories([a, z], MATCHES, { scoring: SCORING }, 10);

    // Equal-length comparable series.
    expect(rh["a"].length).toBe(rh["z"].length);
    expect(rh["a"].length).toBeGreaterThanOrEqual(2);
    // Tied at 0 through the group prefixes → both rank 1.
    expect(rh["a"][0]).toBe(1);
    expect(rh["z"][0]).toBe(1);
    // After the KO, "a" stays #1 and "z" drops to #2 (a distinct trajectory).
    expect(rh["a"][rh["a"].length - 1]).toBe(1);
    expect(rh["z"][rh["z"].length - 1]).toBe(2);
  });
});
