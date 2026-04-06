-- ============================================================================
-- WC2026 Platform — Tournament History & Admin System
-- ============================================================================

-- ============================================================================
-- TOURNAMENTS (supports multiple tournaments: WC2026, WC2030, Euro, etc.)
-- ============================================================================
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                    -- "FIFA World Cup 2026"
  short_name TEXT NOT NULL,              -- "WC2026"
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  num_teams INT NOT NULL DEFAULT 48,
  num_groups INT NOT NULL DEFAULT 12,
  teams_per_group INT NOT NULL DEFAULT 4,
  third_place_qualifiers INT NOT NULL DEFAULT 8,  -- How many 3rd-place teams advance
  status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ACTIVE', 'FINISHED', 'ARCHIVED')),
  is_current BOOLEAN NOT NULL DEFAULT FALSE,  -- Only one tournament can be current
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure only one current tournament at a time
CREATE UNIQUE INDEX idx_tournaments_current ON tournaments (is_current) WHERE is_current = TRUE;

-- ============================================================================
-- ADMIN SYSTEM (email-based admin access)
-- ============================================================================
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'LEAGUE_ADMIN' CHECK (role IN ('SUPER_ADMIN', 'LEAGUE_ADMIN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SCORING CONFIGURATION (per tournament, admin-configurable)
-- ============================================================================
CREATE TABLE scoring_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

  -- Match prediction scoring (toto = correct 1X2)
  toto_group INT NOT NULL DEFAULT 2,
  toto_r32 INT NOT NULL DEFAULT 3,
  toto_r16 INT NOT NULL DEFAULT 3,
  toto_qf INT NOT NULL DEFAULT 3,
  toto_sf INT NOT NULL DEFAULT 3,
  toto_third INT NOT NULL DEFAULT 3,
  toto_final INT NOT NULL DEFAULT 4,

  -- Exact score bonus
  exact_group INT NOT NULL DEFAULT 1,
  exact_r32 INT NOT NULL DEFAULT 1,
  exact_r16 INT NOT NULL DEFAULT 1,
  exact_qf INT NOT NULL DEFAULT 1,
  exact_sf INT NOT NULL DEFAULT 2,
  exact_third INT NOT NULL DEFAULT 1,
  exact_final INT NOT NULL DEFAULT 2,

  -- Pre-tournament advancement picks
  group_advance_exact INT NOT NULL DEFAULT 5,
  group_advance_partial INT NOT NULL DEFAULT 3,
  advance_qf INT NOT NULL DEFAULT 4,
  advance_sf INT NOT NULL DEFAULT 6,
  advance_final INT NOT NULL DEFAULT 8,
  advance_winner INT NOT NULL DEFAULT 12,

  -- Special bets
  top_scorer_exact INT NOT NULL DEFAULT 9,
  top_scorer_relative INT NOT NULL DEFAULT 5,
  top_assists_exact INT NOT NULL DEFAULT 7,
  top_assists_relative INT NOT NULL DEFAULT 4,
  best_attack INT NOT NULL DEFAULT 6,
  prolific_group INT NOT NULL DEFAULT 5,
  driest_group INT NOT NULL DEFAULT 5,
  dirtiest_team INT NOT NULL DEFAULT 5,
  matchup INT NOT NULL DEFAULT 5,
  penalties_over_under INT NOT NULL DEFAULT 5,

  -- Relative minimums
  top_scorer_min_goals INT NOT NULL DEFAULT 3,
  top_assists_min INT NOT NULL DEFAULT 2,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tournament_id)
);

-- ============================================================================
-- Add tournament_id to existing tables
-- ============================================================================
ALTER TABLE teams ADD COLUMN tournament_id UUID REFERENCES tournaments(id);
ALTER TABLE matches ADD COLUMN tournament_id UUID REFERENCES tournaments(id);
ALTER TABLE leagues ADD COLUMN tournament_id UUID REFERENCES tournaments(id);

-- Create indexes
CREATE INDEX idx_teams_tournament ON teams(tournament_id);
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_leagues_tournament ON leagues(tournament_id);

-- ============================================================================
-- TOURNAMENT RESULTS (archived data for completed tournaments)
-- ============================================================================
CREATE TABLE tournament_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  league_id UUID NOT NULL REFERENCES leagues(id),

  -- Final standings as JSONB
  final_standings JSONB NOT NULL,  -- [{ rank, user_id, display_name, total_points, breakdown }]

  -- Tournament stats
  total_matches INT NOT NULL DEFAULT 0,
  total_goals INT NOT NULL DEFAULT 0,

  -- Special bet results
  actual_top_scorer TEXT,
  actual_top_assists TEXT,
  actual_best_attack TEXT,
  actual_prolific_group TEXT,
  actual_driest_group TEXT,
  actual_dirtiest_team TEXT,
  actual_matchup_result TEXT,
  actual_total_penalties INT,
  actual_champion TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- RLS for new tables
-- ============================================================================
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_results ENABLE ROW LEVEL SECURITY;

-- Tournaments: viewable by everyone
CREATE POLICY "Tournaments viewable by everyone" ON tournaments FOR SELECT USING (true);

-- Admins: only super admins can view admin list
CREATE POLICY "Admins viewable by admins" ON admins FOR SELECT
  USING (auth.jwt() ->> 'email' IN (SELECT email FROM admins));

-- Scoring config: viewable by everyone, editable by admins
CREATE POLICY "Scoring config viewable by everyone" ON scoring_config FOR SELECT USING (true);
CREATE POLICY "Scoring config editable by admins" ON scoring_config FOR ALL
  USING (auth.jwt() ->> 'email' IN (SELECT email FROM admins WHERE role = 'SUPER_ADMIN'));

-- Tournament results: viewable by everyone
CREATE POLICY "Tournament results viewable by everyone" ON tournament_results FOR SELECT USING (true);

-- ============================================================================
-- Insert default WC2026 tournament
-- ============================================================================
INSERT INTO tournaments (name, short_name, description, start_date, end_date, num_teams, num_groups, is_current)
VALUES (
  'FIFA World Cup 2026',
  'WC2026',
  'מונדיאל 2026 — ארה"ב, קנדה ומקסיקו. 48 נבחרות, 104 משחקים.',
  '2026-06-11',
  '2026-07-19',
  48,
  12,
  TRUE
);

-- Insert default scoring config for WC2026
INSERT INTO scoring_config (tournament_id)
SELECT id FROM tournaments WHERE short_name = 'WC2026';
