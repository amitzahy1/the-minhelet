import { describe, it, expect } from "vitest";
import {
  computePredictionLockRows,
  type LockSyncMatch,
} from "@/lib/scoring/compute-prediction-locks";
import { GROUPS, GROUP_LETTERS } from "@/lib/tournament/groups";

// ============================================================================
// These lock rows are the single source of truth for THREE things that must
// never disagree: the save RPCs' enforcement, and — since the leak fix — the
// /api/shared-bets DISPLAY reveal. A prediction is revealed to other bettors
// exactly when its `lock_at` instant passes (group: 30 min before the
// match-day's first kickoff; KO: 30 min before kickoff). These tests pin that
// contract so the "a score is shown only once that match's bet is locked" rule
// can't silently regress.
// ============================================================================

const g = (
  id: number,
  date: string,
  homeTla: string,
  awayTla: string,
  group = "GROUP_A",
): LockSyncMatch => ({ id, date, homeTla, awayTla, group, stage: "GROUP_STAGE", status: "SCHEDULED" });

describe("computePredictionLockRows — group reveal", () => {
  // Group A draw order: MEX(0), KOR(1), CZE(2), RSA(3).
  // GROUP_MATCH_PAIRS = [[0,1],[2,3],[0,2],[1,3],[0,3],[1,2]] → MEX/KOR = pair 0.
  it("locks every score in a match-day 30 min before the day's FIRST kickoff", () => {
    const rows = computePredictionLockRows([
      g(1, "2026-06-11T16:00:00Z", "MEX", "KOR"), // pair 0, 19:00 IL — first of day
      g(2, "2026-06-11T19:00:00Z", "CZE", "RSA"), // pair 1, 22:00 IL — later same day
    ]);

    const first = rows.find((r) => r.lock_key === "A:0");
    const later = rows.find((r) => r.lock_key === "A:1");

    expect(first?.lock_at).toBe("2026-06-11T15:30:00.000Z");
    // The KEY fairness property: the later match reveals at the DAY's lock, not
    // at its own (later) kickoff — the whole day freezes together, so showing
    // its score from that instant can't help anyone (nobody can still edit).
    expect(later?.lock_at).toBe("2026-06-11T15:30:00.000Z");
  });

  it("maps each group match to its canonical pair index", () => {
    const rows = computePredictionLockRows([
      g(1, "2026-06-11T16:00:00Z", "MEX", "KOR"),
      g(2, "2026-06-11T16:00:00Z", "CZE", "RSA"),
    ]);
    expect(rows.map((r) => r.lock_key).sort()).toEqual(["A:0", "A:1"]);
    expect(rows.every((r) => r.scope === "group")).toBe(true);
  });

  it("is orientation-independent (home/away swapped → same pair, same lock)", () => {
    const rows = computePredictionLockRows([g(1, "2026-06-11T16:00:00Z", "KOR", "MEX")]);
    expect(rows[0].lock_key).toBe("A:0");
    expect(rows[0].lock_at).toBe("2026-06-11T15:30:00.000Z");
  });
});

describe("computePredictionLockRows — knockout reveal", () => {
  it("locks the third-place play-off 30 min before its kickoff", () => {
    const rows = computePredictionLockRows([
      {
        id: 99,
        date: "2026-07-18T19:00:00Z",
        homeTla: "TBD",
        awayTla: "TBD",
        group: null,
        stage: "THIRD_PLACE",
        status: "SCHEDULED",
      },
    ]);
    const tp = rows.find((r) => r.lock_key === "third_place");
    expect(tp?.scope).toBe("ko");
    expect(tp?.lock_at).toBe("2026-07-18T18:30:00.000Z");
  });

  // Regression (2026-07-02): an R32 won in EXTRA TIME with NO shootout has a 90'
  // DRAW and null penalties — the qualifier is knowable ONLY from the feed
  // `winner`. If the lock DTO drops `winner`, the next round's slot never
  // resolves, gets no lock row, and every pick on that match is silently
  // UNSAVEABLE (save RPC fails closed → "המשחק ננעל"). Live case: BEL beat SEN
  // in ET, so the USA–BEL R16 slot lost its lock row the moment the 90' score
  // was corrected to 2–2. Pin that `winner` is threaded end-to-end.
  describe("ET-win-no-shootout feeder resolves the next slot's lock", () => {
    let mid = 1;
    const gm = (h: string, a: string, hg: number, ag: number, g: string): LockSyncMatch =>
      ({ id: mid++, date: "2026-06-15T16:00:00Z", homeTla: h, awayTla: a, group: g, stage: "GROUP_STAGE", status: "FINISHED", homeGoals: hg, awayGoals: ag });
    // All 12 groups played deterministically (t0 wins all, t1 > t2,t3, t2 > t3)
    // so every group order is [0,1,2,3] and the whole R32 resolves.
    const allGroups: LockSyncMatch[] = [];
    for (const L of GROUP_LETTERS) {
      const t = GROUPS[L].map((x) => x.code);
      allGroups.push(
        gm(t[0], t[1], 1, 0, L), gm(t[0], t[2], 1, 0, L), gm(t[0], t[3], 1, 0, L),
        gm(t[1], t[2], 1, 0, L), gm(t[1], t[3], 1, 0, L), gm(t[2], t[3], 1, 0, L),
      );
    }
    // With this ordering r16l_0 = W(r32l_1: GER-TUR) vs W(r32r_0: FRA-SWE).
    const ko = (
      h: string, a: string, hg: number, ag: number,
      extra: Partial<LockSyncMatch> = {},
    ): LockSyncMatch =>
      ({ id: mid++, date: "2026-06-30T18:00:00Z", homeTla: h, awayTla: a, group: null, stage: "LAST_32", status: "FINISHED", homeGoals: hg, awayGoals: ag, ...extra });

    // GER win in ET (2–2, no shootout) → winner ONLY from the feed field.
    const gerEt = (withWinner: boolean) =>
      ko("GER", "TUR", 2, 2, withWinner ? { winner: "HOME_TEAM" } : {});
    const fraWin = ko("FRA", "SWE", 1, 0, { winner: "HOME_TEAM" });
    // The resolved R16 fixture (GER vs FRA), still to be played.
    const r16Fixture: LockSyncMatch = {
      id: 900, date: "2026-07-07T00:00:00Z", homeTla: "GER", awayTla: "FRA",
      group: null, stage: "LAST_16", status: "TIMED",
    };

    it("writes the R16 lock row when winner IS threaded", () => {
      const rows = computePredictionLockRows([...allGroups, gerEt(true), fraWin, r16Fixture]);
      const r16 = rows.find((r) => r.lock_key === "r16l_0");
      expect(r16?.lock_at).toBe("2026-07-06T23:30:00.000Z"); // kickoff − 30 min
    });

    it("(the bug) drops the R16 lock row when winner is missing on the ET match", () => {
      const rows = computePredictionLockRows([...allGroups, gerEt(false), fraWin, r16Fixture]);
      expect(rows.find((r) => r.lock_key === "r16l_0")).toBeUndefined();
    });
  });
});
