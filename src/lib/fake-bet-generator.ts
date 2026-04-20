// ============================================================================
// WC2026 — Fake bet generator (for populating empty users in demo)
// Produces a varied but plausible set of bets per user using a seeded RNG
// so the same seed always reproduces the same picks.
// ============================================================================

import { GROUPS, GROUP_LETTERS, ALL_TEAMS, getTeamByCode } from "./tournament/groups";
import { R32_MATCHUPS, LATER_FEEDERS, resolveGroupSlot } from "./tournament/knockout-derivation";
import { joinMatchupPicks } from "./matchups";

interface GroupScore { home: number; away: number }
interface GroupState { order: number[]; scores: GroupScore[] }
interface KOState { score1: number; score2: number; winner: string }

export interface FakePrediction {
  group_predictions: Record<string, GroupState>;
  third_place_qualifiers: string[];
  knockout_tree: Record<string, KOState>;
  champion: string;
  advancement: {
    group_qualifiers: Record<string, string[]>;
    advance_to_qf: string[];
    advance_to_sf: string[];
    advance_to_final: string[];
    winner: string;
  };
  special: {
    top_scorer_player: string;
    top_assists_player: string;
    best_attack_team: string;
    most_prolific_group: string;
    driest_group: string;
    dirtiest_team: string;
    matchup_pick: string;
    penalties_over_under: string;
  };
}

const GROUP_MATCH_PAIRS: Array<[number, number]> = [
  [0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2],
];

/** Simple seeded RNG — deterministic per seed so the same user gets same picks. */
function makeRng(seed: number) {
  let state = seed || 1;
  return () => {
    state = (state * 1664525 + 1013904223) % 0x100000000;
    return state / 0x100000000;
  };
}

const STAR_SCORERS = [
  "Kylian Mbappé", "Lionel Messi", "Erling Haaland", "Harry Kane",
  "Cristiano Ronaldo", "Vinícius Jr.", "Lautaro Martínez", "Rodrygo",
  "Raphinha", "Endrick", "Jamal Musiala", "Kai Havertz",
  "Romelu Lukaku", "Darwin Núñez", "Memphis Depay", "Luis Díaz",
];
const STAR_ASSISTS = [
  "Kevin De Bruyne", "Luka Modrić", "Pedri", "Jude Bellingham",
  "Antoine Griezmann", "Federico Valverde", "Bernardo Silva",
  "Mohamed Salah", "Cole Palmer", "Florian Wirtz", "Hakim Ziyech",
];
const DIRTY_TEAM_CANDIDATES = ["URU", "ARG", "ALG", "KSA", "CRO", "IRN"];

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function predictScore(rank1: number, rank2: number, rng: () => number): GroupScore {
  const diff = Math.abs(rank1 - rank2);
  // Random noise: stronger team usually wins but not always.
  const upset = rng() < 0.2; // 20% upset chance
  let strong = 2, weak = 1;
  if (diff > 35) { strong = 3; weak = 0; }
  else if (diff > 18) { strong = 2; weak = 0; }
  else if (diff > 6)  { strong = 2; weak = 1; }
  else                { strong = 1; weak = 1; }

  // Flip occasionally for variety
  if (rng() < 0.15) { strong = Math.min(3, strong + 1); }
  if (rng() < 0.1)  { weak = Math.min(2, weak + 1); }

  const s1Wins = (rank1 < rank2) !== upset;
  if (s1Wins) return { home: strong, away: weak };
  return { home: weak, away: strong };
}

