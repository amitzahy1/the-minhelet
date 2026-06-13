// ============================================================================
// WC2026 — Sync bets to Supabase
// Saves the full betting state to user_brackets table
// ============================================================================

import { createClient } from "@/lib/supabase/client";
import { GROUPS } from "@/lib/tournament/groups";
import { calculateStandings } from "@/lib/tournament/standings";
import type { BettingState } from "@/stores/betting-store";
import type { GroupMatchPrediction } from "@/types";

// Production deadline: June 10, 2026 17:00 Israel time (14:00 UTC)
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

  // Resolve league UUID (look up from DB if not provided)
  let resolvedLeagueId = leagueId;
  if (!resolvedLeagueId) {
    const { data: league } = await supabase.from("leagues").select("id").limit(1).single();
    resolvedLeagueId = league?.id;
    if (!resolvedLeagueId) {
      return { success: false, error: "No league found in database" };
    }
  }

  // Derive third place qualifiers from group predictions
  const thirdPlaceTeams = deriveThirdPlaceTeams(state);

  // Derive group qualifiers from group predictions (top 2 per group)
  const groupQualifiers: Record<string, string[]> = {};
  for (const [groupId, group] of Object.entries(state.groups)) {
    if (group.order && group.order.length >= 2 && GROUPS[groupId]) {
      const top2 = group.order
        .slice(0, 2)
        .map((idx: number) => GROUPS[groupId][idx]?.code)
        .filter(Boolean);
      if (top2.length > 0) groupQualifiers[groupId] = top2;
    }
  }

  const bracketsPayload = {
    group_predictions: state.groups,
    third_place_qualifiers: thirdPlaceTeams,
    knockout_tree: state.knockout,
    champion: state.specialBets.winner || null,
  };
  const specialPayload = {
    top_scorer_player: state.specialBets.topScorerPlayer || null,
    top_scorer_team: state.specialBets.topScorerTeam || null,
    top_assists_player: state.specialBets.topAssistsPlayer || null,
    top_assists_team: state.specialBets.topAssistsTeam || null,
    best_attack_team: state.specialBets.bestAttack || null,
    most_prolific_group: state.specialBets.prolificGroup || null,
    driest_group: state.specialBets.driestGroup || null,
    dirtiest_team: state.specialBets.dirtiestTeam || null,
    matchup_pick: state.specialBets.matchups.filter(Boolean).join(",") || null,
    penalties_over_under: state.specialBets.penaltiesOverUnder || null,
  };
  const advancementPayload = {
    group_qualifiers: groupQualifiers,
    advance_to_r16: state.specialBets.roundOf16.filter(Boolean),
    advance_to_qf: state.specialBets.quarterfinalists.filter(Boolean),
    advance_to_sf: state.specialBets.semifinalists.filter(Boolean),
    advance_to_final: [state.specialBets.finalist1, state.specialBets.finalist2].filter(Boolean),
    winner: state.specialBets.winner || "",
  };

  // Atomic save via the save_user_predictions RPC (migration 010). Wraps all
  // three table writes in a single transaction so a network hiccup can never
  // leave the user with a half-saved state (e.g. brackets stored but special
  // bets stale). Falls back to three independent upserts if the RPC isn't
  // available (e.g. against a Supabase instance where migration 010 hasn't
  // been applied yet — useful for local dev).
  const { error: rpcError } = await supabase.rpc("save_user_predictions", {
    p_user_id: user.id,
    p_league_id: resolvedLeagueId,
    p_brackets: bracketsPayload,
    p_special: specialPayload,
    p_advancement: advancementPayload,
    p_lock_deadline: LOCK_DEADLINE.toISOString(),
  });

  // Domain errors from the RPC should surface to the user as-is.
  if (rpcError && /LOCKED/.test(rpcError.message || "")) {
    return { success: false, error: "ההימורים ננעלו — לא ניתן לשנות אחרי 10.06.2026 17:00" };
  }

  // Fall through to the 3-upsert legacy path when the RPC is unavailable for
  // ANY reason — function not installed, PostgREST schema cache stale, or
  // the migration was rolled back. Saves should never fail for the user
  // because of infra plumbing.
  const rpcUnavailable =
    rpcError &&
    (/function .* does not exist/i.test(rpcError.message || "") ||
      /in the schema cache/i.test(rpcError.message || "") ||
      /could not find the function/i.test(rpcError.message || ""));

  if (rpcError && !rpcUnavailable) {
    console.error("Failed atomic save (non-recoverable):", rpcError);
    return { success: false, error: rpcError.message };
  }

  if (rpcUnavailable) {
    // Legacy 3-upsert path — also handles a stale PostgREST cache so the
    // user never sees the "schema cache" red error.
    const { error: bracketError } = await supabase
      .from("user_brackets")
      .upsert(
        { user_id: user.id, league_id: resolvedLeagueId, ...bracketsPayload, updated_at: new Date().toISOString() },
        { onConflict: "user_id,league_id" },
      );
    if (bracketError) return { success: false, error: bracketError.message };

    const { error: specialError } = await supabase
      .from("special_bets")
      .upsert({ user_id: user.id, league_id: resolvedLeagueId, ...specialPayload }, { onConflict: "user_id,league_id" });
    if (specialError) return { success: false, error: specialError.message };

    const { error: advError } = await supabase
      .from("advancement_picks")
      .upsert({ user_id: user.id, league_id: resolvedLeagueId, ...advancementPayload }, { onConflict: "user_id,league_id" });
    if (advError) return { success: false, error: advError.message };
  }

  return { success: true };
}

