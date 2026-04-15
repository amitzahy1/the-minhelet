// Centralized tournament constants
// DEMO MODE: April 18, 2026 20:00 Israel time = 17:00 UTC
// Real deadline (on main): 2026-06-10T14:00:00Z
export const LOCK_DEADLINE = new Date("2026-04-18T17:00:00Z");

export function isLocked(): boolean {
  return new Date() >= LOCK_DEADLINE;
}
