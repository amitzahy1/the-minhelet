// ============================================================================
// WC2026 — Compute "who hit what" for finished matches
// Shared between TodayMatches (home widget) and compare page results tab.
// ============================================================================

import { GROUPS } from "./tournament/groups";
import type { BettorBracket } from "./supabase/shared-data";

// Football-Data.org (like most external sources) often returns ISO 3166-1
// alpha-3 codes instead of FIFA codes. Map the common divergences so team
// lookups against our GROUPS (which use FIFA codes) still resolve.
const TLA_ALIAS: Record<string, string> = {
  ZAF: "RSA",   // South Africa
  CHE: "SUI",   // Switzerland
  HTI: "HAI",   // Haiti
  PRY: "PAR",   // Paraguay
  DEU: "GER",   // Germany
  CUW: "CUR",   // Curaçao
  NLD: "NED",   // Netherlands
  URY: "URU",   // Uruguay
  SAU: "KSA",   // Saudi Arabia
  DZA: "ALG",   // Algeria
  PRT: "POR",   // Portugal
  HRV: "CRO",   // Croatia
};

export function normalizeTla(tla: string | null | undefined): string {
  if (!tla) return "";
  const upper = tla.toString().toUpperCase();
  return TLA_ALIAS[upper] ?? upper;
}

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
  /** 90-MINUTE score (regulation only). ET & shootout are NOT included — the
   *  exact/toto bet is judged on this. The true qualifier comes from `winner`. */
  homeGoals: number;
  awayGoals: number;
  /** Shootout-only goals, only present when the match was decided on penalties. */
  homePenalties?: number | null;
  awayPenalties?: number | null;
  /** True match winner incl. ET + shootout (football-data `score.winner`). Lets
   *  the KO resolver advance the real qualifier even when 90' was a draw
   *  (extra-time-decided, no shootout). Absent → fall back to goals/penalties. */
  winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
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
 * Map a real group-stage fixture (group letter + the two team TLAs, in any
 * order) to the canonical stored-prediction pair index (0–5) used in
 * `group_predictions[group].scores`, plus whether the real home/away is flipped
 * vs the canonical {@link GROUP_MATCH_PAIRS} orientation.
 *
 * Single source of truth shared by the hit computation, the live-edit save
 * path, and the shared-bets visibility redaction so all three agree on which
 * stored score belongs to which real match. Returns null when either team
 * isn't in the group or the pairing isn't a recognised group match.
 */
export function matchPairIndex(
  group: string,
  homeTla: string,
  awayTla: string,
): { pairIdx: number; flipped: boolean } | null {
  const teams = GROUPS[group];
  if (!teams) return null;
  const homeCode = normalizeTla(homeTla);
  const awayCode = normalizeTla(awayTla);
  const homeIdx = teams.findIndex((t) => t.code === homeCode);
  const awayIdx = teams.findIndex((t) => t.code === awayCode);
  if (homeIdx < 0 || awayIdx < 0) return null;

  // Match the pair (order-insensitive) and record if flipped vs canonical.
  for (let i = 0; i < GROUP_MATCH_PAIRS.length; i++) {
    const [a, b] = GROUP_MATCH_PAIRS[i];
    if (a === homeIdx && b === awayIdx) return { pairIdx: i, flipped: false };
    if (a === awayIdx && b === homeIdx) return { pairIdx: i, flipped: true };
  }
  return null;
}

/**
 * For a group-stage match, look up each bettor's stored prediction from
 * their bracket and compare to the actual result.
 */
export function computeGroupHits(
  match: FinishedMatch,
  brackets: BettorBracket[]
): BettorHit[] {
  // Defense-in-depth: a match with no real score must never be graded. Callers
  // already filter null-goal FINISHED rows, but `classifyHit` treats null-null
  // as a draw (null>null and null<null are both false → "D"), which would hand
  // a phantom toto to everyone who predicted a draw. Guard at the chokepoint.
  if (
    match.homeGoals == null || match.awayGoals == null ||
    Number.isNaN(match.homeGoals) || Number.isNaN(match.awayGoals)
  ) return [];
  const pair = matchPairIndex(match.group, match.homeTla, match.awayTla);
  if (!pair) return [];
  const { pairIdx, flipped } = pair;

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
  const str = raw.toString().toUpperCase().trim();
  // Already a single letter — easy path.
  if (/^[A-L]$/.test(str)) return str;
  // Strip "GROUP" / "GROUP_" / "GROUP " prefix, then expect a single letter.
  // The previous regex /([A-L])/ matched the FIRST letter A-L anywhere, so
  // "GROUP_A" resolved to "G" (from the word GROUP) — silently corrupting
  // every hit computation.
  const cleaned = str.replace(/^GROUP[_\s-]*/i, "");
  if (/^[A-L]$/.test(cleaned)) return cleaned;
  // Last resort: pick the final A-L letter in the string.
  const tail = cleaned.match(/([A-L])\s*$/);
  return tail ? tail[1] : "";
}
