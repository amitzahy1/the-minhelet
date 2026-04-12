// Centralized tournament constants
// June 10, 2026 17:00 Israel time = 14:00 UTC
export const LOCK_DEADLINE = new Date("2026-06-10T14:00:00Z");

export function isLocked(): boolean {
  return new Date() >= LOCK_DEADLINE;
}
