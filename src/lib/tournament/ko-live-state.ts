// ============================================================================
// Tree 2 (real-data knockout) per-slot state machine.
//
// Derives, for each bracket slot, whether the bettor can edit it:
//   waiting  — teams not yet known (group stage incomplete, best-thirds
//              unresolved, or the feeding round hasn't finished). Cascade
//              gating falls out automatically from resolveKnockoutTree.
//   open     — teams known, more than `lockBeforeMin` before kickoff. EDITABLE.
//   locked   — teams known, within `lockBeforeMin` of kickoff (or live). Read-only.
//   finished — the real match has a winner. Show result + the user's pick.
//
// Times are compared in UTC (Date math is timezone-agnostic); only DISPLAY
// should localise to Asia/Jerusalem.
// ============================================================================

import {
  findKickoffForSlot,
  type SlotState,
  type KoSlotKey,
  type ScheduleMatch,
} from "@/lib/scoring/knockout-resolver";

export type SlotStatus = "waiting" | "open" | "locked" | "finished";

const LIVE_OR_DONE = new Set(["IN_PLAY", "PAUSED", "LIVE", "FINISHED"]);

/** Default per-match lock window (minutes before kickoff). Mirrors league_config.match_prediction_lock_before_minutes. */
export const LOCK_BEFORE_MIN = 30;

export function slotStatus(
  slotKey: KoSlotKey,
  tree: Record<KoSlotKey, SlotState>,
  schedule: ScheduleMatch[],
  now: number,
  lockBeforeMin: number = LOCK_BEFORE_MIN,
): SlotStatus {
  const slot = tree[slotKey];
  if (!slot || !slot.team1 || !slot.team2) return "waiting";
  if (slot.winner) return "finished";
  const ko = findKickoffForSlot(slotKey, tree, schedule);
  if (!ko) return "waiting"; // teams known but no scheduled match found yet
  if (ko.status && LIVE_OR_DONE.has(ko.status)) return "locked";
  const lockAt = new Date(ko.date).getTime() - lockBeforeMin * 60_000;
  return now >= lockAt ? "locked" : "open";
}

/** ISO timestamp at which the slot locks (kickoff − lockBeforeMin), or null if no kickoff known. */
export function lockAtFor(
  slotKey: KoSlotKey,
  tree: Record<KoSlotKey, SlotState>,
  schedule: ScheduleMatch[],
  lockBeforeMin: number = LOCK_BEFORE_MIN,
): string | null {
  const ko = findKickoffForSlot(slotKey, tree, schedule);
  if (!ko) return null;
  return new Date(new Date(ko.date).getTime() - lockBeforeMin * 60_000).toISOString();
}
