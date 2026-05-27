-- ============================================================================
-- WC2026 — Per-player tournament stats (goals + assists)
--
-- Feeds the live tentative special-bets scoring path: when admin hasn't
-- entered the final top-scorer / top-assists outcome yet, the scorer
-- computes interim points against these rows.
--
-- Populated by:
--  * /api/sync cron (extracts goalscorers[] from Football-Data match events)
--  * /api/admin/player-stats manual patch (when the FD feed lags)
-- ============================================================================

CREATE TABLE IF NOT EXISTS player_stats (
  player_name TEXT PRIMARY KEY,         -- Canonical name (matches what users picked)
  team_code TEXT,                       -- 3-letter TLA when known
  goals INT NOT NULL DEFAULT 0,
  assists INT NOT NULL DEFAULT 0,
  minutes INT NOT NULL DEFAULT 0,
  yellow_cards INT NOT NULL DEFAULT 0,
  red_cards INT NOT NULL DEFAULT 0,
  /** Source of the latest update — "football-data-sync" or admin email. */
  source TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_player_stats_goals ON player_stats(goals DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_assists ON player_stats(assists DESC);
CREATE INDEX IF NOT EXISTS idx_player_stats_team ON player_stats(team_code);

ALTER TABLE player_stats ENABLE ROW LEVEL SECURITY;

-- Public read.
CREATE POLICY "Player stats viewable by everyone"
  ON player_stats FOR SELECT USING (true);
-- Writes via service role only.
