// Shared "is a match live right now?" gate for client refresh loops. Every
// score surface (today-matches widget, leaderboard, live groups/bracket) polls
// /api/matches every 2 min — but ONLY inside a play window, so idle hours don't
// burn requests. Keep the window logic in one place.

export interface PlayWindowMatch {
  date: string;
  status?: string | null;
}

/**
 * True when any match is IN_PLAY/PAUSED, or within [-15min, +150min] of its
 * scheduled kickoff (covers FD's lag in flipping SCHEDULED→IN_PLAY→FINISHED).
 */
export function anyMatchInPlayWindow(matches: PlayWindowMatch[], nowMs: number = Date.now()): boolean {
  return matches.some((m) => {
    if (m.status === "IN_PLAY" || m.status === "PAUSED") return true;
    if (m.status === "FINISHED") return false;
    const ko = new Date(m.date).getTime();
    return nowMs >= ko - 15 * 60_000 && nowMs <= ko + 150 * 60_000;
  });
}

// Standard refresh cadence for live score surfaces. 2 min (not 60s): every
// active viewer's browser hits /api/matches on this timer during the play
// window, and those invocations are what burn Vercel's Fluid Active CPU quota.
// A goal still shows within 2 min — imperceptible for live football — while
// halving serverless load. The server-side FD fetch still revalidates at 60s,
// so every poll gets fresh-enough data.
export const LIVE_REFRESH_MS = 120_000;
