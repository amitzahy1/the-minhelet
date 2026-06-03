// ============================================================================
// Canonical per-team player picklist.
//
// Single source of truth for "which players can be chosen as top scorer /
// top assists". Used by BOTH the bettor special-bets picker and the admin
// results-entry screen, so the name the admin records is guaranteed to match
// the name a bettor picked — otherwise exact-name scoring (bets.topScorerPlayer
// === actuals.top_scorer_player) silently fails.
//
// Source priority (most complete first):
//   1. OFFICIAL_ROSTERS — Wikipedia 26-man squad (full names), once announced.
//   2. squads-api.json — api-football current call-up (~25-35 names).
//   3. getSquad().players — hand-curated starters subset (fallback).
// ============================================================================

import { getSquad } from "@/lib/tournament/squads-data";
import apiSquads from "@/lib/tournament/squads-api.json";
import { OFFICIAL_ROSTERS } from "@/lib/tournament/official-rosters";

// Attackers first (FW → MID → DEF → GK); within a position, keep squad order —
// top-scorer/assists candidates sit at the top of the list.
const POS_ORDER: Record<string, number> = { FW: 0, MID: 1, DEF: 2, GK: 3 };

type ApiSquads = Record<string, { players: { nameEn: string; pos: "GK" | "DEF" | "MID" | "FW" }[] }>;
const API_SQUADS = apiSquads as ApiSquads;

/** Players for `team` (3-letter code), in display order. Empty if no squad data. */
export function getSquadPlayers(team: string): string[] {
  const official = OFFICIAL_ROSTERS[team] || [];
  if (official.length >= 20) {
    return [...official]
      .sort((a, b) => (POS_ORDER[a.pos] ?? 99) - (POS_ORDER[b.pos] ?? 99))
      .map((p) => p.nameEn);
  }
  const apiList = API_SQUADS[team]?.players || [];
  if (apiList.length >= 15) {
    return [...apiList]
      .sort((a, b) => (POS_ORDER[a.pos] ?? 99) - (POS_ORDER[b.pos] ?? 99))
      .map((p) => p.nameEn);
  }
  const squad = getSquad(team);
  if (!squad) return [];
  return [...squad.players]
    .sort((a, b) => (POS_ORDER[a.pos] ?? 99) - (POS_ORDER[b.pos] ?? 99))
    .map((p) => p.nameEn);
}
