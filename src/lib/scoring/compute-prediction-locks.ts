// ============================================================================
// WC2026 — Server-authoritative prediction-lock rows.
//
// Builds the rows persisted in the `prediction_locks` table (migration 024),
// which the save RPCs read to enforce locks WITHOUT trusting a client-supplied
// time and WITHOUT needing the live feed at save time. This is the only place
// lock times are computed for enforcement; it runs in a trusted server context
// (the /api/sync-locks cron), reusing the SAME functions the browser uses for
// display so the two never diverge:
//   - groups:   matchPairIndex + computeMatchDays/dayLockAtForKickoff (−30 min)
//   - knockout: resolveKnockoutTree + findKickoffForSlot / lockAtFor (−30 min)
// ============================================================================

import { matchPairIndex, normalizeGroupLetter, type FinishedMatch } from "@/lib/results-hits";
import { computeMatchDays, dayLockAtForKickoff } from "@/lib/tournament/group-live-state";
import {
  resolveKnockoutTree,
  findKickoffForSlot,
  KO_SLOT_KEYS,
  type ScheduleMatch,
} from "@/lib/scoring/knockout-resolver";
import { lockAtFor } from "@/lib/tournament/ko-live-state";
import { LIVE_FEEDERS } from "@/lib/tournament/knockout-derivation";

/** Knockout per-match lock window (minutes before kickoff). Mirrors Tree 2. */
const KO_LOCK_BEFORE_MIN = 30;

/** Minimal match shape — exactly what /api/matches returns per match. */
export interface LockSyncMatch {
  id?: number | string;
  date: string;
  homeTla: string;
  awayTla: string;
  group?: string | null;
  stage?: string | null;
  status?: string | null;
  homeGoals?: number | null;
  awayGoals?: number | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
}

export interface PredictionLockRow {
  scope: "group" | "ko";
  /** group: `${letter}:${pairIdx}` (e.g. "A:0"); ko: slot key or "third_place". */
  lock_key: string;
  match_id: string | null;
  kickoff: string | null;
  lock_at: string;
}

const isGroupStage = (m: LockSyncMatch) => (m.stage || "").toUpperCase().includes("GROUP");

/**
 * Compute the authoritative lock rows from the full schedule (scheduled +
 * finished matches, as returned by /api/matches). `thirdsOverride` mirrors the
 * admin best-thirds override the knockout bracket uses, so resolved KO slots —
 * and thus their kickoff lookup — match what the user sees.
 */
export function computePredictionLockRows(
  matches: LockSyncMatch[],
  thirdsOverride?: string[] | null,
): PredictionLockRow[] {
  const rows: PredictionLockRow[] = [];

  // ---- Group scores: one row per (group, pair index), locking per match-day ----
  const groupMatches = matches.filter(isGroupStage);
  const days = computeMatchDays(
    groupMatches.map((m) => ({ date: m.date, group: m.group, stage: m.stage, status: m.status })),
  );
  for (const m of groupMatches) {
    const letter = normalizeGroupLetter(m.group);
    if (!letter) continue;
    const pair = matchPairIndex(letter, m.homeTla, m.awayTla);
    if (!pair) continue;
    const lockAt = dayLockAtForKickoff(m.date, days);
    if (!lockAt) continue;
    rows.push({
      scope: "group",
      lock_key: `${letter}:${pair.pairIdx}`,
      match_id: m.id != null ? String(m.id) : null,
      kickoff: m.date,
      lock_at: lockAt,
    });
  }

  // ---- Knockout slots: resolve the bracket from finished results, then lock
  //      each resolved slot 30 min before its real kickoff ----
  const finished: FinishedMatch[] = matches
    .filter((m) => m.homeGoals != null && m.awayGoals != null)
    .map((m) => ({
      id: Number(m.id) || 0,
      date: m.date,
      homeTla: m.homeTla,
      awayTla: m.awayTla,
      group: normalizeGroupLetter(m.group),
      stage: m.stage || "",
      homeGoals: m.homeGoals as number,
      awayGoals: m.awayGoals as number,
      homePenalties: m.homePenalties ?? null,
      awayPenalties: m.awayPenalties ?? null,
    }));
  const schedule: ScheduleMatch[] = matches.map((m) => ({
    homeTla: m.homeTla,
    awayTla: m.awayTla,
    date: m.date,
    status: m.status ?? null,
  }));
  const tree = resolveKnockoutTree(finished, thirdsOverride ?? null, undefined, LIVE_FEEDERS);
  for (const key of KO_SLOT_KEYS) {
    const lockAt = lockAtFor(key, tree, schedule, KO_LOCK_BEFORE_MIN);
    if (!lockAt) continue; // slot not resolved yet → no row → save fails closed
    const ko = findKickoffForSlot(key, tree, schedule);
    rows.push({ scope: "ko", lock_key: key, match_id: null, kickoff: ko?.date ?? null, lock_at: lockAt });
  }

  // Third-place play-off (separate from the main slot tree): its match carries a
  // fixed date in the schedule, so lock it directly 30 min before kickoff.
  const third = matches.find((m) => (m.stage || "").toUpperCase().startsWith("THIRD"));
  if (third?.date) {
    rows.push({
      scope: "ko",
      lock_key: "third_place",
      match_id: third.id != null ? String(third.id) : null,
      kickoff: third.date,
      lock_at: new Date(new Date(third.date).getTime() - KO_LOCK_BEFORE_MIN * 60_000).toISOString(),
    });
  }

  return rows;
}
