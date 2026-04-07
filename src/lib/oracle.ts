// ============================================================================
// WC2026 — "The Oracle" AI Player
// A virtual bettor that competes against everyone
// Predictions based on FIFA rankings + weighted randomness
// ============================================================================

import { ALL_TEAMS, GROUPS } from "@/lib/tournament/groups";

// Seed for deterministic "random" — same predictions every time
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const rng = seededRandom(2026);

/**
 * Generate Oracle's group stage predictions
 * Higher-ranked teams more likely to win, but with upset potential
 */
export function getOracleGroupPredictions(): Record<string, { order: number[]; scores: { home: number; away: number }[] }> {
  const predictions: Record<string, { order: number[]; scores: { home: number; away: number }[] }> = {};

  for (const [groupId, teams] of Object.entries(GROUPS)) {
    // Sort by FIFA ranking (lower = better)
    const ranked = teams.map((t, i) => ({ ...t, idx: i })).sort((a, b) => a.fifa_ranking - b.fifa_ranking);
    const order = ranked.map(t => t.idx);

    // Generate scores for 6 matches
    const codes = teams.map(t => t.code);
    const matchups = [
      [0, 1], [2, 3], [0, 2], [3, 1], [3, 0], [1, 2],
    ];

    const scores = matchups.map(([h, a]) => {
      const homeRank = teams[h].fifa_ranking;
      const awayRank = teams[a].fifa_ranking;
      const diff = awayRank - homeRank; // positive = home is better

      // Base goals influenced by ranking difference
      const homeBase = Math.max(0, Math.round(1.2 + diff / 40 + (rng() - 0.3) * 2));
      const awayBase = Math.max(0, Math.round(1.0 - diff / 40 + (rng() - 0.3) * 2));

      return { home: Math.min(homeBase, 5), away: Math.min(awayBase, 4) };
    });

    predictions[groupId] = { order, scores };
  }

  return predictions;
}

/**
 * Generate Oracle's special bets
 */
export function getOracleSpecialBets() {
  // Pick top-ranked teams for advancement
  const allByRank = ALL_TEAMS.sort((a, b) => a.fifa_ranking - b.fifa_ranking);

  return {
    winner: "ARG",
    finalist1: "ARG",
    finalist2: "FRA",
    semifinalists: ["ARG", "FRA", "BRA", "ESP"],
    quarterfinalists: ["ARG", "FRA", "BRA", "ESP", "GER", "ENG", "POR", "NED"],
    topScorer: "Mbappé",
    topAssists: "Bellingham",
    bestAttack: "FRA",
    dirtiestTeam: "MAR",
    prolificGroup: "C",
    driestGroup: "G",
  };
}

/**
 * Calculate prediction similarity between two bettors
 * Returns 0-100% similarity score
 */
export function calculateSimilarity(
  bettor1: { winner: string; sf: string[]; qf: string[]; groups: Record<string, string[]> },
  bettor2: { winner: string; sf: string[]; qf: string[]; groups: Record<string, string[]> }
): number {
  let matches = 0;
  let total = 0;

  // Winner (high weight)
  total += 3;
  if (bettor1.winner === bettor2.winner) matches += 3;

  // Semifinalists
  for (const team of bettor1.sf) {
    total += 2;
    if (bettor2.sf.includes(team)) matches += 2;
  }

  // Quarterfinalists
  for (const team of bettor1.qf) {
    total += 1;
    if (bettor2.qf.includes(team)) matches += 1;
  }

  // Group picks
  for (const [groupId, picks1] of Object.entries(bettor1.groups)) {
    const picks2 = bettor2.groups[groupId];
    if (!picks2) continue;
    total += 2;
    if (picks1[0] === picks2[0]) matches += 1; // Same 1st place
    if (picks1[1] === picks2[1]) matches += 1; // Same 2nd place
  }

  return total > 0 ? Math.round((matches / total) * 100) : 0;
}
