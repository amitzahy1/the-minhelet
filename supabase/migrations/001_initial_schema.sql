-- ============================================================================
-- WC2026 Platform — Initial Database Schema
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- LEAGUES
-- ============================================================================
CREATE TABLE leagues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  max_members INT NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE league_members (
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (league_id, user_id)
);

-- ============================================================================
-- LEAGUE CONFIG (admin settings)
-- ============================================================================
CREATE TABLE league_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE UNIQUE,
  matchup_player_1 TEXT,
  matchup_player_1_team TEXT,
  matchup_player_2 TEXT,
  matchup_player_2_team TEXT,
  penalties_line DECIMAL,
  entry_fee_amount DECIMAL,
  entry_fee_currency TEXT NOT NULL DEFAULT 'ILS',
  prize_1st DECIMAL,
  prize_2nd DECIMAL,
  bracket_lock_before_minutes INT NOT NULL DEFAULT 60,
  match_prediction_lock_before_minutes INT NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TEAMS
-- ============================================================================
CREATE TABLE teams (
  id INT PRIMARY KEY,
  name TEXT NOT NULL,
  name_he TEXT NOT NULL,
  code CHAR(3) NOT NULL UNIQUE,
  flag_url TEXT NOT NULL,
  group_id CHAR(1) NOT NULL,
  fifa_ranking INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_teams_group ON teams(group_id);

-- ============================================================================
-- MATCHES
-- ============================================================================
CREATE TABLE matches (
  id INT PRIMARY KEY,
  home_team_id INT NOT NULL REFERENCES teams(id),
  away_team_id INT NOT NULL REFERENCES teams(id),
  group_id CHAR(1),
  stage TEXT NOT NULL CHECK (stage IN ('GROUP', 'R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL')),
  match_number INT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  venue TEXT NOT NULL,
  city TEXT NOT NULL,
  home_goals INT,
  away_goals INT,
  home_penalties INT,
  away_penalties INT,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED')),
  home_yellow INT NOT NULL DEFAULT 0,
  home_red INT NOT NULL DEFAULT 0,
  away_yellow INT NOT NULL DEFAULT 0,
  away_red INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_matches_group ON matches(group_id);
CREATE INDEX idx_matches_stage ON matches(stage);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_scheduled ON matches(scheduled_at);

-- ============================================================================
-- USER BRACKETS (pre-tournament full prediction)
-- ============================================================================
CREATE TABLE user_brackets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  group_predictions JSONB NOT NULL DEFAULT '{}',
  third_place_qualifiers CHAR(1)[] NOT NULL DEFAULT '{}',
  knockout_tree JSONB NOT NULL DEFAULT '{}',
  champion TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, league_id)
);

-- ============================================================================
-- ADVANCEMENT PICKS (pre-tournament, auto-derived from bracket)
-- ============================================================================
CREATE TABLE advancement_picks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  group_qualifiers JSONB NOT NULL DEFAULT '{}',
  advance_to_qf TEXT[] NOT NULL DEFAULT '{}',
  advance_to_sf TEXT[] NOT NULL DEFAULT '{}',
  advance_to_final TEXT[] NOT NULL DEFAULT '{}',
  winner TEXT NOT NULL DEFAULT '',
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, league_id)
);

-- ============================================================================
-- SPECIAL BETS (pre-tournament)
-- ============================================================================
CREATE TABLE special_bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  top_scorer_player TEXT,
  top_assists_player TEXT,
  best_attack_team TEXT,
  most_prolific_group CHAR(1),
  driest_group CHAR(1),
  dirtiest_team TEXT,
  matchup_pick TEXT CHECK (matchup_pick IN ('1', 'X', '2')),
  penalties_over_under TEXT CHECK (penalties_over_under IN ('OVER', 'UNDER')),
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, league_id)
);

