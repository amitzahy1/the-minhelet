-- ============================================================================
-- WC2026 — 120-minute (full-time incl. extra time, excl. shootout) goals
--
-- The special bets count goals over the FULL match (regulation + extra time),
-- NOT just the 90'. `home_goals`/`away_goals` deliberately store only the 90'
-- score (the exact/toto MATCH bet is judged on that). So a goal scored in
-- extra time was invisible to the "best attack" (הנבחרת עם הכי הרבה שערים)
-- tally, which summed the 90' scorelines.
--
-- These columns hold the 120' score EXCLUDING the shootout — i.e. the tally a
-- team's "goals scored" is officially counted on. `buildResultRows`
-- (fullTime120Score) populates them for every finished match; group-stage rows
-- get the same value as the 90' score (no extra time there). Nullable so old
-- rows read back as NULL and the aggregation falls back to the 90' columns.
--
-- Re-runnable. Apply once (Supabase dashboard → SQL editor, or `supabase db push`).
-- ============================================================================

ALTER TABLE demo_match_results
  ADD COLUMN IF NOT EXISTS home_goals_120 INT,
  ADD COLUMN IF NOT EXISTS away_goals_120 INT;

-- Backfill existing rows to the 90' score as a safe floor: for group matches
-- this is exact, and for already-played KO matches it is corrected the next time
-- the sync re-runs buildResultRows (which recomputes the true 120' value).
UPDATE demo_match_results
  SET home_goals_120 = home_goals,
      away_goals_120 = away_goals
  WHERE home_goals_120 IS NULL
    AND home_goals IS NOT NULL
    AND away_goals IS NOT NULL;

-- Ask PostgREST to reload its schema cache so the new columns are selectable.
NOTIFY pgrst, 'reload schema';
