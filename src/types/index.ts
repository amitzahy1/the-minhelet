// ============================================================================
// WC2026 Platform — Core Type Definitions
// ============================================================================

// --- Database / Domain Types ---

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface League {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  max_members: number;
  created_at: string;
}

export interface LeagueMember {
  league_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
}

export interface Team {
  id: number;
  name: string;
  name_he: string;
  code: string; // ISO 3-letter code (ARG, BRA, etc.)
  flag_url: string;
  group_id: string; // A-L
  fifa_ranking: number;
}

export type MatchStage =
  | "GROUP"
  | "R32"
  | "R16"
  | "QF"
  | "SF"
  | "THIRD"
  | "FINAL";

export type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "POSTPONED";

export interface Match {
  id: number;
  home_team_id: number;
  away_team_id: number;
  group_id: string | null;
  stage: MatchStage;
  match_number: number;
  scheduled_at: string;
  venue: string;
  city: string;
  home_goals: number | null;
  away_goals: number | null;
  home_penalties: number | null;
  away_penalties: number | null;
  status: MatchStatus;
  home_yellow: number;
  home_red: number;
  away_yellow: number;
  away_red: number;
  updated_at: string;
  // Joined relations
  home_team?: Team;
  away_team?: Team;
}

// --- Group Stage Types ---

export interface GroupStandingEntry {
  team_id: number;
  team_code: string;
  position: number; // 1-4
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  fair_play_score: number;
}

export interface GroupPrediction {
  /** Ordered array of team codes, index 0 = 1st place */
  order: string[];
  /** Match score predictions within this group */
  matches: GroupMatchPrediction[];
  /** Calculated standings from the match predictions */
  standings: GroupStandingEntry[];
  /** Whether the standings match the predicted order */
  is_valid: boolean;
}

export interface GroupMatchPrediction {
  match_id: number;
  home_team_code: string;
  away_team_code: string;
  home_goals: number;
  away_goals: number;
}

// --- Bracket / Knockout Types ---

export interface KnockoutMatchPrediction {
  match_id: number;
  home_team_code: string;
  away_team_code: string;
  home_goals: number;
  away_goals: number;
  /** In case of draw: who wins ET/penalties */
  winner_code: string;
  /** True if the match goes to extra time / penalties */
  is_extra_time: boolean;
}

export interface KnockoutTree {
  r32: KnockoutMatchPrediction[];
  r16: KnockoutMatchPrediction[];
  qf: KnockoutMatchPrediction[];
  sf: KnockoutMatchPrediction[];
  third_place: KnockoutMatchPrediction | null;
  final: KnockoutMatchPrediction | null;
}

// --- User Bracket (full pre-tournament prediction) ---

