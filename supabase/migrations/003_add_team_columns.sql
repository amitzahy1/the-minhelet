-- Add team columns for top scorer and top assists selectors
ALTER TABLE special_bets ADD COLUMN IF NOT EXISTS top_scorer_team TEXT;
ALTER TABLE special_bets ADD COLUMN IF NOT EXISTS top_assists_team TEXT;

-- Relax matchup_pick CHECK constraint — the app saves comma-joined values like "1,X,2"
-- The original constraint only allowed single values ('1', 'X', '2')
ALTER TABLE special_bets DROP CONSTRAINT IF EXISTS special_bets_matchup_pick_check;
