// Shared "is a match live right now?" gate for client refresh loops. Every
// score surface (today-matches widget, leaderboard, live groups/bracket) polls
// /api/matches every 60s — but ONLY inside a play window, so idle hours don't
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

/** Standard refresh cadence for live score surfaces (server cache is 60s too). */
export const LIVE_REFRESH_MS = 60_000;
