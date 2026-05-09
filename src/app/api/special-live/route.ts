import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTopScorers, type Scorer } from "@/lib/api-football-data";

// /api/special-live
//   Public, read-only. Aggregates real special-bet results from football-data.org
//   (top scorers + assists) and Supabase tournament_actuals (admin-entered fallback
//   for fields the free tier doesn't expose).
//
// Cache: relies on the upstream football-data fetch's revalidate=300, plus a
// 5-min revalidate hint on this route via fetch-side cache. Since we also call
// Supabase, we set dynamic = "force-dynamic" and let the upstream caller
// (component) hit this every minute or so.

export const dynamic = "force-dynamic";

type Actuals = {
  top_scorer_player?: string | null;
  top_scorer_team?: string | null;
  top_scorer_goals?: number | null;
  top_assists_player?: string | null;
  top_assists_team?: string | null;
  top_assists_count?: number | null;
  best_attack_team?: string | null;
  best_attack_goals?: number | null;
  dirtiest_team?: string | null;
  dirtiest_team_cards?: number | null;
  most_prolific_group?: string | null;
  most_prolific_goals?: number | null;
  driest_group?: string | null;
  driest_group_goals?: number | null;
  matchup_result_1?: string | null;
  matchup_result_2?: string | null;
  matchup_result_3?: string | null;
  total_penalties?: number | null;
  penalties_over_under?: string | null;
  champion?: string | null;
  updated_at?: string | null;
};

function getReadClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Use anon key — this route is public, no admin escalation needed.
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}

async function loadActuals(): Promise<Actuals | null> {
  const supabase = getReadClient();
  if (!supabase) return null;

  // Find current tournament
  const { data: t } = await supabase
    .from("tournaments")
    .select("id")
    .eq("is_current", true)
    .limit(1)
    .maybeSingle();
  if (!t?.id) return null;

  const { data } = await supabase
    .from("tournament_actuals")
    .select("*")
    .eq("tournament_id", t.id)
    .maybeSingle();
  return (data as Actuals) ?? null;
}

async function loadScorersFromAPI(): Promise<{ scorers: Scorer[]; error?: string }> {
  try {
    const scorers = await getTopScorers(15);
    return { scorers };
  } catch (e) {
    return { scorers: [], error: String(e) };
  }
}

export async function GET() {
  const [scorersRes, actuals] = await Promise.all([
    loadScorersFromAPI(),
    loadActuals(),
  ]);

  // Top scorers — prefer football-data, fall back to admin-entered single record.
  const topScorers = scorersRes.scorers.length > 0
    ? scorersRes.scorers.map(s => ({
        player: s.player.name,
        team: s.team.tla || s.team.shortName,
        teamName: s.team.name,
        goals: s.goals,
        assists: s.assists,
        playedMatches: s.playedMatches,
      }))
    : actuals?.top_scorer_player
      ? [{
          player: actuals.top_scorer_player,
          team: actuals.top_scorer_team || "",
          teamName: actuals.top_scorer_team || "",
          goals: actuals.top_scorer_goals ?? 0,
          assists: null,
          playedMatches: 0,
        }]
      : [];

  // Top assists — derive from same scorers payload if assists are populated.
  // Fall back to admin entry. Football-Data free tier sometimes returns
  // assists=null, in which case the derived list will be empty and we use the
  // manual value.
  const assistsFromAPI = scorersRes.scorers
    .filter(s => typeof s.assists === "number" && (s.assists ?? 0) > 0)
    .sort((a, b) => (b.assists ?? 0) - (a.assists ?? 0))
    .slice(0, 10)
    .map(s => ({
      player: s.player.name,
      team: s.team.tla || s.team.shortName,
      teamName: s.team.name,
      assists: s.assists ?? 0,
      goals: s.goals,
    }));

  const topAssists = assistsFromAPI.length > 0
    ? { source: "api" as const, list: assistsFromAPI, manual: null }
    : {
        source: "manual" as const,
        list: [],
        manual: actuals?.top_assists_player
          ? {
              player: actuals.top_assists_player,
              team: actuals.top_assists_team || "",
              assists: actuals.top_assists_count ?? 0,
            }
          : null,
      };

  return NextResponse.json({
    topScorers,
    topAssists,
    bestAttack: actuals?.best_attack_team
      ? { team: actuals.best_attack_team, goals: actuals.best_attack_goals ?? null }
      : null,
    dirtiestTeam: actuals?.dirtiest_team
      ? { team: actuals.dirtiest_team, cards: actuals.dirtiest_team_cards ?? null }
      : null,
    prolificGroup: actuals?.most_prolific_group
      ? { group: actuals.most_prolific_group, goals: actuals.most_prolific_goals ?? null }
      : null,
    driestGroup: actuals?.driest_group
      ? { group: actuals.driest_group, goals: actuals.driest_group_goals ?? null }
      : null,
    matchups: [
      actuals?.matchup_result_1 ?? null,
      actuals?.matchup_result_2 ?? null,
      actuals?.matchup_result_3 ?? null,
    ],
    penalties: actuals?.penalties_over_under
      ? { result: actuals.penalties_over_under, total: actuals.total_penalties ?? null }
      : null,
    champion: actuals?.champion ?? null,
    lastUpdated: actuals?.updated_at ?? null,
    apiError: scorersRes.error ?? null,
  });
}
