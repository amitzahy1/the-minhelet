import { describe, it, expect } from "vitest";
import {
  computePredictionLockRows,
  type LockSyncMatch,
} from "@/lib/scoring/compute-prediction-locks";

// ============================================================================
// These lock rows are the single source of truth for THREE things that must
// never disagree: the save RPCs' enforcement, and — since the leak fix — the
// /api/shared-bets DISPLAY reveal. A prediction is revealed to other bettors
// exactly when its `lock_at` instant passes (group: 30 min before the
// match-day's first kickoff; KO: 60 min before kickoff). These tests pin that
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
  it("locks the third-place play-off 60 min before its kickoff", () => {
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
    expect(tp?.lock_at).toBe("2026-07-18T18:00:00.000Z");
  });
});
