// ============================================================================
// WC2026 — Compute "who hit what" for finished matches
// Shared between TodayMatches (home widget) and compare page results tab.
// ============================================================================

import { GROUPS } from "./tournament/groups";
import type { BettorBracket } from "./supabase/shared-data";

export const GROUP_MATCH_PAIRS: Array<[number, number]> = [
  [0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2],
];

export type HitKind = "exact" | "toto" | "miss" | "empty";

export interface BettorHit {
  userId: string;
  name: string;
  pred: { home: number | null; away: number | null };
  hit: HitKind;
}

export interface FinishedMatch {
  id: number;
  date: string;
  homeTla: string;
  awayTla: string;
  group: string; // letter A-L (normalized)
  stage: string;
  homeGoals: number;
  awayGoals: number;
}

export function classifyHit(
  pred: { home: number | null; away: number | null },
  actual: { home: number; away: number }
): HitKind {
  if (pred.home === null || pred.away === null) return "empty";
  if (pred.home === actual.home && pred.away === actual.away) return "exact";
  const predOut = pred.home > pred.away ? "H" : pred.home < pred.away ? "A" : "D";
  const actOut = actual.home > actual.away ? "H" : actual.home < actual.away ? "A" : "D";
  return predOut === actOut ? "toto" : "miss";
}

/**
 * For a group-stage match, look up each bettor's stored prediction from
 * their bracket and compare to the actual result.
 */
export function computeGroupHits(
  match: FinishedMatch,
  brackets: BettorBracket[]
): BettorHit[] {
  const teams = GROUPS[match.group];
  if (!teams) return [];
  const homeIdx = teams.findIndex((t) => t.code === match.homeTla);
  const awayIdx = teams.findIndex((t) => t.code === match.awayTla);
  if (homeIdx < 0 || awayIdx < 0) return [];

  // Match the pair (order-insensitive) and record if flipped vs canonical.
  let pairIdx = -1;
  let flipped = false;
  for (let i = 0; i < GROUP_MATCH_PAIRS.length; i++) {
    const [a, b] = GROUP_MATCH_PAIRS[i];
    if (a === homeIdx && b === awayIdx) { pairIdx = i; flipped = false; break; }
    if (a === awayIdx && b === homeIdx) { pairIdx = i; flipped = true; break; }
  }
  if (pairIdx < 0) return [];

  const out: BettorHit[] = [];
  for (const b of brackets) {
    const stored = b.groupPredictions?.[match.group]?.scores?.[pairIdx];
    const pred = stored
      ? (flipped ? { home: stored.away, away: stored.home } : { home: stored.home, away: stored.away })
      : { home: null, away: null };
    out.push({
      userId: b.userId,
      name: b.displayName || "ללא שם",
      pred,
      hit: classifyHit(pred, { home: match.homeGoals, away: match.awayGoals }),
    });
  }
  // Order: exact → toto → miss → empty, then alphabetical
  const rank: Record<HitKind, number> = { exact: 0, toto: 1, miss: 2, empty: 3 };
  return out.sort((a, b) => rank[a.hit] - rank[b.hit] || a.name.localeCompare(b.name, "he"));
}

/** Short hit summary counts for the header. */
export function hitCounts(hits: BettorHit[]): { exact: number; toto: number; miss: number; empty: number } {
  return hits.reduce(
    (acc, h) => {
      acc[h.hit] += 1;
      return acc;
    },
    { exact: 0, toto: 0, miss: 0, empty: 0 }
  );
}

/** Normalize Football-Data group string (e.g. "GROUP_A") to a single letter. */
export function normalizeGroupLetter(raw: string | undefined | null): string {
  if (!raw) return "";
  const m = raw.toString().match(/([A-L])/i);
  return m ? m[1].toUpperCase() : "";
}
