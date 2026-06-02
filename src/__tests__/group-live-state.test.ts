import { describe, it, expect } from "vitest";
import {
  computeMatchDays,
  dayLockAtForKickoff,
  groupMatchStatus,
  MATCHDAY_LOCK_BEFORE_MIN,
} from "@/lib/tournament/group-live-state";

// Representative WC2026-style schedule. In Israel time (UTC+3 in June) a "day of
// play" runs ~19:00 → ~early morning, crossing midnight. Times here are UTC:
//   16:00Z = 19:00 IL, 19:00Z = 22:00 IL, 22:00Z = 01:00 IL (next day),
//   01:00Z = 04:00 IL (next day).
const f = (date: string, group = "GROUP_A", status = "SCHEDULED", stage = "GROUP_STAGE") =>
  ({ date, group, stage, status });

describe("computeMatchDays", () => {
  it("clusters the evening→early-morning block (crossing midnight IL) into ONE match-day", () => {
    const fixtures = [
      f("2026-06-11T16:00:00Z"), // 19:00 IL Jun 11
      f("2026-06-11T19:00:00Z", "GROUP_B"), // 22:00 IL Jun 11
      f("2026-06-11T22:00:00Z", "GROUP_C"), // 01:00 IL Jun 12
      f("2026-06-12T01:00:00Z", "GROUP_D"), // 04:00 IL Jun 12
      // ~15h gap → next match-day
      f("2026-06-12T16:00:00Z", "GROUP_E"), // 19:00 IL Jun 12
      f("2026-06-12T19:00:00Z", "GROUP_F"), // 22:00 IL Jun 12
    ];
    const days = computeMatchDays(fixtures);

    expect(days).toHaveLength(2);
    // Day 1's late match (04:00 IL on Jun 12) belongs to Jun-11's match-day.
    expect(days[0].firstKickoffISO).toBe("2026-06-11T16:00:00.000Z");
    expect(days[0].lastKickoffISO).toBe("2026-06-12T01:00:00.000Z");
    expect(days[1].firstKickoffISO).toBe("2026-06-12T16:00:00.000Z");
    // Display key = Israel date of the first kickoff.
    expect(days[0].dayKey).toBe("2026-06-11");
    expect(days[1].dayKey).toBe("2026-06-12");
  });

  it("locks 30 minutes before the day's first kickoff", () => {
    const days = computeMatchDays([f("2026-06-11T16:00:00Z"), f("2026-06-11T19:00:00Z")]);
    expect(MATCHDAY_LOCK_BEFORE_MIN).toBe(30);
    expect(days[0].lockAtISO).toBe("2026-06-11T15:30:00.000Z");
  });

  it("maps a midnight-crossing kickoff to its day's lock time", () => {
    const fixtures = [
      f("2026-06-11T16:00:00Z"),
      f("2026-06-12T01:00:00Z", "GROUP_D"), // 04:00 IL — still Jun-11's match-day
      f("2026-06-12T16:00:00Z", "GROUP_E"),
    ];
    const days = computeMatchDays(fixtures);
    // The 04:00 IL match locks at Jun-11's first-kickoff − 30m, NOT its own day.
    expect(dayLockAtForKickoff("2026-06-12T01:00:00Z", days)).toBe("2026-06-11T15:30:00.000Z");
    expect(dayLockAtForKickoff("2026-06-12T16:00:00Z", days)).toBe("2026-06-12T15:30:00.000Z");
  });

  it("ignores knockout fixtures", () => {
    const fixtures = [
      f("2026-06-11T16:00:00Z"),
      { date: "2026-07-04T19:00:00Z", group: undefined, stage: "ROUND_OF_32", status: "SCHEDULED" },
    ];
    const days = computeMatchDays(fixtures);
    expect(days).toHaveLength(1);
  });
});

describe("groupMatchStatus", () => {
  const lockAt = "2026-06-11T15:30:00.000Z";
  const before = new Date("2026-06-11T12:00:00Z").getTime();
  const after = new Date("2026-06-11T16:00:00Z").getTime();

  it("is open before the match-day lock", () => {
    expect(groupMatchStatus("SCHEDULED", lockAt, before)).toBe("open");
  });
  it("is locked once the match-day lock passes", () => {
    expect(groupMatchStatus("SCHEDULED", lockAt, after)).toBe("locked");
  });
  it("is locked while the match is live, regardless of the day lock", () => {
    expect(groupMatchStatus("IN_PLAY", lockAt, before)).toBe("locked");
  });
  it("is finished when the match is over", () => {
    expect(groupMatchStatus("FINISHED", lockAt, after)).toBe("finished");
  });
  it("fails closed (locked) when the lock instant is unknown", () => {
    expect(groupMatchStatus("SCHEDULED", null, after)).toBe("locked");
    expect(groupMatchStatus("SCHEDULED", null, before)).toBe("locked");
  });
});
