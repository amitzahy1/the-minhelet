import { describe, it, expect } from "vitest";
import { slotStatus, LOCK_BEFORE_MIN } from "@/lib/tournament/ko-live-state";
import type { SlotState, KoSlotKey, ScheduleMatch } from "@/lib/scoring/knockout-resolver";

// Minimal single-slot tree + schedule so we exercise slotStatus in isolation.
// findKickoffForSlot only reads tree[slotKey].team1/team2 and matches them
// against the schedule by team pair, so one populated slot is enough.
const KEY = "r32l_0" as KoSlotKey;

function slot(over: Partial<SlotState> = {}): Record<KoSlotKey, SlotState> {
  return {
    [KEY]: {
      key: KEY,
      team1: "GER",
      team2: "PAR",
      score1: null,
      score2: null,
      winner: null,
      stage: "R32",
      isThirdPlace: false,
      ...over,
    },
  } as Record<KoSlotKey, SlotState>;
}

const sched = (status: string | null, date = "2026-06-29T20:30:00Z"): ScheduleMatch[] => [
  { homeTla: "GER", awayTla: "PAR", date, status },
];

const NOW = Date.parse("2026-06-30T06:00:00Z"); // well after the GER-PAR kickoff

describe("slotStatus", () => {
  it("FINISHED 90'-draw with NO resolved winner yet → finished (not locked)", () => {
    // The opening-incident window: a knockout tie flips to FINISHED at 90'
    // BEFORE the free FD tier publishes the shootout winner/penalties, so
    // slot.winner is still null. Must NOT linger as the banner's "next match".
    expect(slotStatus(KEY, slot({ score1: 1, score2: 1 }), sched("FINISHED"), NOW)).toBe("finished");
  });

  it("FINISHED with a resolved winner → finished", () => {
    expect(slotStatus(KEY, slot({ score1: 1, score2: 1, winner: "PAR" }), sched("FINISHED"), NOW)).toBe("finished");
  });

  it("a winner is finished even if the schedule status lags", () => {
    expect(slotStatus(KEY, slot({ score1: 2, score2: 0, winner: "GER" }), sched("IN_PLAY"), NOW)).toBe("finished");
  });

  it("IN_PLAY (still being played) stays locked — keeps it as the next match", () => {
    expect(slotStatus(KEY, slot(), sched("IN_PLAY"), NOW)).toBe("locked");
  });

  it("within the lock window before kickoff → locked", () => {
    const ko = "2026-06-30T06:20:00Z"; // 20 min after NOW, inside the 30' window
    expect(slotStatus(KEY, slot(), sched("TIMED", ko), NOW)).toBe("locked");
  });

  it("well before kickoff → open (editable)", () => {
    const ko = "2026-06-30T18:00:00Z"; // 12h out
    expect(slotStatus(KEY, slot(), sched("TIMED", ko), NOW)).toBe("open");
  });

  it("teams not yet resolved → waiting", () => {
    expect(slotStatus(KEY, slot({ team1: null, team2: null }), sched("TIMED"), NOW)).toBe("waiting");
    expect(LOCK_BEFORE_MIN).toBe(30);
  });
});
