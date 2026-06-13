// Single source of truth for turning Football-Data matches into
// demo_match_results rows. BOTH sync paths (/api/sync cron+manual GET and the
// admin POST /api/admin/results/sync-from-api) MUST go through here — they
// used to diverge, and the divergent copy wrote raw FD stages (GROUP_STAGE,
// LAST_32), raw FD TLAs (URY/CUW), null penalties, and — critically — had no
// null-goals guard, which is how the opening match got persisted as FINISHED
// with no score.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { MatchResult } from "@/lib/api-football-data";
import { toAppCode } from "@/lib/fd-team-mapping";
import { normalizeGroupLetter } from "@/lib/results-hits";
import { getTsdbCardBoard } from "@/lib/api-thesportsdb";
import { getEspnCardBoard } from "@/lib/api-espn";

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
