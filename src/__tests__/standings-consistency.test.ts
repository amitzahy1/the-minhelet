import { describe, it, expect } from "vitest";
import { calculateStandings } from "@/lib/tournament/standings";
import { computeGroupOrders } from "@/lib/scoring/knockout-resolver";
import { GROUPS } from "@/lib/tournament/groups";
import type { GroupMatchPrediction } from "@/types";
import type { FinishedMatch } from "@/lib/results-hits";

// ============================================================================
// Canary: the user-facing predicted table (calculateStandings) and the knockout
// resolver (computeGroupOrders) must produce IDENTICAL 1st/2nd/3rd/4th for the
// same results. This guards against the H2H / FIFA-ranking tiebreaker divergence
// the audit found — if anyone re-introduces a separate sort, this fails.
// ============================================================================

// The 6-match within-group order (generateMatchups / GROUP_MATCH_PAIRS):
// [0,1],[2,3],[0,2],[3,1],[3,0],[1,2]
const PAIRS: [number, number][] = [[0, 1], [2, 3], [0, 2], [3, 1], [3, 0], [1, 2]];

/** Build both match shapes for group A from per-match [homeGoals, awayGoals]. */
function buildGroupA(scores: [number, number][]) {
  const codes = GROUPS.A.map((t) => t.code);
  const preds: GroupMatchPrediction[] = [];
  const finished: FinishedMatch[] = [];
  scores.forEach(([hg, ag], i) => {
    const [hi, ai] = PAIRS[i];
    preds.push({ match_id: i, home_team_code: codes[hi], away_team_code: codes[ai], home_goals: hg, away_goals: ag });
    finished.push({
      id: i, date: "2026-06-12T00:00:00Z", homeTla: codes[hi], awayTla: codes[ai],
      group: "A", stage: "GROUP", homeGoals: hg, awayGoals: ag, homePenalties: null, awayPenalties: null,
    });
  });
  return { codes, preds, finished };
}

function resolverOrderCodes(finished: FinishedMatch[]): string[] | null {
  const orders = computeGroupOrders(finished);
  if (!orders.A) return null;
  return orders.A.map((idx) => GROUPS.A[idx].code);
}

describe("standings consistency: predicted table === resolver bracket order", () => {
  it("agrees on a normal (no-tie) group", () => {
    const { preds, finished } = buildGroupA([[2, 0], [1, 0], [1, 1], [0, 2], [0, 1], [2, 0]]);
    const tableOrder = calculateStandings(GROUPS.A.map((t) => ({ id: t.id, code: t.code })), preds).map((r) => r.team_code);
    expect(resolverOrderCodes(finished)).toEqual(tableOrder);
  });

  it("agrees on an all-draw group (FIFA-ranking decides both)", () => {
    const { preds, finished } = buildGroupA([[0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]);
    const tableOrder = calculateStandings(GROUPS.A.map((t) => ({ id: t.id, code: t.code })), preds).map((r) => r.team_code);
    const resolverOrder = resolverOrderCodes(finished);
    expect(resolverOrder).toEqual(tableOrder);
    // Sanity: pure FIFA-ranking order for group A.
    expect(resolverOrder).toEqual(["MEX", "KOR", "CZE", "RSA"]);
  });

  it("agrees when head-to-head must break a pts/GD/GF tie", () => {
    // Engineer two teams level on pts/GD/GF; the one who won the H2H ranks higher
    // in BOTH implementations.
    const { preds, finished } = buildGroupA([[1, 0], [0, 0], [0, 1], [1, 0], [1, 0], [0, 1]]);
    const tableOrder = calculateStandings(GROUPS.A.map((t) => ({ id: t.id, code: t.code })), preds).map((r) => r.team_code);
    expect(resolverOrderCodes(finished)).toEqual(tableOrder);
  });
});