/**
 * Load bets from Supabase for the current user.
 */
export async function loadBetsFromSupabase(
  leagueId?: string
): Promise<{ data: Partial<BettingState> | null; error?: string; serverUpdatedAt?: string }> {
  const supabase = createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { data: null, error: "Not logged in" };
  }

  // Resolve league UUID
  let lid = leagueId;
  if (!lid) {
    const { data: league } = await supabase.from("leagues").select("id").limit(1).single();
    lid = league?.id || "";
  }
  if (!lid) return { data: null, error: "No league found" };

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
    serverUpdatedAt: bracket?.updated_at ?? undefined,
    data: {
      groups: bracket?.group_predictions || {},
      knockout: bracket?.knockout_tree || {},
      knockoutLive: bracket?.knockout_tree_live || {},
      specialBets: {
        winner: advancement?.winner || "",
        finalist1: advancement?.advance_to_final?.[0] || "",
        finalist2: advancement?.advance_to_final?.[1] || "",
        // Always pad back to the expected slot count. We save with
        // .filter(Boolean) which collapses the array (so a 2-of-4 pick is
        // stored as a 2-element list). Without this guard, .map() in
        // special-bets/page.tsx renders fewer TeamSelects than expected and
        // the "עולות לחצי גמר" / "עולות לרבע גמר" cards appear empty.
        semifinalists: Array.from({ length: 4 }, (_, i) => advancement?.advance_to_sf?.[i] ?? ""),
        quarterfinalists: Array.from({ length: 8 }, (_, i) => advancement?.advance_to_qf?.[i] ?? ""),
        roundOf16: Array.from({ length: 16 }, (_, i) => advancement?.advance_to_r16?.[i] ?? ""),
        topScorerTeam: special?.top_scorer_team || "",
        topScorerPlayer: special?.top_scorer_player || "",
        topAssistsTeam: special?.top_assists_team || "",
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

// ── Tree 2 (real-data knockout) — per-match save ───────────────────────────

export interface LiveKnockoutSlot {
  score1: number | null;
  score2: number | null;
  winner: string | null;
}

/**
 * Save ONE Tree-2 (real-data) knockout slot prediction. Unlike the June-10
 * global lock used by saveBetsToSupabase, Tree 2 has a PER-MATCH lock: a slot
 * is editable until 30 minutes before its real match kicks off.`lockAtISO` is
 * derived by the caller from /api/matches via resolveKnockoutTree/findKickoffForSlot
 * (kickoff − match_prediction_lock_before_minutes). The server re-validates.
 *
 * Uses the save_live_knockout RPC (migration 020), which JSONB-merges the one
 * slot so concurrent per-match saves never clobber each other. Falls back to a
 * read-merge-write upsert when the RPC isn't installed (local dev only).
 */
export async function saveLiveKnockout(
  slotKey: string,
  slot: LiveKnockoutSlot,
  lockAtISO: string | null,
  leagueId?: string,
): Promise<{ success: boolean; error?: string }> {
  // Client-side guard for instant feedback — FAIL CLOSED: an unknown lock means
  // the slot isn't open for editing. The server (save_live_knockout) is now the
  // authority: it reads the lock from prediction_locks and ignores p_lock_at.
  if (!lockAtISO) {
    return { success: false, error: "המשחק עדיין לא פתוח לעריכה" };
  }
  if (new Date() > new Date(lockAtISO)) {
    return { success: false, error: "המשחק ננעל — לא ניתן לעדכן (פחות מחצי שעה לפתיחה)" };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in" };

  let lid = leagueId;
  if (!lid) {
    const { data: league } = await supabase.from("leagues").select("id").limit(1).single();
    lid = league?.id;
    if (!lid) return { success: false, error: "No league found in database" };
  }

  const { error: rpcError } = await supabase.rpc("save_live_knockout", {
    p_user_id: user.id,
    p_league_id: lid,
    p_slot_key: slotKey,
    p_slot: slot,
    p_lock_at: null, // server reads the authoritative lock; this is ignored
  });

  if (rpcError && /LOCKED/.test(rpcError.message || "")) {
    return { success: false, error: "המשחק ננעל — לא ניתן לעדכן (פחות מחצי שעה לפתיחה)" };
  }

  const rpcUnavailable =
    rpcError &&
    (/function .* does not exist/i.test(rpcError.message || "") ||
      /in the schema cache/i.test(rpcError.message || "") ||
      /could not find the function/i.test(rpcError.message || ""));

  if (rpcError && !rpcUnavailable) {
    console.error("Failed to save live knockout slot:", rpcError);
    return { success: false, error: rpcError.message };
  }

  if (rpcUnavailable) {
    // Read-merge-write fallback (NOT atomic vs concurrent edits — only used
    // when the RPC isn't installed, i.e. local dev).
    const { data: row } = await supabase
      .from("user_brackets")
      .select("knockout_tree_live")
      .eq("user_id", user.id)
      .eq("league_id", lid)
      .single();
    const merged = { ...(row?.knockout_tree_live || {}), [slotKey]: slot };
    const { error } = await supabase
      .from("user_brackets")
      .upsert(
        { user_id: user.id, league_id: lid, knockout_tree_live: merged, updated_at: new Date().toISOString() },
        { onConflict: "user_id,league_id" },
      );
    if (error) return { success: false, error: error.message };
  }

  return { success: true };
}

// ── Group-stage scores — live (during-tournament) per-match-day save ─────────

export interface LiveGroupScore {
  home: number | null;
  away: number | null;
}

/**
 * Save ONE group-stage score prediction DURING the tournament. Unlike the
 * June-10 global lock used by saveBetsToSupabase, this has a PER-MATCH-DAY lock:
 * a score is editable until 30 minutes before its match-day's FIRST kickoff.
 * `lockAtISO` is derived by the caller from /api/matches via group-live-state
 * (dayLockAtForKickoff). The server (save_live_group_score, migration 023)
 * re-validates and updates ONLY group_predictions[group].scores[pairIdx] in
 * place — the frozen `order` / advancement picks are never touched.
 *
 * Falls back to a read-merge-write update when the RPC isn't installed (local
 * dev only); the fallback likewise mutates only the one score, preserving order.
 */
export async function saveLiveGroupScore(
  group: string,
  pairIdx: number,
  score: LiveGroupScore,
  lockAtISO: string | null,
  leagueId?: string,
): Promise<{ success: boolean; error?: string }> {
  // Client-side guard for instant feedback — FAIL CLOSED: an unknown lock (e.g.
  // the schedule hasn't loaded) blocks the save rather than letting it through.
  // The server (save_live_group_score) is the authority: it reads the lock from
  // prediction_locks and ignores p_lock_at.
  if (!lockAtISO) {
    return { success: false, error: "זמני הנעילה עדיין נטענים — נסו שוב בעוד רגע" };
  }
  if (new Date() > new Date(lockAtISO)) {
    return { success: false, error: "יום המשחקים ננעל — לא ניתן לעדכן תוצאות" };
  }

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Not logged in" };

  let lid = leagueId;
  if (!lid) {
    const { data: league } = await supabase.from("leagues").select("id").limit(1).single();
    lid = league?.id;
    if (!lid) return { success: false, error: "No league found in database" };
  }

  const { error: rpcError } = await supabase.rpc("save_live_group_score", {
    p_user_id: user.id,
    p_league_id: lid,
    p_group: group,
    p_pair_idx: pairIdx,
    p_score: score,
    p_lock_at: null, // server reads the authoritative lock; this is ignored
  });

  if (rpcError && /LOCKED/.test(rpcError.message || "")) {
    return { success: false, error: "יום המשחקים ננעל — לא ניתן לעדכן תוצאות" };
  }

  const rpcUnavailable =
    rpcError &&
    (/function .* does not exist/i.test(rpcError.message || "") ||
      /in the schema cache/i.test(rpcError.message || "") ||
      /could not find the function/i.test(rpcError.message || ""));

  if (rpcError && !rpcUnavailable) {
    console.error("Failed to save live group score:", rpcError);
    return { success: false, error: rpcError.message };
  }

  if (rpcUnavailable) {
    // Read-merge-write fallback (NOT atomic vs concurrent edits — only used
    // when the RPC isn't installed, i.e. local dev). Mutates only this score.
    const { data: row } = await supabase
      .from("user_brackets")
      .select("group_predictions")
      .eq("user_id", user.id)
      .eq("league_id", lid)
      .single();
    const gp = (row?.group_predictions || {}) as Record<
      string,
      { order?: number[]; scores?: LiveGroupScore[] }
    >;
    const grp = gp[group];
    if (!grp || !Array.isArray(grp.scores) || grp.scores.length <= pairIdx) {
      return { success: false, error: "No frozen group prediction to update" };
    }
    grp.scores[pairIdx] = score;
    const { error } = await supabase
      .from("user_brackets")
      .update({ group_predictions: gp, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .eq("league_id", lid);
    if (error) return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Read the authoritative SAVED value for one group/pair from the server. Used
 * to revert the optimistic local value when a live save fails (e.g. the match
 * day locked), so a bettor never keeps an on-screen score that didn't persist
 * — the bug that left Yoni's browser showing QAT 0-2 SUI while the DB held 1-1.
 */
export async function fetchSavedGroupScore(
  group: string,
  pairIdx: number,
  leagueId?: string,
): Promise<{ home: number | null; away: number | null } | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    let lid = leagueId;
    if (!lid) {
      const { data: league } = await supabase.from("leagues").select("id").limit(1).single();
      lid = league?.id;
    }
    if (!lid) return null;
    const { data: row } = await supabase
      .from("user_brackets")
      .select("group_predictions")
      .eq("user_id", user.id)
      .eq("league_id", lid)
      .single();
    const gp = row?.group_predictions as Record<string, { scores?: { home: number | null; away: number | null }[] }> | undefined;
    const sc = gp?.[group]?.scores?.[pairIdx];
    return sc && typeof sc === "object" ? { home: sc.home ?? null, away: sc.away ?? null } : null;
  } catch {
    return null;
  }
}
