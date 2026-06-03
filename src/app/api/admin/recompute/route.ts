// ============================================================================
// /api/admin/recompute
//
// Admin-only kill switch for scoring bugs. Loads every user's brackets +
// advancement + special bets, the full match list, and the live tournament
// stats, then runs the same scoring pipeline the client renders with and
// persists the result into `scoring_snapshots` (one row per user).
//
// Use cases:
//   * Verify the live render matches a known-good baseline.
//   * After a result correction, snapshot the new authoritative scores.
//   * After a scoring-config change, regenerate the official record.
// ============================================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";
import { logAdminAction } from "@/lib/audit";
import {
  computeLiveScores,
  type PlayerScore,
} from "@/lib/scoring/live-scorer";
import { normalizeGroupLetter, type FinishedMatch } from "@/lib/results-hits";
import type { BettorBracket, BettorAdvancement, BettorSpecialBets } from "@/lib/supabase/shared-data";
import type { TournamentActuals, PlayerStat } from "@/lib/scoring/special-bets-scorer";
import { scoringFromConfig, SCORING_CONFIG_COLUMNS, type ScoringConfigRow } from "@/lib/scoring/config";
import { getTournamentStats } from "@/lib/tournament-stats";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey);
}

interface FdMatch {
  id: number;
  utcDate: string;
  homeTeam?: { tla?: string };
  awayTeam?: { tla?: string };
  group?: string;
  stage?: string;
  status?: string;
  score?: { fullTime?: { home?: number; away?: number } };
}

async function loadFinishedMatches(): Promise<FinishedMatch[]> {
  // Re-use Football-Data.org as the source of truth (same as /api/matches),
  // overlay demo_match_results for admin-entered scores.
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) return [];
  const supabase = getAdminClient();

  const [fdResult, demoResult] = await Promise.all([
    fetch("https://api.football-data.org/v4/competitions/WC/matches?season=2026", {
      headers: { "X-Auth-Token": token },
      next: { revalidate: 60 },
    })
      .then((r) => (r.ok ? r.json() : { matches: [] }))
      .catch(() => ({ matches: [] })),
    supabase
      ? supabase.from("demo_match_results").select("*").then((r) => r.data || [])
      : Promise.resolve([]),
  ]);

  type DemoRow = {
    match_id: string;
    home_team: string | null;
    away_team: string | null;
    home_goals: number | null;
    away_goals: number | null;
    status?: string;
    scheduled_at?: string | null;
  };
  const demoById = new Map<string, DemoRow>(
    ((demoResult as DemoRow[]) || []).map((r) => [r.match_id, r]),
  );

  const finished: FinishedMatch[] = [];
  for (const m of (fdResult.matches || []) as FdMatch[]) {
    const demo = demoById.get(String(m.id));
    const status = demo?.status ?? m.status;
    if (status !== "FINISHED") continue;
    const homeGoals = demo?.home_goals ?? m.score?.fullTime?.home;
    const awayGoals = demo?.away_goals ?? m.score?.fullTime?.away;
    if (homeGoals == null || awayGoals == null) continue;
    finished.push({
      id: m.id,
      date: m.utcDate,
      homeTla: (m.homeTeam?.tla || demo?.home_team || "").toUpperCase(),
      awayTla: (m.awayTeam?.tla || demo?.away_team || "").toUpperCase(),
      group: normalizeGroupLetter(m.group),
      stage: m.stage || "GROUP_STAGE",
      homeGoals,
      awayGoals,
    });
  }
  return finished;
}

