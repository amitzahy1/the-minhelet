// ============================================================================
// Group-stage "live mode" per-match-day state machine.
//
// After the June-10 global lock, group-stage MATCH SCORES stay editable during
// the tournament (the frozen qualification table / advancement bets do NOT —
// see groups/page.tsx live mode). Editing locks PER MATCH-DAY: when a day's
// FIRST match is 30 minutes away, every match of that day locks together.
//
// A "match day" is NOT a calendar date. WC2026 group matches run ~19:00→~07:00
// Israel time, so a single day of play crosses midnight. We bucket each match
// by a day boundary fixed at NOON Israel time — which sits squarely in the
// daily "dead zone" (no group match kicks off ~07:00–19:00 Israel), so the
// evening→early-morning block always lands in ONE bucket. This is gap-
// independent (robust to sparse days, unlike gap-clustering) and DST-safe
// (the whole tournament is within Israel's UTC+3 summer offset). Lock math is
// timezone-agnostic (compares UTC instants); only DISPLAY localises further.
// ============================================================================

import { toIsraelDateKey } from "@/lib/timezone";
import { normalizeGroupLetter } from "@/lib/results-hits";

/** Editing locks this many minutes before the match-day's first kickoff. */
export const MATCHDAY_LOCK_BEFORE_MIN = 30;

// Day boundary at 12:00 Israel time. Shifting a kickoff back by 12h and taking
// its Israel date puts every match with Israel-time ≥ noon on its own date and
// every after-midnight match (< noon) on the previous day-of-play — exactly the
// evening→morning grouping we want. The boundary never bisects a match because
// nothing kicks off ~07:00–19:00 Israel.
const MATCHDAY_BOUNDARY_SHIFT_MS = 12 * 60 * 60 * 1000;

/** The match-day bucket key (Israel date of the day-of-play) for a kickoff. */
function matchDayKeyOf(kickoffMs: number): string {
  return toIsraelDateKey(new Date(kickoffMs - MATCHDAY_BOUNDARY_SHIFT_MS).toISOString());
}

const LIVE_OR_DONE = new Set(["IN_PLAY", "PAUSED", "LIVE", "FINISHED"]);

export type GroupMatchStatus = "open" | "locked" | "finished";

interface FixtureLike {
  date: string;
  group?: string | null;
  stage?: string | null;
  status?: string | null;
}

export interface MatchDay {
  /** Day-of-play bucket key — Israel YYYY-MM-DD of the evening the day starts. */
  dayKey: string;
  firstKickoffISO: string;
  lastKickoffISO: string;
  /** Instant the whole day locks: firstKickoff − MATCHDAY_LOCK_BEFORE_MIN. */
  lockAtISO: string;
}

function isGroupStage(f: FixtureLike): boolean {
  if (f.stage && /GROUP/i.test(f.stage)) return true;
  return !!normalizeGroupLetter(f.group);
}

/**
 * Bucket all GROUP-STAGE fixtures into match-days (by the noon-Israel boundary)
 * and derive each day's lock instant (first kickoff − 30 min). Knockout
 * fixtures are ignored. Returns days ordered chronologically.
 */
export function computeMatchDays(fixtures: FixtureLike[]): MatchDay[] {
  const buckets = new Map<string, number[]>();
  for (const f of fixtures) {
    if (!isGroupStage(f)) continue;
    const t = new Date(f.date).getTime();
    if (!Number.isFinite(t)) continue;
    const key = matchDayKeyOf(t);
    let arr = buckets.get(key);
    if (!arr) { arr = []; buckets.set(key, arr); }
    arr.push(t);
  }

  const days: MatchDay[] = [];
  for (const [dayKey, times] of buckets) {
    times.sort((a, b) => a - b);
    const first = times[0];
    const last = times[times.length - 1];
    days.push({
      dayKey,
      firstKickoffISO: new Date(first).toISOString(),
      lastKickoffISO: new Date(last).toISOString(),
      lockAtISO: new Date(first - MATCHDAY_LOCK_BEFORE_MIN * 60_000).toISOString(),
    });
  }
  days.sort((a, b) => a.firstKickoffISO.localeCompare(b.firstKickoffISO));
  return days;
}

/** The lock instant (ISO) for the match-day a given kickoff belongs to, or null. */
export function dayLockAtForKickoff(
  kickoffISO: string | null | undefined,
  days: MatchDay[],
): string | null {
  if (!kickoffISO) return null;
  const t = new Date(kickoffISO).getTime();
  if (!Number.isFinite(t)) return null;
  const key = matchDayKeyOf(t);
  return days.find((d) => d.dayKey === key)?.lockAtISO ?? null;
}

/**
 * Editing status for one group match:
 *   finished — the real match is over (show result + the user's pick).
 *   locked   — the match is live, its match-day reached the lock instant, OR the
 *              lock instant is UNKNOWN (fail closed — never assume "open" when we
 *              can't prove the window is open).
 *   open     — still editable.
 *
 * NOTE: this is the DISPLAY gate only. The authoritative enforcement is the
 * server RPC reading `prediction_locks`; this just keeps the UI honest.
 */
export function groupMatchStatus(
  matchStatus: string | null | undefined,
  dayLockAtISO: string | null,
  now: number,
): GroupMatchStatus {
  if (matchStatus === "FINISHED") return "finished";
  if (matchStatus && LIVE_OR_DONE.has(matchStatus)) return "locked";
  if (!dayLockAtISO) return "locked"; // fail closed when the lock is unknown
  if (now >= new Date(dayLockAtISO).getTime()) return "locked";
  return "open";
}
