import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getMatches } from "@/lib/api-football-data";
import { buildResultRows, type DemoResultRow } from "@/lib/sync-results";
import { getTsdbRecentResults, getTsdbCardBoard } from "@/lib/api-thesportsdb";
import { toAppCode } from "@/lib/fd-team-mapping";
import { normalizeGroupLetter } from "@/lib/results-hits";

/**
 * GET /api/sync — Sync match results into `demo_match_results`.
 * Can be called manually from admin panel or by a cron job.
 *
 * Two sources, in priority order:
 * 1. Football-Data.org (authoritative): FINISHED matches with a published
 *    score, mapped via the shared buildResultRows (stage/TLA normalization,
 *    90'-score selection, penalties, null-score guard).
 * 2. TheSportsDB (fallback, group stage only): FD's free tier delays scores —
 *    when a group match should be over but FD has no usable score yet, fill
 *    the final from TheSportsDB, matched strictly onto the FD fixture (same
 *    date + same team pair). FD overwrites the fallback on a later sync.
 */
export async function GET() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    return NextResponse.json(
      { success: false, error: "FOOTBALL_DATA_TOKEN not configured. Register at football-data.org" },
      { status: 500 }
    );
  }

  let all;
  try {
    all = await getMatches(true);
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) });
  }

  const finished = (all || []).filter((m) => m.status === "FINISHED");
  const rows: DemoResultRow[] = buildResultRows(finished, "football-data-sync");
  const haveScore = new Set(rows.map((r) => r.match_id));
  const pendingScore = finished.length - rows.length;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = url && serviceKey ? createClient(url, serviceKey) : null;

  // ---- TheSportsDB fallback (group stage only — KO needs FD's ET/penalty
  // breakdown, which TheSportsDB doesn't model) ----
  const fallbackRows: DemoResultRow[] = [];
  const nowMs = Date.now();
  const fallbackCandidates = (all || []).filter((m) => {
    if (m.stage !== "GROUP_STAGE" || haveScore.has(String(m.id))) return false;
    // "Should be over": FD says FINISHED (score pending), or kickoff was >130
    // minutes ago and FD still hasn't flipped the status.
    if (m.status === "FINISHED") return true;
    const ko = new Date(m.utcDate).getTime();
    return Number.isFinite(ko) && nowMs > ko + 130 * 60_000;
  });

  if (fallbackCandidates.length > 0 && supabase) {
    // Never overwrite an existing usable row (e.g. admin-entered) with fallback
    // data. If this protective read FAILS we must skip the fallback entirely —
    // treating a failed read as "no rows" would let a TSDB row clobber an
    // admin-entered score. The sync is cron-driven; the next run retries.
    const ids = fallbackCandidates.map((m) => String(m.id));
    const { data: existing, error: existingErr } = await supabase
      .from("demo_match_results")
      .select("match_id, home_goals, away_goals")
      .in("match_id", ids);
    const alreadyGood = new Set(
      (existing || [])
        .filter((r) => r.home_goals != null && r.away_goals != null)
        .map((r) => r.match_id)
    );

    const open = existingErr ? [] : fallbackCandidates.filter((m) => !alreadyGood.has(String(m.id)));
    if (open.length > 0) {
      const tsdb = await getTsdbRecentResults();
      for (const m of open) {
        const home = toAppCode(m.homeTeam?.tla);
        const away = toAppCode(m.awayTeam?.tla);
        const date = (m.utcDate || "").slice(0, 10);
        const ev = tsdb.find(
          (e) =>
            e.date === date &&
            ((e.homeCode === home && e.awayCode === away) ||
              (e.homeCode === away && e.awayCode === home))
        );
        if (!ev) continue;
        const flipped = ev.homeCode === away;
        fallbackRows.push({
          match_id: String(m.id),
          stage: "GROUP",
          group_id: normalizeGroupLetter(m.group) || null,
          home_team: home,
          away_team: away,
          home_goals: flipped ? ev.awayGoals : ev.homeGoals,
          away_goals: flipped ? ev.homeGoals : ev.awayGoals,
          home_penalties: null,
          away_penalties: null,
          status: "FINISHED",
          scheduled_at: m.utcDate ?? null,
          entered_by: "thesportsdb-fallback",
          updated_at: new Date().toISOString(),
        });
      }
    }
  }

  const allRows = [...rows, ...fallbackRows];

  // Persist (best-effort).
  let persisted = 0;
  let persistError: string | undefined;
  if (supabase && allRows.length > 0) {
    const { data, error } = await supabase
      .from("demo_match_results")
      .upsert(allRows, { onConflict: "match_id" })
      .select("match_id");
    if (error) persistError = error.message;
    else persisted = data?.length ?? 0;
  }

  // ---- Cards board (the "dirtiest team" tally) ----
  // football-data's free tier has NO bookings, so the card tally is pulled
  // from TheSportsDB match timelines. Board only — the FINAL dirtiest_team
  // answer stays admin-entered (setting it would prematurely finalize the
  // special bet). A null/empty board (source unreachable) is never written.
  // NOTE: this overwrites manual board edits on the next sync by design.
  let cardsSynced = 0;
  if (supabase && finished.length > 0) {
    const { data: tourn } = await supabase
      .from("tournaments")
      .select("id")
      .eq("is_current", true)
      .limit(1)
      .maybeSingle();
    if (tourn?.id) {
      // MAX-merge with the existing board: TheSportsDB undercounts sometimes
      // and admins correct upward — per team we keep the higher of (feed,
      // existing) for each card type, so a manual bump survives the next sync
      // while a catching-up feed still raises the tally. Skip entirely when
      // the protective read fails.
      const { data: actuals, error: actualsErr } = await supabase
        .from("tournament_actuals")
        .select("dirtiest_board")
        .eq("tournament_id", tourn.id)
        .maybeSingle();
      const board = actualsErr ? null : await getTsdbCardBoard();
      if (board && board.length > 0) {
        const existingBoard = new Map(
          ((actuals?.dirtiest_board as { team: string; yellow: number; red: number }[] | null) || [])
            .map((b) => [b.team, b])
        );
        const merged = board.map((b) => {
          const prev = existingBoard.get(b.team);
          existingBoard.delete(b.team);
          return {
            team: b.team,
            yellow: Math.max(b.yellow, prev?.yellow ?? 0),
            red: Math.max(b.red, prev?.red ?? 0),
          };
        });
        // Teams only the admin entered (feed has nothing for them) survive too.
        merged.push(...existingBoard.values());
        merged.sort((a, b) => (b.yellow + b.red * 3) - (a.yellow + a.red * 3));
        const { error: cardsErr } = await supabase
          .from("tournament_actuals")
          .upsert(
            {
              tournament_id: tourn.id,
              dirtiest_board: merged,
              entered_by: "tsdb-cards-sync",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tournament_id" }
          );
        if (!cardsErr) cardsSynced = merged.length;
      }
    }
  }

  return NextResponse.json({
    success: true,
    matchesCount: finished.length,
    persisted,
    pendingScore,
    fallbackUsed: fallbackRows.length,
    cardsSynced,
    ...(persistError ? { persistError } : {}),
    matches: allRows.map((r) => ({
      id: r.match_id,
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      homeGoals: r.home_goals,
      awayGoals: r.away_goals,
      homePenalties: r.home_penalties,
      awayPenalties: r.away_penalties,
      stage: r.stage,
      group: r.group_id,
      date: r.scheduled_at,
      source: r.entered_by,
    })),
  });
}