export async function POST() {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const supabase = getAdminClient();
  if (!supabase) return NextResponse.json({ error: "Missing server config" }, { status: 500 });

  // Resolve current league.
  const { data: league } = await supabase.from("leagues").select("id").limit(1).single();
  const leagueId = league?.id;
  if (!leagueId) return NextResponse.json({ error: "No league found" }, { status: 500 });

  // Pull all data sources in parallel.
  const [profilesRes, bracketsRes, specialRes, advRes, scoringCfgRes, stats, finished] = await Promise.all([
    supabase.from("profiles").select("id, display_name"),
    supabase.from("user_brackets").select("user_id, group_predictions, knockout_tree, knockout_tree_live, champion, locked_at").eq("league_id", leagueId),
    supabase.from("special_bets").select("user_id, top_scorer_player, top_assists_player, best_attack_team, most_prolific_group, driest_group, dirtiest_team, matchup_pick, penalties_over_under").eq("league_id", leagueId),
    supabase.from("advancement_picks").select("*").eq("league_id", leagueId),
    supabase.from("scoring_config").select(SCORING_CONFIG_COLUMNS).limit(1).maybeSingle(),
    getTournamentStats(),
    loadFinishedMatches(),
  ]);
  if (profilesRes.error) return NextResponse.json({ error: profilesRes.error.message }, { status: 500 });

  // Resolve scoring point values from the admin-editable config (falls back to
  // the built-in SCORING constant if the row/columns aren't present).
  const scoring = scoringFromConfig(scoringCfgRes.data as Partial<ScoringConfigRow> | null);

  const nameById: Record<string, string> = {};
  for (const p of (profilesRes.data || []) as { id: string; display_name: string }[]) nameById[p.id] = p.display_name;

  const brackets: BettorBracket[] = ((bracketsRes.data || []) as Array<{
    user_id: string; group_predictions: unknown; knockout_tree: unknown; knockout_tree_live: unknown; champion: string | null; locked_at: string | null;
  }>).map((r) => ({
    userId: r.user_id,
    displayName: nameById[r.user_id] || "",
    groupPredictions: (r.group_predictions || {}) as BettorBracket["groupPredictions"],
    knockoutTree: (r.knockout_tree || {}) as BettorBracket["knockoutTree"],
    knockoutTreeLive: (r.knockout_tree_live || {}) as BettorBracket["knockoutTreeLive"],
    champion: r.champion,
    lockedAt: r.locked_at,
  }));
  const specialBets: BettorSpecialBets[] = ((specialRes.data || []) as Array<Record<string, unknown>>).map((r) => ({
    userId: r.user_id as string,
    displayName: nameById[r.user_id as string] || "",
    topScorerTeam: (r.top_scorer_team as string) ?? null,
    topScorerPlayer: (r.top_scorer_player as string) ?? null,
    topAssistsTeam: (r.top_assists_team as string) ?? null,
    topAssistsPlayer: (r.top_assists_player as string) ?? null,
    bestAttackTeam: (r.best_attack_team as string) ?? null,
    prolificGroup: (r.most_prolific_group as string) ?? null,
    driestGroup: (r.driest_group as string) ?? null,
    dirtiestTeam: (r.dirtiest_team as string) ?? null,
    matchupPick: (r.matchup_pick as string) ?? null,
    penaltiesOverUnder: (r.penalties_over_under as string) ?? null,
  }));
  const advancements: BettorAdvancement[] = ((advRes.data || []) as Array<Record<string, unknown>>).map((r) => ({
    userId: r.user_id as string,
    displayName: nameById[r.user_id as string] || "",
    groupQualifiers: (r.group_qualifiers || {}) as Record<string, string[]>,
    advanceToR16: (r.advance_to_r16 || []) as string[],
    advanceToQF: (r.advance_to_qf || []) as string[],
    advanceToSF: (r.advance_to_sf || []) as string[],
    advanceToFinal: (r.advance_to_final || []) as string[],
    winner: (r.winner as string) || "",
  }));

  const tournamentActuals: TournamentActuals | null = stats?.actuals
    ? {
        top_scorer_player: stats.actuals.top_scorer_player,
        top_assists_player: stats.actuals.top_assists_player,
        best_attack_team: stats.actuals.best_attack_team,
        most_prolific_group: stats.actuals.most_prolific_group,
        driest_group: stats.actuals.driest_group,
        dirtiest_team: stats.actuals.dirtiest_team,
        matchup_result_1: stats.actuals.matchup_result_1 ?? null,
        matchup_result_2: stats.actuals.matchup_result_2 ?? null,
        matchup_result_3: stats.actuals.matchup_result_3 ?? null,
        penalties_over_under: stats.actuals.penalties_over_under,
      }
    : null;
  const playerStats: PlayerStat[] = (stats?.scorers || []).map((s) => ({
    name: s.name,
    goals: s.goals ?? 0,
    assists: s.assists ?? 0,
    minutes: s.played ?? 0,
  }));

  const scores = computeLiveScores(brackets, finished, {
    advancements,
    specialBets,
    tournamentActuals,
    playerStats,
    scoring,
  });

  // Persist each user's score as a snapshot.
  const rows = Object.values(scores).map((s: PlayerScore) => ({
    user_id: s.userId,
    league_id: leagueId,
    total: s.total,
    match_pts: s.matchPts,
    adv_pts: s.advPts,
    spec_pts: s.specPts,
    breakdown: {
      totoGroup: s.totoGroup, exactGroup: s.exactGroup,
      totoKnockout: s.totoKnockout, exactKnockout: s.exactKnockout,
      advBreakdown: s.advBreakdown, specBreakdown: s.specBreakdown,
    },
    has_interim: s.specHasInterim,
    source: adminEmail,
  }));

  if (rows.length > 0) {
    const { error } = await supabase.from("scoring_snapshots").insert(rows);
    if (error) {
      console.error("Failed to insert scoring snapshots:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  await logAdminAction(adminEmail, "recompute_scores", { users: rows.length });

  return NextResponse.json({ ok: true, users: rows.length, snapshotAt: new Date().toISOString() });
}
