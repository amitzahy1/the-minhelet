import { describe, it, expect } from "vitest";
import { scoreAdvancementForUser } from "@/lib/scoring/advancement-scorer";
import type { SlotState } from "@/lib/scoring/knockout-resolver";
import type { BettorAdvancement } from "@/lib/supabase/shared-data";

function r16Slot(key: string, t1: string, t2: string): SlotState {
  return { key: key as SlotState["key"], team1: t1, team2: t2, score1: null, score2: null, winner: null, stage: "R16", isThirdPlace: false };
}

const emptyAdv: BettorAdvancement = {
  userId: "u", displayName: "", groupQualifiers: {},
  advanceToQF: [], advanceToSF: [], advanceToFinal: [], winner: "",
};

// A real bracket where BRA, GER, ESP, FRA reached the last 16.
const slots: Record<string, SlotState> = {
  r16l_0: r16Slot("r16l_0", "BRA", "GER"),
  r16l_1: r16Slot("r16l_1", "ESP", "FRA"),
};

describe("R16 advancement scoring (2 pts per correctly-predicted last-16 team)", () => {
  it("awards 2 per predicted team that actually reached R16, 0 for the rest", () => {
    // Predicted BRA, ESP (reached) + ARG (did not).
    const b = scoreAdvancementForUser(emptyAdv, {}, new Set(), slots, null, ["BRA", "ESP", "ARG"]);
    expect(b.r16Pts).toBe(4); // BRA + ESP
    expect(b.total).toBe(4);
    expect(b.lines.filter((l) => l.reason === "ADVANCE_R16")).toHaveLength(2);
  });

  it("does not double-count a duplicated prediction", () => {
    const b = scoreAdvancementForUser(emptyAdv, {}, new Set(), slots, null, ["GER", "GER"]);
    expect(b.r16Pts).toBe(2); // GER once
  });

  it("is 0 when no predicted team reached R16", () => {
    const b = scoreAdvancementForUser(emptyAdv, {}, new Set(), slots, null, ["ARG", "ENG"]);
    expect(b.r16Pts).toBe(0);
  });

  it("defaults to 0 R16 points when no predictedR16 is passed (back-compat)", () => {
    const b = scoreAdvancementForUser(emptyAdv, {}, new Set(), slots, null);
    expect(b.r16Pts).toBe(0);
  });
});
