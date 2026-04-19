// ============================================================================
// WC2026 — Source of truth for the 3 special-bet "matchups" (player duels)
// Each matchup: pick "1" (p1 wins), "X" (tie), or "2" (p2 wins) by
// total goals + assists across the tournament.
// Stored in special_bets.matchup_pick as a comma-joined 3-slot string.
// ============================================================================

export interface Matchup {
  id: number;
  p1: string;          // p1 label with flag, e.g. "🇦🇷 Messi"
  p2: string;          // p2 label with flag
  p1Short: string;     // short name for compact displays
  p2Short: string;
  flag1: string;
  flag2: string;
  name1: string;
  name2: string;
}

export const MATCHUPS: Matchup[] = [
  {
    id: 0,
    p1: "🇦🇷 Messi",
    p2: "🇵🇹 Ronaldo",
    p1Short: "Messi",
    p2Short: "Ronaldo",
    flag1: "🇦🇷",
    flag2: "🇵🇹",
    name1: "Messi",
    name2: "Ronaldo",
  },
  {
    id: 1,
    p1: "🇧🇷 Raphinha",
    p2: "🇧🇷 Vinícius Jr.",
    p1Short: "Raphinha",
    p2Short: "Vinícius",
    flag1: "🇧🇷",
    flag2: "🇧🇷",
    name1: "Raphinha",
    name2: "Vinícius Jr.",
  },
  {
    id: 2,
    p1: "🇫🇷 Mbappé",
    p2: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 Harry Kane",
    p1Short: "Mbappé",
    p2Short: "Kane",
    flag1: "🇫🇷",
    flag2: "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
    name1: "Mbappé",
    name2: "Harry Kane",
  },
];

/** Convert stored "1,X,2" string into exactly 3 slots (missing → ""). */
export function parseMatchupPick(raw: string | null | undefined): string[] {
  if (!raw) return ["", "", ""];
  const parts = raw.split(",");
  return [parts[0] ?? "", parts[1] ?? "", parts[2] ?? ""];
}

/** Join 3 picks back into the stored comma-joined string. */
export function joinMatchupPicks(picks: string[]): string {
  return picks.map((p) => p ?? "").join(",");
}
