// ============================================================================
// WC2026 — Sync bets to Supabase
// Saves the full betting state to user_brackets table
// ============================================================================

import { createClient } from "@/lib/supabase/client";
import { GROUPS } from "@/lib/tournament/groups";
import { calculateStandings } from "@/lib/tournament/standings";
import type { BettingState } from "@/stores/betting-store";
import type { GroupMatchPrediction } from "@/types";

// Tournament lock deadline: June 10, 2026 17:00 Israel time (14:00 UTC)
const LOCK_DEADLINE = new Date("2026-06-10T14:00:00Z");

/**
 * Derive third place teams from group predictions.
 * Returns array of group letters where the user's 3rd place team might qualify.
 */
function deriveThirdPlaceTeams(state: BettingState): string[] {
  const thirdPlace: string[] = [];
  for (const [groupId, group] of Object.entries(state.groups)) {
    if (group.order && group.order.length >= 3) {
      const teams = GROUPS[groupId];
      if (teams && teams[group.order[2]]) {
        thirdPlace.push(teams[group.order[2]].code);
      }
    }
  }
  return thirdPlace;
}

/**
 * Save the user's bets to Supabase.
 * Uses upsert to create or update.
 * Rejects saves after the lock deadline.
 */
export async function saveBetsToSupabase(
  state: BettingState,
  leagueId?: string
): Promise<{ success: boolean; error?: string }> {
  // Server-side deadline enforcement
  if (new Date() > LOCK_DEADLINE) {
    return { success: false, error: "ההימורים ננעלו — לא ניתן לשנות אחרי 10.06.2026 17:00" };
  }

  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not logged in" };
  }

  // Derive third place qualifiers from group predictions
  const thirdPlaceTeams = deriveThirdPlaceTeams(state);

  // Save to user_brackets
  const bracketData = {
    user_id: user.id,
    league_id: leagueId || "default",
    group_predictions: state.groups,
    third_place_qualifiers: thirdPlaceTeams,
    knockout_tree: state.knockout,
    champion: state.specialBets.winner || null,
    updated_at: new Date().toISOString(),
  };

  const { error: bracketError } = await supabase
    .from("user_brackets")
    .upsert(bracketData, { onConflict: "user_id,league_id" });

  if (bracketError) {
    console.error("Failed to save bracket:", bracketError);
    return { success: false, error: bracketError.message };
  }

  // Save special bets
  const specialData = {
    user_id: user.id,
    league_id: leagueId || "default",
    top_scorer_player: state.specialBets.topScorerPlayer || null,
    top_assists_player: state.specialBets.topAssistsPlayer || null,
    best_attack_team: state.specialBets.bestAttack || null,
    most_prolific_group: state.specialBets.prolificGroup || null,
    driest_group: state.specialBets.driestGroup || null,
    dirtiest_team: state.specialBets.dirtiestTeam || null,
    matchup_pick: state.specialBets.matchups.filter(Boolean).join(",") || null,
    penalties_over_under: state.specialBets.penaltiesOverUnder || null,
  };

  const { error: specialError } = await supabase
    .from("special_bets")
    .upsert(specialData, { onConflict: "user_id,league_id" });

  if (specialError) {
    console.error("Failed to save special bets:", specialError);
    return { success: false, error: specialError.message };
  }

  // Save advancement picks
  const advData = {
    user_id: user.id,
    league_id: leagueId || "default",
    group_qualifiers: {},
    advance_to_qf: state.specialBets.quarterfinalists.filter(Boolean),
    advance_to_sf: state.specialBets.semifinalists.filter(Boolean),
    advance_to_final: [state.specialBets.finalist1, state.specialBets.finalist2].filter(Boolean),
    winner: state.specialBets.winner || "",
  };

  const { error: advError } = await supabase
    .from("advancement_picks")
    .upsert(advData, { onConflict: "user_id,league_id" });

  if (advError) {
    console.error("Failed to save advancement picks:", advError);
    return { success: false, error: advError.message };
  }

  return { success: true };
}

/**
 * Load bets from Supabase for the current user.
 */
export async function loadBetsFromSupabase(
  leagueId?: string
): Promise<{ data: Partial<BettingState> | null; error?: string }> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: "Not logged in" };
  }

  const lid = leagueId || "default";

  // Load bracket
  const { data: bracket } = await supabase
    .from("user_brackets")
    .select("*")
    .eq("user_id", user.id)
    .eq("league_id", lid)
    .single();

  // Load special bets
  const { data: special } = await supabase
    .from("special_bets")
    .select("*")
    .eq("user_id", user.id)
    .eq("league_id", lid)
    .single();

  // Load advancement
  const { data: advancement } = await supabase
    .from("advancement_picks")
    .select("*")
    .eq("user_id", user.id)
    .eq("league_id", lid)
    .single();

  if (!bracket && !special && !advancement) {
    return { data: null };
  }

  return {
    data: {
      groups: bracket?.group_predictions || {},
      knockout: bracket?.knockout_tree || {},
      specialBets: {
        winner: advancement?.winner || "",
        finalist1: advancement?.advance_to_final?.[0] || "",
        finalist2: advancement?.advance_to_final?.[1] || "",
        semifinalists: advancement?.advance_to_sf || ["", "", "", ""],
        quarterfinalists: advancement?.advance_to_qf || ["", "", "", "", "", "", "", ""],
        topScorerTeam: "",
        topScorerPlayer: special?.top_scorer_player || "",
        topAssistsTeam: "",
        topAssistsPlayer: special?.top_assists_player || "",
        bestAttack: special?.best_attack_team || "",
        prolificGroup: special?.most_prolific_group || "",
        driestGroup: special?.driest_group || "",
        dirtiestTeam: special?.dirtiest_team || "",
        matchups: special?.matchup_pick ? special.matchup_pick.split(",").concat(["", "", ""]).slice(0, 3) : ["", "", ""],
        penaltiesOverUnder: special?.penalties_over_under || "",
        mostGoalsMatchStage: "",
        firstRedCardTeam: "",
        youngestScorerTeam: "",
      },
    },
  };
}
