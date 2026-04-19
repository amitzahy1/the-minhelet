-- ============================================================================
-- WC2026 Platform — Audit log + demo match results
-- Supports the admin "override user bets" and "enter match results" flows
-- ============================================================================

-- ----------------------------------------------------------------------------
-- admin_audit_log — every admin override of a user's bets
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_email TEXT NOT NULL,
  target_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,            -- user_brackets | advancement_picks | special_bets | demo_match_results
  field_name TEXT NOT NULL,            -- dotted path (e.g. "group_predictions.A.scores[0].home", "top_scorer_player")
  old_value JSONB,
  new_value JSONB,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_target_user ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_admin ON admin_audit_log(admin_email);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read. Writes always via service role.
CREATE POLICY "Audit log viewable by admins"
  ON admin_audit_log FOR SELECT
  USING (auth.jwt() ->> 'email' IN (SELECT email FROM admins));

-- ----------------------------------------------------------------------------
-- demo_match_results — manually-entered or Football-Data-synced match scores
-- Keyed by the external (Football-Data.org) match id so we sidestep the
-- existing matches.id/teams FK requirement. Safe to coexist with the future
-- populated `matches` table.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS demo_match_results (
  match_id TEXT PRIMARY KEY,           -- Football-Data.org id as string
  stage TEXT NOT NULL,                 -- GROUP | R32 | R16 | QF | SF | THIRD | FINAL
  group_id CHAR(1),
  home_team TEXT NOT NULL,             -- TLA code
  away_team TEXT NOT NULL,
  home_goals INT,
  away_goals INT,
  home_penalties INT,
  away_penalties INT,
  status TEXT NOT NULL DEFAULT 'FINISHED' CHECK (status IN ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED')),
  scheduled_at TIMESTAMPTZ,
  entered_by TEXT,                     -- admin email, or "football-data-sync"
  entered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_demo_results_stage ON demo_match_results(stage);
CREATE INDEX IF NOT EXISTS idx_demo_results_group ON demo_match_results(group_id);

ALTER TABLE demo_match_results ENABLE ROW LEVEL SECURITY;

-- Results are public (everyone in the league sees them).
CREATE POLICY "Demo results viewable by everyone"
  ON demo_match_results FOR SELECT USING (true);
-- Writes only via service role (admin API routes).
