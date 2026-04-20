// ============================================================================
// WC2026 — Shared Data Loader
// Fetches all users' bets from Supabase for social pages
// (standings, compare, live, schedule)
// ============================================================================

import { createClient } from "@/lib/supabase/client";
import { isLocked } from "@/lib/constants";

// --- Types ---

export interface BettorProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface BettorBracket {
  userId: string;
  displayName: string;
  groupPredictions: Record<string, { order: number[]; scores: { home: number | null; away: number | null }[] }>;
  knockoutTree: Record<string, { score1: number | null; score2: number | null; winner: string | null }>;
  champion: string | null;
  lockedAt: string | null;
}

export interface BettorSpecialBets {
  userId: string;
  displayName: string;
  topScorerTeam: string | null;
  topScorerPlayer: string | null;
  topAssistsTeam: string | null;
  topAssistsPlayer: string | null;
  bestAttackTeam: string | null;
  prolificGroup: string | null;
  driestGroup: string | null;
  dirtiestTeam: string | null;
  matchupPick: string | null;
  penaltiesOverUnder: string | null;
}

export interface BettorAdvancement {
  userId: string;
  displayName: string;
  groupQualifiers: Record<string, string[]>;
  advanceToQF: string[];
  advanceToSF: string[];
  advanceToFinal: string[];
  winner: string;
}

export interface MatchPrediction {
  userId: string;
  displayName: string;
  matchId: number;
  predictedHomeGoals: number;
  predictedAwayGoals: number;
  pointsEarned: number;
}

export interface ScoringEntry {
  userId: string;
  matchId: number | null;
  points: number;
  reason: string;
  createdAt: string;
}

// --- Loaders ---

/** Read the locally-hidden user id list (same source UserManagement writes to). */
function getHiddenUserIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("wc2026-hidden-users") || "[]";
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

// Dynamically resolve the first available league UUID (cached after first call)
let _leagueIdCache: string | null = null;
async function getLeagueId(): Promise<string> {
  if (_leagueIdCache) return _leagueIdCache;
  const supabase = createClient();
  const { data } = await supabase.from("leagues").select("id").limit(1).single();
  const id: string = data?.id || "";
  _leagueIdCache = id;
  return id;
}

/**
 * Get all user profiles (visible bettors)
 */
export async function loadAllProfiles(): Promise<BettorProfile[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .order("display_name");

  if (error) {
    console.error("Failed to load profiles:", error);
    return [];
  }

  // Filter hidden users
  const hidden = getHiddenUserIds();

  return (data || [])
    .filter((p) => !hidden.has(p.id))
    .map((p) => ({
      id: p.id,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
    }));
}

/**
 * Get all users' brackets (group predictions + knockout tree)
 */
export async function loadAllBrackets(): Promise<BettorBracket[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_brackets")
    .select("user_id, group_predictions, knockout_tree, champion, locked_at, profiles(display_name)")
    .eq("league_id", await getLeagueId());

  if (error) {
    console.error("Failed to load brackets:", error);
    return [];
  }

  const hidden = getHiddenUserIds();
  return (data || [])
    .filter((d) => !hidden.has(d.user_id))
    .map((d) => ({
      userId: d.user_id,
      displayName: (d.profiles as unknown as { display_name: string })?.display_name || "",
      groupPredictions: d.group_predictions || {},
      knockoutTree: d.knockout_tree || {},
      champion: d.champion,
      lockedAt: d.locked_at,
    }));
}

/**
 * Get all users' special bets
 */
export async function loadAllSpecialBets(): Promise<BettorSpecialBets[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("special_bets")
    .select("user_id, top_scorer_player, top_assists_player, best_attack_team, most_prolific_group, driest_group, dirtiest_team, matchup_pick, penalties_over_under, profiles(display_name)")
    .eq("league_id", await getLeagueId());

  if (error) {
    console.error("Failed to load special bets:", error);
    return [];
  }

  const hidden = getHiddenUserIds();
  return (data || [])
    .filter((d) => !hidden.has(d.user_id))
    .map((d) => ({
    userId: d.user_id,
    displayName: (d.profiles as unknown as { display_name: string })?.display_name || "",
    topScorerTeam: (d as Record<string, unknown>).top_scorer_team as string ?? null,
    topScorerPlayer: d.top_scorer_player,
    topAssistsTeam: (d as Record<string, unknown>).top_assists_team as string ?? null,
    topAssistsPlayer: d.top_assists_player,
    bestAttackTeam: d.best_attack_team,
    prolificGroup: d.most_prolific_group,
    driestGroup: d.driest_group,
    dirtiestTeam: d.dirtiest_team,
    matchupPick: d.matchup_pick,
    penaltiesOverUnder: d.penalties_over_under,
  }));
}

/**
 * Get all users' advancement picks
 */
export async function loadAllAdvancements(): Promise<BettorAdvancement[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("advancement_picks")
    .select("user_id, group_qualifiers, advance_to_qf, advance_to_sf, advance_to_final, winner, profiles(display_name)")
    .eq("league_id", await getLeagueId());

  if (error) {
    console.error("Failed to load advancements:", error);
    return [];
  }

  const hidden = getHiddenUserIds();
  return (data || [])
    .filter((d) => !hidden.has(d.user_id))
    .map((d) => ({
      userId: d.user_id,
      displayName: (d.profiles as unknown as { display_name: string })?.display_name || "",
      groupQualifiers: d.group_qualifiers || {},
      advanceToQF: d.advance_to_qf || [],
      advanceToSF: d.advance_to_sf || [],
      advanceToFinal: d.advance_to_final || [],
      winner: d.winner || "",
    }));
}

