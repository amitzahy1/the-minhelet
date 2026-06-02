import { describe, it, expect } from "vitest";
import {
  syncAdvancementPicks,
  clearTeamFromSpecialBets,
  type AdvancementBets,
  type KoMatch,
} from "@/lib/tournament/bracket-cascade";

// Regression: a user who saved bets BEFORE the roundOf16 (and originally the
// semifinalists/quarterfinalists) arrays existed rehydrates with those fields
// === undefined. syncAdvancementPicks runs on EVERY setKnockoutMatch and used to
// call `sb.roundOf16.map(...)` directly → threw inside the immer producer →
// the winner change was rolled back (tree "wouldn't change") while the toast
// (scheduled before the throw) still fired. The same undefined also crashed the
// special-bets page (`sameSet(sb.roundOf16, ...)` → undefined.filter). The
// engine must tolerate a malformed/partial bets object without throwing.

const FULL_TREE: Record<string, KoMatch> = {};
// Fill all 16 R32 winners + 8 R16 + 4 QF + 2 SF + final so sync has data.
const w = (code: string): KoMatch => ({ score1: null, score2: null, winner: code });
["r32l_0","r32l_1","r32l_2","r32l_3","r32l_4","r32l_5","r32l_6","r32l_7",
 "r32r_0","r32r_1","r32r_2","r32r_3","r32r_4","r32r_5","r32r_6","r32r_7"].forEach((k, i) => { FULL_TREE[k] = w(`T${i}`); });
["r16l_0","r16l_1","r16l_2","r16l_3","r16r_0","r16r_1","r16r_2","r16r_3"].forEach((k, i) => { FULL_TREE[k] = w(`Q${i}`); });
["qfl_0","qfl_1","qfr_0","qfr_1"].forEach((k, i) => { FULL_TREE[k] = w(`S${i}`); });
FULL_TREE.sfl_0 = w("FIN1"); FULL_TREE.sfr_0 = w("FIN2"); FULL_TREE.final = w("CHAMP");

describe("stale-state resilience (bracket-cascade engine)", () => {
  it("syncAdvancementPicks does NOT throw when advancement arrays are undefined", () => {
    // Simulate pre-roundOf16 persisted shape: arrays missing entirely.
    const sb = { winner: "", finalist1: "", finalist2: "" } as unknown as AdvancementBets;
    expect(() => syncAdvancementPicks(FULL_TREE, sb)).not.toThrow();
    // It backfills canonical-length arrays from the tree winners.
    expect(sb.roundOf16).toHaveLength(16);
    expect(sb.quarterfinalists).toHaveLength(8);
    expect(sb.semifinalists).toHaveLength(4);
    expect(sb.roundOf16[0]).toBe("T0");
    expect(sb.quarterfinalists[0]).toBe("Q0");
    expect(sb.semifinalists[0]).toBe("S0");
    expect(sb.finalist1).toBe("FIN1");
    expect(sb.finalist2).toBe("FIN2");
    expect(sb.winner).toBe("CHAMP");
  });

  it("clearTeamFromSpecialBets does NOT throw when arrays are undefined", () => {
    const sb = { winner: "", finalist1: "", finalist2: "" } as unknown as AdvancementBets;
    // r32 stage touches roundOf16 (idx<=0) + qf + sf — all undefined here.
    expect(() => clearTeamFromSpecialBets(sb, "T0", "r32")).not.toThrow();
  });

  it("syncAdvancementPicks preserves a manual entry only where the tree is empty", () => {
    const sb: AdvancementBets = {
      winner: "", finalist1: "", finalist2: "",
      semifinalists: ["", "", "", ""],
      quarterfinalists: ["", "", "", "", "", "", "", ""],
      roundOf16: ["MANUAL", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    };
    const treeNoFirstR32 = { ...FULL_TREE, r32l_0: w("") };
    syncAdvancementPicks(treeNoFirstR32, sb);
    // Tree slot 0 empty → keep the manual pick; the rest come from the tree.
    expect(sb.roundOf16[0]).toBe("MANUAL");
    expect(sb.roundOf16[1]).toBe("T1");
  });
});
