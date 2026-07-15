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
  /** True match winner incl. ET + shootout (FD score.winner). REQUIRED for an
   *  ET-win-no-shootout KO match: its 90' score is a draw with null penalties,
   *  so `winner` is the ONLY signal that resolves the qualifier — without it the
   *  NEXT round's slot never resolves, gets no lock row, and every pick on that
   *  match is silently unsaveable (save RPC fails closed). */
  winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
}

export interface PredictionLockRow {
  scope: "group" | "ko";
  /** group: `${letter}:${pairIdx}` (e.g. "A:0"); ko: bracket slot key. */
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
      // Thread the true winner so a 90'-draw KO (ET/shootout) advances the real
      // qualifier and the next round's slot resolves → gets a lock row.
      winner: m.winner ?? null,
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
  // NOTE: the third-place play-off gets NO lock row — it isn't bettable (no slot
  // in the prediction tree), so there's nothing to gate or reveal for it.

  return rows;
}