/** Generate a randomized-but-plausible set of bets for a given seed. */
export function generateFakePrediction(seed: number): FakePrediction {
  const rng = makeRng(seed);

  // Groups: shuffle order biased by rank (better teams tend to finish higher
  // but with randomness).
  const groupPredictions: Record<string, GroupState> = {};
  for (const letter of GROUP_LETTERS) {
    const teams = GROUPS[letter];
    const ranked = teams.map((t, i) => ({ idx: i, rank: t.fifa_ranking }));

    // Introduce rank-aware noise: swap adjacent teams 30% of the time.
    ranked.sort((a, b) => a.rank - b.rank);
    for (let i = 0; i < ranked.length - 1; i++) {
      if (rng() < 0.3) [ranked[i], ranked[i + 1]] = [ranked[i + 1], ranked[i]];
    }
    const order = ranked.map((r) => r.idx);

    const scores: GroupScore[] = GROUP_MATCH_PAIRS.map(([i, j]) => {
      return predictScore(teams[i].fifa_ranking, teams[j].fifa_ranking, rng);
    });

    groupPredictions[letter] = { order, scores };
  }

  // Knockout
  const knockout: Record<string, KOState> = {};
  for (const [key, { h, a }] of Object.entries(R32_MATCHUPS)) {
    const t1 = resolveGroupSlot(h, groupPredictions);
    const t2 = resolveGroupSlot(a, groupPredictions);
    if (!t1 || !t2) continue;
    const r1 = getTeamByCode(t1)?.fifa_ranking ?? 999;
    const r2 = getTeamByCode(t2)?.fifa_ranking ?? 999;
    const score = predictScore(r1, r2, rng);
    const higherIsT1 = r1 <= r2;
    const upset = rng() < 0.18;
    const winner = (higherIsT1 !== upset) ? t1 : t2;
    if (score.home === score.away) {
      // Tie in regulation — bump winner by one for simulation
      if (winner === t1) score.home = score.away + 1;
      else score.away = score.home + 1;
    }
    knockout[key] = { score1: score.home, score2: score.away, winner };
  }

  const laterOrder = [
    "r16l_0","r16l_1","r16l_2","r16l_3","r16r_0","r16r_1","r16r_2","r16r_3",
    "qfl_0","qfl_1","qfr_0","qfr_1","sfl_0","sfr_0","final",
  ];
  for (const key of laterOrder) {
    const [f1, f2] = LATER_FEEDERS[key] || [];
    const t1 = knockout[f1]?.winner;
    const t2 = knockout[f2]?.winner;
    if (!t1 || !t2) continue;
    const r1 = getTeamByCode(t1)?.fifa_ranking ?? 999;
    const r2 = getTeamByCode(t2)?.fifa_ranking ?? 999;
    const score = predictScore(r1, r2, rng);
    const higherIsT1 = r1 <= r2;
    const upset = rng() < 0.2;
    const winner = (higherIsT1 !== upset) ? t1 : t2;
    if (score.home === score.away) {
      if (winner === t1) score.home = score.away + 1;
      else score.away = score.home + 1;
    }
    knockout[key] = { score1: score.home, score2: score.away, winner };
  }

  const champion = knockout["final"]?.winner ?? "FRA";

  // Third place qualifiers: 8 of the 12 groups' 3rd-place teams
  const thirdPlace = shuffle(
    GROUP_LETTERS.map((l) => {
      const order = groupPredictions[l].order;
      return GROUPS[l][order[2]]?.code || "";
    }).filter(Boolean),
    rng
  ).slice(0, 8);

  // Advancement derived from knockout
  const qf = ["r16l_0","r16l_1","r16l_2","r16l_3","r16r_0","r16r_1","r16r_2","r16r_3"]
    .map((k) => knockout[k]?.winner).filter(Boolean) as string[];
  const sf = ["qfl_0","qfl_1","qfr_0","qfr_1"]
    .map((k) => knockout[k]?.winner).filter(Boolean) as string[];
  const finalists = ["sfl_0","sfr_0"]
    .map((k) => knockout[k]?.winner).filter(Boolean) as string[];

  const groupQualifiers: Record<string, string[]> = {};
  for (const letter of GROUP_LETTERS) {
    const order = groupPredictions[letter].order;
    groupQualifiers[letter] = [
      GROUPS[letter][order[0]].code,
      GROUPS[letter][order[1]].code,
    ];
  }

  // Special bets with randomness
  const topScorer = pick(STAR_SCORERS, rng);
  const topAssists = pick(STAR_ASSISTS, rng);

  // Prolific/driest: random groups weighted by rank strength
  const groupsByAvg = GROUP_LETTERS.map((l) => {
    const avg = GROUPS[l].reduce((s, t) => s + t.fifa_ranking, 0) / GROUPS[l].length;
    return { letter: l, avg };
  }).sort((a, b) => a.avg - b.avg);
  const prolificGroup = pick(groupsByAvg.slice(0, 5), rng).letter; // a top-5 strong group
  const driestGroup = pick(groupsByAvg.slice(-5), rng).letter;     // a bottom-5 group

  // Best attack: pick from top-6 ranked teams
  const topTeams = [...ALL_TEAMS].sort((a, b) => a.fifa_ranking - b.fifa_ranking).slice(0, 8);
  const bestAttack = pick(topTeams, rng).code;

  // Dirtiest: from known-dirty candidates
  const dirtiest = pick(DIRTY_TEAM_CANDIDATES, rng);

  // Matchups: random 1/X/2 for each of 3
  const matchupPick = joinMatchupPicks([0, 1, 2].map(() => pick(["1", "X", "2"], rng)));

  // Penalties over/under: 60% over, 40% under
  const penalties = rng() < 0.6 ? "OVER" : "UNDER";

  return {
    group_predictions: groupPredictions,
    third_place_qualifiers: thirdPlace,
    knockout_tree: knockout,
    champion,
    advancement: {
      group_qualifiers: groupQualifiers,
      advance_to_qf: qf,
      advance_to_sf: sf,
      advance_to_final: finalists,
      winner: champion,
    },
    special: {
      top_scorer_player: topScorer,
      top_assists_player: topAssists,
      best_attack_team: bestAttack,
      most_prolific_group: prolificGroup,
      driest_group: driestGroup,
      dirtiest_team: dirtiest,
      matchup_pick: matchupPick,
      penalties_over_under: penalties,
    },
  };
}

/** Turn an arbitrary string (user id) into a seed number. */
export function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}
