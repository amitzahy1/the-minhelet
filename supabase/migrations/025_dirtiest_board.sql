-- Migration 025: dirtiest-team live leaderboard (admin-maintained)
--
-- Stores a ranked list of teams with their yellow/red card counts for the
-- "dirtiest team" (הנבחרת הכסחנית) special bet's LIVE leaderboard. There is no
-- automatic card feed available (Football-Data.org free tier returns no
-- bookings), so the admin maintains this table by hand during the tournament.
--
-- Shape: JSONB array of { "team": "<code>", "yellow": <int>, "red": <int> }.
-- Weighting is applied at display/sort time (yellow = 1, red = 3); a second
-- yellow in the same match should be entered as ONE red (no double count).
-- The final dirtiest_team winner is derived from the top-ranked row on save.

ALTER TABLE tournament_actuals
  ADD COLUMN IF NOT EXISTS dirtiest_board JSONB NOT NULL DEFAULT '[]'::jsonb;