/**
 * Get all match predictions for a specific match
 */
export async function loadMatchPredictions(matchId: number): Promise<MatchPrediction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("match_predictions")
    .select("user_id, match_id, predicted_home_goals, predicted_away_goals, points_earned, profiles(display_name)")
    .eq("match_id", matchId)
    .eq("league_id", await getLeagueId());

  if (error) {
    console.error("Failed to load match predictions:", error);
    return [];
  }

  return (data || []).map((d) => ({
    userId: d.user_id,
    displayName: (d.profiles as unknown as { display_name: string })?.display_name || "",
    matchId: d.match_id,
    predictedHomeGoals: d.predicted_home_goals,
    predictedAwayGoals: d.predicted_away_goals,
    pointsEarned: d.points_earned,
  }));
}

/**
 * Get all match predictions for all users (for schedule page)
 */
export async function loadAllMatchPredictions(): Promise<MatchPrediction[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("match_predictions")
    .select("user_id, match_id, predicted_home_goals, predicted_away_goals, points_earned, profiles(display_name)")
    .eq("league_id", await getLeagueId());

  if (error) {
    console.error("Failed to load all match predictions:", error);
    return [];
  }

  const hidden = getHiddenUserIds();
  return (data || [])
    .filter((d) => !hidden.has(d.user_id))
    .map((d) => ({
      userId: d.user_id,
      displayName: (d.profiles as unknown as { display_name: string })?.display_name || "",
      matchId: d.match_id,
      predictedHomeGoals: d.predicted_home_goals,
      predictedAwayGoals: d.predicted_away_goals,
      pointsEarned: d.points_earned,
    }));
}

/**
 * Get scoring log for all users (for standings)
 */
export async function loadScoringLog(): Promise<ScoringEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("scoring_log")
    .select("user_id, match_id, points, reason, created_at")
    .eq("league_id", await getLeagueId())
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load scoring log:", error);
    return [];
  }

  return (data || []).map((d) => ({
    userId: d.user_id,
    matchId: d.match_id,
    points: d.points,
    reason: d.reason,
    createdAt: d.created_at,
  }));
}

/**
 * Load everything at once for pages that need all data (compare, standings)
 */
export async function loadAllSharedData() {
  const [profiles, brackets, specialBets, advancements] = await Promise.all([
    loadAllProfiles(),
    loadAllBrackets(),
    loadAllSpecialBets(),
    loadAllAdvancements(),
  ]);

  return { profiles, brackets, specialBets, advancements };
}

/**
 * After lock: load all bets via server API (bypasses RLS).
 * Returns brackets, specialBets, advancements, and currentUserId.
 */
export async function loadAllBetsViaServer(): Promise<{
  currentUserId: string;
  brackets: BettorBracket[];
  specialBets: BettorSpecialBets[];
  advancements: BettorAdvancement[];
} | null> {
  if (!isLocked()) return null;

  try {
    const res = await fetch("/api/shared-bets");
    if (!res.ok) return null;
    const json = await res.json();

    const hidden = getHiddenUserIds();
    const brackets: BettorBracket[] = (json.brackets || [])
      .filter((d: Record<string, unknown>) => !hidden.has(d.user_id as string))
      .map((d: Record<string, unknown>) => ({
        userId: d.user_id,
        displayName: ((d.profiles as { display_name: string } | null)?.display_name) || "",
        groupPredictions: d.group_predictions || {},
        knockoutTree: d.knockout_tree || {},
        champion: d.champion,
        lockedAt: d.locked_at,
      }));

    const specialBets: BettorSpecialBets[] = (json.specialBets || [])
      .filter((d: Record<string, unknown>) => !hidden.has(d.user_id as string))
      .map((d: Record<string, unknown>) => ({
        userId: d.user_id,
        displayName: ((d.profiles as { display_name: string } | null)?.display_name) || "",
        topScorerTeam: d.top_scorer_team ?? null,
        topScorerPlayer: d.top_scorer_player,
        topAssistsTeam: d.top_assists_team ?? null,
        topAssistsPlayer: d.top_assists_player,
        bestAttackTeam: d.best_attack_team,
        prolificGroup: d.most_prolific_group,
        driestGroup: d.driest_group,
        dirtiestTeam: d.dirtiest_team,
        matchupPick: d.matchup_pick,
        penaltiesOverUnder: d.penalties_over_under,
      }));

    const advancements: BettorAdvancement[] = (json.advancements || [])
      .filter((d: Record<string, unknown>) => !hidden.has(d.user_id as string))
      .map((d: Record<string, unknown>) => ({
        userId: d.user_id,
        displayName: ((d.profiles as { display_name: string } | null)?.display_name) || "",
        groupQualifiers: d.group_qualifiers || {},
        advanceToQF: d.advance_to_qf || [],
        advanceToSF: d.advance_to_sf || [],
        advanceToFinal: d.advance_to_final || [],
        winner: d.winner || "",
      }));

    return {
      currentUserId: json.currentUserId,
      brackets,
      specialBets,
      advancements,
    };
  } catch (e) {
    console.error("Failed to load bets via server:", e);
    return null;
  }
}
