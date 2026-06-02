import { describe, it, expect } from "vitest";
import { scoreAdvancementForUser } from "@/lib/scoring/advancement-scorer";
import { SCORING } from "@/types";
import type { SlotState } from "@/lib/scoring/knockout-resolver";
import type { BettorAdvancement } from "@/lib/supabase/shared-data";

function r16Slot(key: string, t1: string, t2: string): SlotState {
  return { key: key as SlotState["key"], team1: t1, team2: t2, score1: null, score2: null, winner: null, stage: "R16", isThirdPlace: false };
}

const baseAdv: BettorAdvancement = {
  userId: "u", displayName: "", groupQualifiers: {},
  advanceToR16: [], advanceToQF: [], advanceToSF: [], advanceToFinal: [], winner: "",
};
const advWithR16 = (r16: string[]): BettorAdvancement => ({ ...baseAdv, advanceToR16: r16 });

// A real bracket where BRA, GER, ESP, FRA reached the last 16.
const slots: Record<string, SlotState> = {
  r16l_0: r16Slot("r16l_0", "BRA", "GER"),
  r16l_1: r16Slot("r16l_1", "ESP", "FRA"),
};

describe("R16 advancement scoring (SCORING.advancement.r16 pts per correctly-predicted last-16 team)", () => {
  it("awards r16 pts per predicted team that actually reached R16, 0 for the rest", () => {
    // Predicted BRA, ESP (reached) + ARG (did not).
    const b = scoreAdvancementForUser(advWithR16(["BRA", "ESP", "ARG"]), {}, new Set(), slots, null);
    expect(b.r16Pts).toBe(2 * SCORING.advancement.r16); // BRA + ESP
    expect(b.total).toBe(2 * SCORING.advancement.r16);
    expect(b.lines.filter((l) => l.reason === "ADVANCE_R16")).toHaveLength(2);
  });

  it("is 0 when no predicted team reached R16", () => {
    const b = scoreAdvancementForUser(advWithR16(["ARG", "ENG"]), {}, new Set(), slots, null);
    expect(b.r16Pts).toBe(0);
  });

  it("is 0 R16 points when no R16 picks are stored", () => {
    const b = scoreAdvancementForUser(baseAdv, {}, new Set(), slots, null);
    expect(b.r16Pts).toBe(0);
  });
});