export interface UserBracket {
  id: string;
  user_id: string;
  league_id: string;
  /** Group predictions: keyed by group letter */
  group_predictions: Record<string, GroupPrediction>;
  /** Which 8 third-place groups advance */
  third_place_qualifiers: string[];
  /** Full knockout bracket */
  knockout_tree: KnockoutTree;
  /** Predicted champion team code */
  champion: string;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

// --- Advancement Picks ---

export interface AdvancementPicks {
  id: string;
  user_id: string;
  league_id: string;
  /** { "A": { "1st": "ARG", "2nd": "MEX" }, ... } */
  group_qualifiers: Record<string, { "1st": string; "2nd": string }>;
  advance_to_qf: string[]; // 8 team codes
  advance_to_sf: string[]; // 4 team codes
  advance_to_final: string[]; // 2 team codes
  winner: string; // 1 team code
  locked_at: string | null;
  created_at: string;
}

// --- Special Bets ---

export interface SpecialBets {
  id: string;
  user_id: string;
  league_id: string;
  top_scorer_player: string | null;
  top_assists_player: string | null;
  best_attack_team: string | null;
  most_prolific_group: string | null;
  driest_group: string | null;
  dirtiest_team: string | null;
  matchup_pick: "1" | "X" | "2" | null;
  penalties_over_under: "OVER" | "UNDER" | null;
  locked_at: string | null;
  created_at: string;
}

// --- League Config ---

export interface LeagueConfig {
  id: string;
  league_id: string;
  matchup_player_1: string | null;
  matchup_player_1_team: string | null;
  matchup_player_2: string | null;
  matchup_player_2_team: string | null;
  penalties_line: number | null;
  entry_fee_amount: number | null;
  entry_fee_currency: string;
  prize_1st: number | null;
  prize_2nd: number | null;
  bracket_lock_before_minutes: number;
  match_prediction_lock_before_minutes: number;
}

// --- Match Predictions (during tournament) ---

export interface MatchPrediction {
  id: string;
  user_id: string;
  league_id: string;
  match_id: number;
  predicted_home_goals: number;
  predicted_away_goals: number;
  predicted_penalty_winner_id: number | null;
  conflict_status: "CLEAN" | "WARNING" | "OVERRIDE";
  conflict_details: ConflictDetails | null;
  points_earned: number;
  created_at: string;
  updated_at: string;
}

// --- Validation Types ---

export type ConflictType = "MATHEMATICAL" | "LOGICAL_PATH";

export interface ConflictDetails {
  type: ConflictType;
  message: string;
  message_he: string;
  affected_matches?: number[];
  affected_teams?: string[];
  /** For group conflicts: what the standings would look like */
  simulated_standings?: GroupStandingEntry[];
}

export interface ValidationResult {
  is_valid: boolean;
  conflict?: ConflictDetails;
}

// --- Scoring Types ---

export type ScoreReason =
  | "TOTO"
  | "EXACT_SCORE"
  | "GROUP_ADVANCE_EXACT"
  | "GROUP_ADVANCE_PARTIAL"
  | "GROUP_ADVANCE_AS_3RD"
  | "ADVANCE_QF"
  | "ADVANCE_SF"
  | "ADVANCE_FINAL"
  | "WINNER"
  | "TOP_SCORER_EXACT"
  | "TOP_SCORER_RELATIVE"
  | "TOP_ASSISTS_EXACT"
  | "TOP_ASSISTS_RELATIVE"
  | "BEST_ATTACK"
  | "PROLIFIC_GROUP"
  | "DRIEST_GROUP"
  | "DIRTIEST_TEAM"
  | "MATCHUP"
  | "PENALTIES_OVER_UNDER";

export interface ScoringLogEntry {
  id: string;
  user_id: string;
  league_id: string;
  match_id: number | null;
  points: number;
  reason: ScoreReason;
  created_at: string;
}

// --- Leaderboard ---

export interface LeaderboardEntry {
  user_id: string;
  profile: Profile;
  match_points: number;
  advancement_points: number;
  special_points: number;
  total_points: number;
  rank: number;
  rank_change: number; // positive = went up, negative = went down
}

// --- Scoring Constants ---

export const SCORING = {
  // Match predictions (toto = correct 1X2)
  toto: {
    GROUP: 2,
    R32: 3,
    R16: 3,
    QF: 3,
    SF: 3,
    THIRD: 3,
    FINAL: 4,
  } as Record<MatchStage, number>,

  // Exact score bonus (on top of toto)
  exact: {
    GROUP: 1,
    R32: 1,
    R16: 1,
    QF: 1,
    SF: 2,
    THIRD: 1,
    FINAL: 2,
  } as Record<MatchStage, number>,

  // Pre-tournament advancement picks
  advancement: {
    group_exact: 5, // Correct team in correct position
    group_partial: 3, // Correct team but wrong position (1st↔2nd swap)
    group_as_3rd: 2, // Correct team advanced past groups, but as a best-3rd qualifier
    qf: 4, // Per team reaching QF
    sf: 6, // Per team reaching SF
    final: 8, // Per team reaching Final
    winner: 12, // Champion
  },

  // Special bets
  specials: {
    top_scorer_exact: 9,
    top_scorer_relative: 5,
    top_assists_exact: 7,
    top_assists_relative: 4,
    best_attack: 6,
    prolific_group: 5,
    driest_group: 5,
    dirtiest_team: 5,
    matchup: 5,
    penalties_over_under: 5,
  },

  // Minimum thresholds for "relative" picks
  relative_minimums: {
    top_scorer_goals: 3,
    top_assists: 2,
  },
} as const;

// --- Tiebreaker Order ---
export const TIEBREAKER_ORDER = [
  "winner",
  "finalists",
  "final_toto",
  "semifinalists",
  "semifinal_toto",
  "top_scorer",
  "quarterfinalists",
] as const;
