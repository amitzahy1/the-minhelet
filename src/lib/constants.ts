// Centralized tournament constants
// Production deadline: June 10, 2026 17:00 Israel time = 14:00 UTC
// (was 2026-04-18T17:00:00Z during the demo-week sprint)
export const LOCK_DEADLINE = new Date("2026-06-10T14:00:00Z");

export function isLocked(): boolean {
  return new Date() >= LOCK_DEADLINE;
}

/**
 * Display-side reveal grace: other bettors' picks are SHOWN this long after
 * their lock instant (e.g. day locks 21:30 → picks display from 21:31).
 *
 * Saves are already hard-blocked server-side at the lock itself
 * (prediction_locks + save RPCs), so nothing can change in the extra minute —
 * the grace only absorbs client clock skew and the 30s shared-data cache, so
 * the UI never claims "revealed" while a fetch could still return redacted
 * (pre-lock) data. Applies to DISPLAY gates only; never to save/lock
 * enforcement.
 */
export const REVEAL_GRACE_MS = 60_000;

/** A lock instant's display-reveal instant: lock + {@link REVEAL_GRACE_MS}. */
export function revealAtFor(lockAt: string | Date): Date {
  return new Date(new Date(lockAt).getTime() + REVEAL_GRACE_MS);
}

/** Formats LOCK_DEADLINE for display — e.g. "18.04.2026, 20:00".
 *  Single source of truth so the onboarding wizard, lock-notice strips,
 *  and save errors never drift apart across demo and main.
 */
export function formatLockDeadline(): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jerusalem",
  }).format(LOCK_DEADLINE);
}

/**
 * Over/under line for the "total penalties in the tournament" special bet.
 *
 * Definition (set 2026-06-01): counts penalty kicks AWARDED in regulation +
 * extra time. Penalty SHOOTOUTS are NOT counted. Admin enters the running
 * total; OVER/UNDER is derived from it via {@link penaltiesResult}.
 *
 * Why 21.5: in the VAR era the in-play penalty rate settled to ~10–14 per
 * 64-match tournament in 2022 (≈0.16–0.22/match) after IFAB softened handball
 * enforcement; 2018's record 29 was a VAR-novelty outlier, not a baseline.
 * Projected onto 104 matches that is ~16–23, nudged up for the 48-team field
 * (more weak defenses conceding box fouls) and the larger knockout slate with
 * extra-time minutes. 21.5 gives a roughly even OVER/UNDER. (The previous 18.5
 * was a leftover label, never wired into scoring.)
 *
 * Single source of truth: imported by the betting UI, the live trackers, and
 * the scoring derivation. The `league_config.penalties_line` DB column is
 * vestigial — nothing reads it. Change the line here.
 */
export const PENALTIES_LINE = 21.5;

/**
 * Derive OVER/UNDER from a total penalty count vs {@link PENALTIES_LINE}.
 * Returns null when no count exists yet. The line is a half-number, so a push
 * is impossible.
 */
export function penaltiesResult(total: number | null | undefined): "OVER" | "UNDER" | null {
  if (total == null) return null;
  return total > PENALTIES_LINE ? "OVER" : "UNDER";
}
