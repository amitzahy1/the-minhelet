// ============================================================================
// WC2026 — Demo data for the Special-Bets Tracker (DEV PREVIEW ONLY)
//
// Used by <SpecialTrackerView> when the page is opened with ?demo=1 AND the app
// is NOT in production (see the isDemo guard in SpecialTrackerView.tsx). Lets us
// preview the full design — leaders, decided results, and per-bettor hit / race
// badges — before any real tournament data exists. Never written to any DB.
// ============================================================================

import type { TournamentStatsPayload, TournamentActuals } from "@/lib/tournament-stats";
import type { BettorLike } from "./SpecialTrackerView";

const ACTUALS: TournamentActuals = {
  // Player races left OPEN (null) so the scorer/assists cards show the live
  // leaderboard + leading/on-track/behind badges rather than a final verdict.
  top_scorer_player: null,
  top_scorer_team: null,
  top_scorer_goals: null,
  top_assists_player: null,
  top_assists_team: null,
  top_assists_count: null,
  // The rest are DECIDED so those cards show hit / miss badges.
  best_attack_team: "BRA",
  best_attack_goals: 14,
  dirtiest_team: "ARG",
  dirtiest_team_cards: 14,
  most_prolific_group: "C",
  most_prolific_goals: 14,
  driest_group: "H",
  driest_group_goals: 5,
  matchup_result_1: "1",
  matchup_result_2: "2",
  matchup_result_3: "X",
  total_penalties: 12,
  penalties_over_under: "UNDER", // 12 < 21.5
  champion: "BRA",
};

export const DEMO_STATS: TournamentStatsPayload = {
  scorers: [
    { name: "Kylian Mbappé", team: "FRA", goals: 7, assists: 2, played: 6 },
    { name: "Julián Álvarez", team: "ARG", goals: 5, assists: 3, played: 6 },
    { name: "Vinícius Jr", team: "BRA", goals: 5, assists: 2, played: 6 },
    { name: "Harry Kane", team: "ENG", goals: 4, assists: 1, played: 5 },
    { name: "Lamine Yamal", team: "ESP", goals: 4, assists: 5, played: 6 },
    { name: "Cristiano Ronaldo", team: "POR", goals: 3, assists: 0, played: 5 },
  ],
  assistsLeaders: [
    { name: "Lamine Yamal", team: "ESP", goals: 4, assists: 5, played: 6 },
    { name: "Kevin De Bruyne", team: "BEL", goals: 1, assists: 4, played: 5 },
    { name: "Bruno Fernandes", team: "POR", goals: 2, assists: 4, played: 5 },
    { name: "Rodrygo", team: "BRA", goals: 2, assists: 3, played: 6 },
    { name: "Jude Bellingham", team: "ENG", goals: 2, assists: 3, played: 5 },
  ],
  teamStats: [
    { code: "BRA", goalsFor: 14, goalsAgainst: 4, yellowCards: 8, redCards: 0, played: 6 },
    { code: "FRA", goalsFor: 12, goalsAgainst: 6, yellowCards: 10, redCards: 1, played: 6 },
    { code: "ESP", goalsFor: 11, goalsAgainst: 5, yellowCards: 6, redCards: 0, played: 6 },
    { code: "ARG", goalsFor: 10, goalsAgainst: 5, yellowCards: 12, redCards: 1, played: 6 },
    { code: "ENG", goalsFor: 9, goalsAgainst: 4, yellowCards: 5, redCards: 0, played: 5 },
    { code: "POR", goalsFor: 8, goalsAgainst: 6, yellowCards: 9, redCards: 0, played: 5 },
  ],
  groupStats: [
    { letter: "C", goals: 14, matches: 6 },
    { letter: "F", goals: 12, matches: 6 },
    { letter: "A", goals: 11, matches: 6 },
    { letter: "D", goals: 9, matches: 6 },
    { letter: "B", goals: 6, matches: 6 },
    { letter: "H", goals: 5, matches: 6 },
  ],
  actuals: ACTUALS,
  finishedCount: 48,
};

// 5 demo bettors with deliberately varied picks so every badge state shows up:
// hit (✓), leading/on-track for the open player races, and miss (לא במירוץ).
export const DEMO_BETTORS: BettorLike[] = [
  {
    userId: "demo-you", name: "אמית (אתה)", isYou: true,
    topScorerPlayer: "Kylian Mbappé", topAssistsPlayer: "Lamine Yamal",
    bestAttack: "BRA", dirtiestTeam: "ARG", prolificGroup: "C", driestGroup: "H",
    matchup1: "1", matchup2: "2", matchup3: "X", penalties: "UNDER",
  },
  {
    userId: "demo-2", name: "דני",
    topScorerPlayer: "Harry Kane", topAssistsPlayer: "Bruno Fernandes",
    bestAttack: "FRA", dirtiestTeam: "FRA", prolificGroup: "F", driestGroup: "B",
    matchup1: "2", matchup2: "1", matchup3: "X", penalties: "OVER",
  },
  {
    userId: "demo-3", name: "יוסי",
    topScorerPlayer: "Vinícius Jr", topAssistsPlayer: "Kevin De Bruyne",
    bestAttack: "BRA", dirtiestTeam: "FRA", prolificGroup: "C", driestGroup: "H",
    matchup1: "1", matchup2: "X", matchup3: "2", penalties: "UNDER",
  },
  {
    userId: "demo-4", name: "רון",
    topScorerPlayer: "Cristiano Ronaldo", topAssistsPlayer: "Rodrygo",
    bestAttack: "ESP", dirtiestTeam: "ARG", prolificGroup: "A", driestGroup: "H",
    matchup1: "X", matchup2: "2", matchup3: "X", penalties: "OVER",
  },
  {
    userId: "demo-5", name: "מאיה",
    topScorerPlayer: "Julián Álvarez", topAssistsPlayer: "Jude Bellingham",
    bestAttack: "BRA", dirtiestTeam: "ENG", prolificGroup: "C", driestGroup: "D",
    matchup1: "1", matchup2: "1", matchup3: "1", penalties: "UNDER",
  },
];
