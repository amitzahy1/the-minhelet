// Centralized tournament constants
// Production deadline: June 10, 2026, 17:00 Israel time = 14:00 UTC
// (one day before tournament kickoff on 11.06.2026)
export const LOCK_DEADLINE = new Date("2026-06-10T14:00:00Z");

export function isLocked(): boolean {
  return new Date() >= LOCK_DEADLINE;
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
