-- ============================================================================
-- WC2026 — Server-side scoring snapshots
--
-- Captures the output of the live scoring engine at a point in time. Lets
-- the admin (a) recompute scores explicitly when something breaks and
-- (b) preserve an audit trail of what each user was awarded at each stage.
-- ============================================================================

CREATE TABLE IF NOT EXISTS scoring_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  league_id UUID NOT NULL,
  total INT NOT NULL,
  match_pts INT NOT NULL DEFAULT 0,
  adv_pts INT NOT NULL DEFAULT 0,
  spec_pts INT NOT NULL DEFAULT 0,
  /** Full breakdown: { totoGroup, exactGroup, totoKnockout, exactKnockout,
      groupAdvExact, groupAdvPartial, advQF, advSF, advFinal, winner,
      topScorer, topAssists, bestAttack, specials }. */
  breakdown JSONB NOT NULL DEFAULT '{}'::JSONB,
  /** True when any line in this snapshot is interim (live-tentative). */
  has_interim BOOLEAN NOT NULL DEFAULT FALSE,
  /** Which admin triggered it ("system" for cron, email for manual). */
  source TEXT NOT NULL DEFAULT 'manual',
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scoring_snapshots_user ON scoring_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_scoring_snapshots_computed ON scoring_snapshots(computed_at DESC);

ALTER TABLE scoring_snapshots ENABLE ROW LEVEL SECURITY;

-- Anyone can read snapshots (mirrors the visibility of scoring_log).
CREATE POLICY "Snapshots viewable by everyone"
  ON scoring_snapshots FOR SELECT USING (true);

-- Only service role writes.