-- ============================================================================
-- MATCH PREDICTIONS (during tournament, per match)
-- ============================================================================
CREATE TABLE match_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  match_id INT NOT NULL REFERENCES matches(id),
  predicted_home_goals INT NOT NULL CHECK (predicted_home_goals >= 0),
  predicted_away_goals INT NOT NULL CHECK (predicted_away_goals >= 0),
  predicted_penalty_winner_id INT REFERENCES teams(id),
  conflict_status TEXT NOT NULL DEFAULT 'CLEAN' CHECK (conflict_status IN ('CLEAN', 'WARNING', 'OVERRIDE')),
  conflict_details JSONB,
  points_earned INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, league_id, match_id)
);

CREATE INDEX idx_predictions_user_league ON match_predictions(user_id, league_id);
CREATE INDEX idx_predictions_match ON match_predictions(match_id);

-- ============================================================================
-- SCORING LOG
-- ============================================================================
CREATE TABLE scoring_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  league_id UUID NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  match_id INT REFERENCES matches(id),
  points INT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scoring_user_league ON scoring_log(user_id, league_id);

-- ============================================================================
-- BADGES
-- ============================================================================
CREATE TABLE badges (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_he TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_url TEXT,
  criteria JSONB
);

CREATE TABLE user_badges (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES badges(id),
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, badge_id)
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_brackets ENABLE ROW LEVEL SECURITY;
ALTER TABLE advancement_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all profiles, update only their own
CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Teams & Matches: readable by everyone (public data)
CREATE POLICY "Teams are viewable by everyone" ON teams FOR SELECT USING (true);
CREATE POLICY "Matches are viewable by everyone" ON matches FOR SELECT USING (true);
CREATE POLICY "Badges are viewable by everyone" ON badges FOR SELECT USING (true);

-- Leagues: readable by members, creatable by authenticated users
CREATE POLICY "Leagues viewable by members" ON leagues FOR SELECT
  USING (id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid()));
CREATE POLICY "Authenticated users can create leagues" ON leagues FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- League members: viewable by fellow members
CREATE POLICY "League members viewable by fellow members" ON league_members FOR SELECT
  USING (league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid()));
CREATE POLICY "Users can join leagues" ON league_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- League config: viewable by members, editable by creator
CREATE POLICY "League config viewable by members" ON league_config FOR SELECT
  USING (league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid()));
CREATE POLICY "League creator can update config" ON league_config FOR ALL
  USING (league_id IN (SELECT id FROM leagues WHERE created_by = auth.uid()));

-- User brackets: viewable by league members (after lock), editable by owner
CREATE POLICY "Brackets viewable by league members" ON user_brackets FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
      AND locked_at IS NOT NULL
    )
  );
CREATE POLICY "Users can manage own brackets" ON user_brackets FOR ALL
  USING (auth.uid() = user_id);

-- Advancement picks: same as brackets
CREATE POLICY "Advancement picks viewable by league members" ON advancement_picks FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
      AND locked_at IS NOT NULL
    )
  );
CREATE POLICY "Users can manage own advancement picks" ON advancement_picks FOR ALL
  USING (auth.uid() = user_id);

-- Special bets: same as brackets
CREATE POLICY "Special bets viewable by league members" ON special_bets FOR SELECT
  USING (
    user_id = auth.uid()
    OR (
      league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
      AND locked_at IS NOT NULL
    )
  );
CREATE POLICY "Users can manage own special bets" ON special_bets FOR ALL
  USING (auth.uid() = user_id);

-- Match predictions: viewable by league members (after match lock), editable by owner
CREATE POLICY "Predictions viewable after lock" ON match_predictions FOR SELECT
  USING (
    user_id = auth.uid()
    OR league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Users can manage own predictions" ON match_predictions FOR ALL
  USING (auth.uid() = user_id);

-- Scoring log: viewable by league members
CREATE POLICY "Scoring viewable by league members" ON scoring_log FOR SELECT
  USING (league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid()));

-- User badges: viewable by everyone
CREATE POLICY "User badges viewable by everyone" ON user_badges FOR SELECT USING (true);
