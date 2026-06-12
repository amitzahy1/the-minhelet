// Single source of truth for turning Football-Data matches into
// demo_match_results rows. BOTH sync paths (/api/sync cron+manual GET and the
// admin POST /api/admin/results/sync-from-api) MUST go through here — they
// used to diverge, and the divergent copy wrote raw FD stages (GROUP_STAGE,
// LAST_32), raw FD TLAs (URY/CUW), null penalties, and — critically — had no
// null-goals guard, which is how the opening match got persisted as FINISHED
// with no score.

import type { MatchResult } from "@/lib/api-football-data";
import { toAppCode } from "@/lib/fd-team-mapping";
import { normalizeGroupLetter } from "@/lib/results-hits";

// football-data WC2026 stage labels (verified live): GROUP_STAGE, LAST_32 (the
// 48-team Round of 32), LAST_16 (Round of 16), QUARTER_FINALS, SEMI_FINALS,
// THIRD_PLACE, FINAL. Map to our internal codes. Unknown stages pass through.
export const FD_STAGE_TO_APP: Record<string, string> = {
  GROUP_STAGE: "GROUP",
  LAST_32: "R32",
  LAST_16: "R16",
  QUARTER_FINALS: "QF",
  SEMI_FINALS: "SF",
  THIRD_PLACE: "THIRD",
  FINAL: "FINAL",
};

export interface DemoResultRow {
  match_id: string;
  stage: string;
  group_id: string | null;
  home_team: string;
  away_team: string;
  home_goals: number;
  away_goals: number;
  home_penalties: number | null;
  away_penalties: number | null;
  status: "FINISHED";
  scheduled_at: string | null;
  entered_by: string;
  updated_at: string;
}

/**
 * Build upsert-ready rows from raw FD matches. Only matches that are FINISHED
 * **with a real score** become rows — FD flips status to FINISHED minutes
 * before the score is entered on the free tier, and persisting that window
 * poisons every display with a scoreless "finished" match.
 */
export function buildResultRows(matches: MatchResult[], enteredBy: string): DemoResultRow[] {
  const rows: DemoResultRow[] = [];
  for (const m of matches) {
    if (m.status !== "FINISHED") continue;
    // 90-minute score only: prefer regularTime (present once a KO match goes
    // past 90'); else fullTime (group + regulation-decided matches, where
    // fullTime IS the 90' score). NEVER raw fullTime for shootouts — it
    // aggregates the shootout into the scoreline.
    const homeGoals = m.score?.regularTime?.home ?? m.score?.fullTime?.home;
    const awayGoals = m.score?.regularTime?.away ?? m.score?.fullTime?.away;
    if (homeGoals == null || awayGoals == null) continue;
    rows.push({
      match_id: String(m.id),
      stage: FD_STAGE_TO_APP[m.stage] ?? m.stage ?? "GROUP",
      group_id: normalizeGroupLetter(m.group) || null,
      home_team: toAppCode(m.homeTeam?.tla),
      away_team: toAppCode(m.awayTeam?.tla),
      home_goals: homeGoals,
      away_goals: awayGoals,
      // Shootout score (knockouts decided on penalties) — kept separate from
      // goals so it never pollutes the 90' scoreline; the resolver uses it +
      // `winner` to advance the real qualifier.
      home_penalties: m.score?.penalties?.home ?? null,
      away_penalties: m.score?.penalties?.away ?? null,
      status: "FINISHED",
      scheduled_at: m.utcDate ?? null,
      entered_by: enteredBy,
      updated_at: new Date().toISOString(),
    });
  }
  return rows;
}
