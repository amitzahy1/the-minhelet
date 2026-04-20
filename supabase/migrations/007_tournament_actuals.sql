-- ============================================================================
-- WC2026 Platform — Tournament actuals (live special-bet results)
-- ============================================================================
--
-- Single-row-per-tournament table holding the ADMIN-ENTERED actual results
-- for every "special bet" category. The Special-Bets Tracker on the compare
-- page reads this to mark bettors as "hit" vs "on-track" vs "missed".
--
-- Auto-computed stats (goals scored per team, cards per team, top scorers
-- from Football-Data.org) are layered ON TOP of these actuals by the
-- `/api/tournament-stats` endpoint. Admin entries always win when present.
-- ============================================================================

CREATE TABLE IF NOT EXISTS tournament_actuals (
  tournament_id UUID PRIMARY KEY REFERENCES tournaments(id) ON DELETE CASCADE,

  -- Star-player bets
  top_scorer_player TEXT,
  top_scorer_team TEXT,
  top_scorer_goals INT,
  top_assists_player TEXT,
  top_assists_team TEXT,
  top_assists_count INT,

  -- Team bets
  best_attack_team TEXT,       -- team that scored the most goals
  best_attack_goals INT,
  dirtiest_team TEXT,          -- most yellow+red cards
  dirtiest_team_cards INT,

  -- Group bets
  most_prolific_group CHAR(1),
  most_prolific_goals INT,
  driest_group CHAR(1),
  driest_group_goals INT,

  -- Player duels — "1" = p1 won, "X" = tied, "2" = p2 won, NULL = not yet decided.
  -- Positional in the MATCHUPS array (Messi-Ronaldo, Raphinha-Vinicius, Mbappé-Kane).
  matchup_result_1 TEXT CHECK (matchup_result_1 IN ('1','X','2') OR matchup_result_1 IS NULL),
  matchup_result_2 TEXT CHECK (matchup_result_2 IN ('1','X','2') OR matchup_result_2 IS NULL),
  matchup_result_3 TEXT CHECK (matchup_result_3 IN ('1','X','2') OR matchup_result_3 IS NULL),

  -- Totals (for over/under style bets)
  total_penalties INT,
  penalties_over_under TEXT CHECK (penalties_over_under IN ('OVER','UNDER') OR penalties_over_under IS NULL),

  -- Champion fallback (mirror of winner)
  champion TEXT,

  entered_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tournament_actuals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Actuals viewable by everyone"
  ON tournament_actuals FOR SELECT USING (true);
-- Writes only via service role (admin API routes).

-- Allow admin_audit_log entries that target the tournament rather than a
-- specific user (e.g. "actuals updated by admin"). Existing rows keep their
-- values; new rows may set target_user_id = NULL.
ALTER TABLE admin_audit_log
  ALTER COLUMN target_user_id DROP NOT NULL;
