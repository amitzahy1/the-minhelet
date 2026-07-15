// Single source of truth for turning Football-Data matches into
// demo_match_results rows. BOTH sync paths (/api/sync cron+manual GET and the
// admin POST /api/admin/results/sync-from-api) MUST go through here — they
// used to diverge, and the divergent copy wrote raw FD stages (GROUP_STAGE,
// LAST_32), raw FD TLAs (URY/CUW), null penalties, and — critically — had no
// null-goals guard, which is how the opening match got persisted as FINISHED
// with no score.

import type { SupabaseClient } from "@supabase/supabase-js";
import { ninetyMinuteScore, fullTime120Score, decisivePenalties, type MatchResult } from "@/lib/api-football-data";
import { toAppCode } from "@/lib/fd-team-mapping";
import { normalizeGroupLetter } from "@/lib/results-hits";
import { getTsdbCardBoard } from "@/lib/api-thesportsdb";
import { getEspnCardBoard, type EspnResult } from "@/lib/api-espn";

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
  /** 120' score (regulation + extra time, EXCLUDING shootout) — what the
   *  special bets (best-attack) count. Equals the 90' score for group matches. */
  home_goals_120: number;
  away_goals_120: number;
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
    // 90-minute score only. ninetyMinuteScore strips ET/shootout goals off the
    // FD aggregate — crucially it also handles the ET-win-no-shootout case where
    // FD leaves regularTime null, which the old `regularTime ?? fullTime`
    // silently stored as the 120' score.
    const { home: homeGoals, away: awayGoals } = ninetyMinuteScore(m.score);
    if (homeGoals == null || awayGoals == null) continue;
    // 120' score (regulation + ET, minus shootout) for the special bets. Falls
    // back to the 90' score if FD hasn't populated fullTime yet (never below it).
    const ft120 = fullTime120Score(m.score);
    rows.push({
      match_id: String(m.id),
      stage: FD_STAGE_TO_APP[m.stage] ?? m.stage ?? "GROUP",
      group_id: normalizeGroupLetter(m.group) || null,
      home_team: toAppCode(m.homeTeam?.tla),
      away_team: toAppCode(m.awayTeam?.tla),
      home_goals: homeGoals,
      away_goals: awayGoals,
      home_goals_120: ft120.home ?? homeGoals,
      away_goals_120: ft120.away ?? awayGoals,
      // Shootout score (knockouts decided on penalties) — kept separate from
      // goals so it never pollutes the 90' scoreline; the resolver uses it +
      // `winner` to advance the real qualifier. decisivePenalties drops a TIED
      // pens pair (feed garbage — a decided shootout can't tie): persisting it
      // would freeze the garbage in the DB, shadowing FD's later correction.
      home_penalties: decisivePenalties(m.score).home,
      away_penalties: decisivePenalties(m.score).away,
      status: "FINISHED",
      scheduled_at: m.utcDate ?? null,
      entered_by: enteredBy,
      updated_at: new Date().toISOString(),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Feed reconciliation (FD vs ESPN) + admin-edit protection
// ---------------------------------------------------------------------------
// Football-Data is authoritative for the 90' score EXCEPT when it carries a
// phantom goal: ESP-KSA was published by FD as 5-0 when the real result (and
// ESPN) was 4-0 — a disallowed goal FD never removed from its aggregate, and
// the free tier exposes no goal/booking events to detect it locally. ESPN has
// been right on every WC2026 match so far. So before persisting an automated
// score we cross-check the two feeds: on a GROUP-stage disagreement we prefer
// ESPN, tag the row "espn-corrected" (still auto-correctable), and SURFACE the
// disagreement so an admin can lock the true result with one click.

// entered_by values written by automated feeds — overwritable by a later sync.
// Anything else (an admin email) is a HUMAN confirmation and is never
// auto-overwritten.
export const AUTO_SOURCES = new Set([
  "football-data-sync", "auto-heal", "espn-fallback", "thesportsdb-fallback", "espn-corrected",
]);
export const isAdminConfirmed = (enteredBy: string | null | undefined): boolean =>
  !!enteredBy && !AUTO_SOURCES.has(enteredBy);

export interface ScoreDisagreement {
  match_id: string;
  home_team: string;
  away_team: string;
  fd: string;   // "home-away", oriented to the row
  espn: string; // "home-away", oriented to the row
}

/** ESPN's score for a team pair, oriented to (home, away). null if absent. */
export function espnScoreFor(
  home: string, away: string, espn: EspnResult[] | null,
): { home: number; away: number } | null {
  if (!espn) return null;
  const ev = espn.find(
    (e) => (e.homeCode === home && e.awayCode === away) || (e.homeCode === away && e.awayCode === home),
  );
  if (!ev) return null;
  const flipped = ev.homeCode === away;
  return { home: flipped ? ev.awayGoals : ev.homeGoals, away: flipped ? ev.homeGoals : ev.awayGoals };
}

/**
 * Reconcile FD-derived finished rows against ESPN before persisting.
 *  - SKIPS any match a human admin has already confirmed (never clobbers it) —
 *    this is also the missing guard that let the daily cron overwrite admin
 *    corrections to a FINISHED match.
 *  - GROUP-stage FD-vs-ESPN score disagreement → prefer ESPN, tag row
 *    "espn-corrected", and record the disagreement for the admin alert.
 *  - KO matches are NOT reconciled (ESPN's score can include extra time; FD's
 *    regularTime/penalties split is authoritative there).
 */
export function reconcileFinishedRows(
  fdRows: DemoResultRow[],
  existingById: Record<string, { entered_by?: string | null } | undefined>,
  espnResults: EspnResult[] | null,
): { rows: DemoResultRow[]; disagreements: ScoreDisagreement[] } {
  const disagreements: ScoreDisagreement[] = [];
  const rows: DemoResultRow[] = [];
  for (const row of fdRows) {
    const existing = existingById[row.match_id];
    if (existing && isAdminConfirmed(existing.entered_by)) continue; // protect human edits
    if (row.stage === "GROUP") {
      const espn = espnScoreFor(row.home_team, row.away_team, espnResults);
      if (espn && (espn.home !== row.home_goals || espn.away !== row.away_goals)) {
        disagreements.push({
          match_id: row.match_id,
          home_team: row.home_team,
          away_team: row.away_team,
          fd: `${row.home_goals}-${row.away_goals}`,
          espn: `${espn.home}-${espn.away}`,
        });
        // Group stage → 120' equals the 90' score, so mirror the correction.
        rows.push({ ...row, home_goals: espn.home, away_goals: espn.away, home_goals_120: espn.home, away_goals_120: espn.away, entered_by: "espn-corrected" });
        continue;
      }
    }
    rows.push(row);
  }
  return { rows, disagreements };
}

// ---------------------------------------------------------------------------
// Cards board (the "dirtiest team" tally)
// ---------------------------------------------------------------------------
// football-data's free tier has NO bookings, so the card tally is pulled from
// TheSportsDB match timelines. We write only `dirtiest_board` (the running
// per-team tally) — the FINAL `dirtiest_team` answer stays admin-entered, so a
// sync never prematurely "decides" the special bet.
//
// Called from /api/sync (daily cron + manual) AND the /api/matches self-heal
// (so the board refreshes through the play day, not just once daily). A
// null/empty board (source unreachable) is never written. Existing values are
// MAX-merged so a manual admin correction is never lowered by a lagging feed.

export interface CardRow { team: string; yellow: number; red: number }

/**
 * @param force  When false (the /api/matches self-heal), a DB-backed gate skips
 *   the sync if the board was auto-synced within `minIntervalMs`. The gate is a
 *   SHARED timestamp (tournament_actuals.updated_at), so it holds across all
 *   serverless instances — without it, N concurrent instances would each fan
 *   out N timeline calls and trip TheSportsDB's 30 req/min limit. The cron and
 *   manual admin sync pass force=true. Never skips when an ADMIN last wrote the
 *   row (entered_by != tsdb-cards-sync) — we don't want to stall a manual edit.
 */
export async function syncCardBoard(
  supabase: SupabaseClient,
  { force = false, minIntervalMs = 15 * 60_000 }: { force?: boolean; minIntervalMs?: number } = {},
): Promise<number> {
  const { data: tourn } = await supabase
    .from("tournaments")
    .select("id")
    .eq("is_current", true)
    .limit(1)
    .maybeSingle();
  if (!tourn?.id) return 0;

  // Protective read — skip entirely on failure so we never overwrite a good
  // board with a partial/empty one.
  const { data: actuals, error: actualsErr } = await supabase
    .from("tournament_actuals")
    .select("dirtiest_board, updated_at, entered_by")
    .eq("tournament_id", tourn.id)
    .maybeSingle();
  if (actualsErr) return 0;

  // Shared rate gate (self-heal only): if the LAST writer was this auto-sync and
  // it ran recently, skip the external fan-out. Date.now() is fine in a route.
  if (!force && actuals?.entered_by === "tsdb-cards-sync" && actuals.updated_at) {
    const age = Date.now() - new Date(actuals.updated_at).getTime();
    if (age >= 0 && age < minIntervalMs) return 0;
  }

  // ESPN's free API has ACCURATE, untruncated card counts (verified: Paraguay
  // 5 yellows, RSA 2🟨2🟥) — use it first. TheSportsDB is the fallback only if
  // ESPN is unreachable (it undercounts due to the 5-row free cap).
  const board = (await getEspnCardBoard()) ?? (await getTsdbCardBoard());
  if (!board || board.length === 0) return 0;

  const existing = new Map(
    ((actuals?.dirtiest_board as CardRow[] | null) || []).map((b) => [b.team, b])
  );
  const merged: CardRow[] = board.map((b) => {
    const prev = existing.get(b.team);
    existing.delete(b.team);
    return { team: b.team, yellow: Math.max(b.yellow, prev?.yellow ?? 0), red: Math.max(b.red, prev?.red ?? 0) };
  });
  merged.push(...existing.values()); // admin-only teams the feed doesn't list
  merged.sort((a, b) => (b.yellow + b.red * 3) - (a.yellow + a.red * 3));

  const { error } = await supabase
    .from("tournament_actuals")
    .upsert(
      { tournament_id: tourn.id, dirtiest_board: merged, entered_by: "tsdb-cards-sync", updated_at: new Date().toISOString() },
      { onConflict: "tournament_id" }
    );
  return error ? 0 : merged.length;
}
