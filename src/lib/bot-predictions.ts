// ============================================================================
// WC2026 — Bot prediction engine (rule-based)
// Generates a full set of predictions based on FIFA rankings of each team.
// Used by /api/admin/bot to create a deterministic "Bot" bettor.
// ============================================================================

import { GROUPS, GROUP_LETTERS, ALL_TEAMS, getTeamByCode } from "./tournament/groups";
import {
  R32_MATCHUPS,
  LATER_FEEDERS,
  ALL_KO_KEYS,
  resolveGroupSlot,
} from "./tournament/knockout-derivation";
import { joinMatchupPicks } from "./matchups";

export interface BotPrediction {
  group_predictions: Record<string, { order: number[]; scores: Array<{ home: number; away: number }> }>;
  knockout_tree: Record<string, { score1: number; score2: number; winner: string }>;
  third_place_qualifiers: string[];
  champion: string;
  // Advancement (derived from knockout_tree)
  advancement: {
    group_qualifiers: Record<string, string[]>;
    advance_to_qf: string[];
    advance_to_sf: string[];
    advance_to_final: string[];
    winner: string;
  };
  // Special bets (rule-based picks with rationale)
  special: {
    top_scorer_player: string;
    top_scorer_team: string;
    top_assists_player: string;
    top_assists_team: string;
    best_attack_team: string;
    most_prolific_group: string;
    driest_group: string;
    dirtiest_team: string;
    matchup_pick: string;
    penalties_over_under: string;
  };
  // Explanation of each pick (for display)
  rationale: string[];
}

// Group match pair order (same as the store)
const GROUP_MATCH_PAIRS: Array<[number, number]> = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
];

/** Predict a single match score based on FIFA rank differential. */
function predictMatchScore(rank1: number, rank2: number): { home: number; away: number } {
  const diff = Math.abs(rank1 - rank2);
  let strong = 2;
  let weak = 1;
  if (diff > 40) { strong = 3; weak = 0; }
  else if (diff > 20) { strong = 2; weak = 0; }
  else if (diff > 8)  { strong = 2; weak = 1; }
  else                { strong = 1; weak = 1; }
  if (rank1 < rank2) return { home: strong, away: weak };
  if (rank2 < rank1) return { home: weak, away: strong };
  return { home: 1, away: 1 };
}

function higherRanked(code1: string, code2: string): string {
  const r1 = getTeamByCode(code1)?.fifa_ranking ?? 999;
  const r2 = getTeamByCode(code2)?.fifa_ranking ?? 999;
  return r1 <= r2 ? code1 : code2;
}

/** Known "star" player per country — used for top-scorer / top-assists picks. */
const TEAM_STAR: Record<string, { scorer: string; assists: string }> = {
  FRA: { scorer: "Kylian Mbappé", assists: "Antoine Griezmann" },
  ESP: { scorer: "Álvaro Morata", assists: "Pedri" },
  ARG: { scorer: "Lionel Messi", assists: "Lionel Messi" },
  ENG: { scorer: "Harry Kane", assists: "Jude Bellingham" },
  POR: { scorer: "Cristiano Ronaldo", assists: "Bernardo Silva" },
  BRA: { scorer: "Vinícius Jr.", assists: "Raphinha" },
  NED: { scorer: "Memphis Depay", assists: "Frenkie de Jong" },
  MAR: { scorer: "Youssef En-Nesyri", assists: "Hakim Ziyech" },
  BEL: { scorer: "Romelu Lukaku", assists: "Kevin De Bruyne" },
  GER: { scorer: "Kai Havertz", assists: "Jamal Musiala" },
  CRO: { scorer: "Andrej Kramarić", assists: "Luka Modrić" },
  COL: { scorer: "Luis Díaz", assists: "James Rodríguez" },
  SEN: { scorer: "Sadio Mané", assists: "Ismaïla Sarr" },
  URU: { scorer: "Darwin Núñez", assists: "Federico Valverde" },
  USA: { scorer: "Christian Pulisic", assists: "Tyler Adams" },
  MEX: { scorer: "Raúl Jiménez", assists: "Hirving Lozano" },
};

/** Generate a complete bot prediction using team rankings. */
export function generateBotPrediction(): BotPrediction {
  const rationale: string[] = [];

  // ---------- Groups ----------
  const groupPredictions: BotPrediction["group_predictions"] = {};
  for (const letter of GROUP_LETTERS) {
    const teams = GROUPS[letter];
    // Order by FIFA rank (lower = better). order[0] is predicted 1st.
    const sortedIdxs = teams
      .map((t, i) => ({ idx: i, rank: t.fifa_ranking }))
      .sort((a, b) => a.rank - b.rank)
      .map((x) => x.idx);

    const scores = GROUP_MATCH_PAIRS.map(([i, j]) => {
      const r1 = teams[i].fifa_ranking;
      const r2 = teams[j].fifa_ranking;
      return predictMatchScore(r1, r2);
    });

    groupPredictions[letter] = { order: sortedIdxs, scores };

    const top = teams[sortedIdxs[0]];
    const second = teams[sortedIdxs[1]];
    rationale.push(
      `בית ${letter}: ${top.name_he} (#${top.fifa_ranking}) עולה ראשון, ${second.name_he} (#${second.fifa_ranking}) שני — בהתאם לדירוג FIFA.`
    );
  }

  // ---------- Knockout ----------
  const knockout: BotPrediction["knockout_tree"] = {};

  // R32: resolve each slot from group predictions
  for (const [key, { h, a }] of Object.entries(R32_MATCHUPS)) {
    const t1 = resolveGroupSlot(h, groupPredictions);
    const t2 = resolveGroupSlot(a, groupPredictions);
    if (!t1 || !t2) continue;
    const r1 = getTeamByCode(t1)?.fifa_ranking ?? 999;
    const r2 = getTeamByCode(t2)?.fifa_ranking ?? 999;
    const score = predictMatchScore(r1, r2);
    const winner = r1 <= r2 ? t1 : t2;
    knockout[key] = { score1: score.home, score2: score.away, winner };
  }

  // Later rounds: cascade winners
  const laterOrder = ["r16l_0", "r16l_1", "r16l_2", "r16l_3", "r16r_0", "r16r_1", "r16r_2", "r16r_3",
                      "qfl_0", "qfl_1", "qfr_0", "qfr_1",
                      "sfl_0", "sfr_0", "final"];
  for (const key of laterOrder) {
    const [f1, f2] = LATER_FEEDERS[key] || [];
    const t1 = knockout[f1]?.winner;
    const t2 = knockout[f2]?.winner;
    if (!t1 || !t2) continue;
    const r1 = getTeamByCode(t1)?.fifa_ranking ?? 999;
    const r2 = getTeamByCode(t2)?.fifa_ranking ?? 999;
    const score = predictMatchScore(r1, r2);
    const winner = r1 <= r2 ? t1 : t2;
    knockout[key] = { score1: score.home, score2: score.away, winner };
  }

  const champion = knockout["final"]?.winner ?? "FRA";
  const championTeam = getTeamByCode(champion);
  rationale.push(
    `אלוף: ${championTeam?.name_he ?? champion} (#${championTeam?.fifa_ranking ?? "?"}) — הנבחרת הכי גבוהה בדירוג שהגיעה לגמר בסימולציה.`
  );

  // Third place qualifiers (take the 3rd of each of the 8 "best" groups by avg rank)
  const groupsRanked = GROUP_LETTERS
    .map((l) => {
      const teams = GROUPS[l];
      const avg = teams.reduce((s, t) => s + t.fifa_ranking, 0) / teams.length;
      return { letter: l, avg, thirdCode: teams[groupPredictions[l].order[2]]?.code ?? "" };
    })
    .sort((a, b) => a.avg - b.avg);
  const third_place_qualifiers = groupsRanked.slice(0, 8).map((g) => g.thirdCode).filter(Boolean);

  // ---------- Advancement (derived) ----------
  const qf = ["r16l_0", "r16l_1", "r16l_2", "r16l_3", "r16r_0", "r16r_1", "r16r_2", "r16r_3"]
    .map((k) => knockout[k]?.winner)
    .filter(Boolean) as string[];
  const sf = ["qfl_0", "qfl_1", "qfr_0", "qfr_1"].map((k) => knockout[k]?.winner).filter(Boolean) as string[];
  const finalists = ["sfl_0", "sfr_0"].map((k) => knockout[k]?.winner).filter(Boolean) as string[];

  const groupQualifiers: Record<string, string[]> = {};
  for (const letter of GROUP_LETTERS) {
    const teams = GROUPS[letter];
    const order = groupPredictions[letter].order;
    groupQualifiers[letter] = [teams[order[0]].code, teams[order[1]].code];
  }

  // ---------- Special bets ----------
  // Pick top scorer from the predicted finalist's roster
  const winnerStar = TEAM_STAR[champion];
  const runnerUpCode = finalists.find((c) => c !== champion) || champion;
  const runnerUpStar = TEAM_STAR[runnerUpCode];
  const topScorer = winnerStar?.scorer ?? "Kylian Mbappé";
  const topScorerTeam = champion;
  const topAssists = (runnerUpStar?.assists && runnerUpStar.assists !== winnerStar?.scorer)
    ? runnerUpStar.assists
    : (winnerStar?.assists ?? "Pedri");
  const topAssistsTeam = runnerUpStar ? runnerUpCode : champion;

  rationale.push(`מלך שערים: ${topScorer} (${topScorerTeam}) — כוכב הנבחרת המנצחת.`);
  rationale.push(`מלך בישולים: ${topAssists} (${topAssistsTeam}) — מקשר מנבחרת סגנית האלופה.`);

  // Best attack = champion (goes furthest = most goals)
  const bestAttackTeam = champion;
  rationale.push(`התקפה הטובה ביותר: ${championTeam?.name_he} — עברה הכי הרבה סבבים.`);

  // Most prolific group = group with best avg rank
  const mostProlificGroup = groupsRanked[0].letter;
  // Driest group = group with worst avg rank
  const driestGroup = groupsRanked[groupsRanked.length - 1].letter;
  rationale.push(`בית פורה: ${mostProlificGroup} (ממוצע דירוג ${groupsRanked[0].avg.toFixed(0)}).`);
  rationale.push(`בית יבש: ${driestGroup} (ממוצע דירוג ${groupsRanked[groupsRanked.length - 1].avg.toFixed(0)}).`);

  // Dirtiest team: pick a mid-ranked team historically known for cards
  // Uruguay is a classic "dirty" pick in WC lore — usable as heuristic
  const dirtiest = "URU";
  rationale.push(`כסחנית: אורוגוואי — היסטורית מובילה בכרטיסים במונדיאלים.`);

  // Matchups — use FIFA rank of each player's team to decide
  // Messi (ARG #3) vs Ronaldo (POR #5) → 1 (Messi)
  // Raphinha (BRA #6) vs Vinícius (BRA #6) → X (tie — same team)
  // Mbappé (FRA #1) vs Kane (ENG #4) → 1 (Mbappé)
  const matchupPick = joinMatchupPicks(["1", "X", "1"]);
  rationale.push(`מאצ׳אפים: 1 (Messi), X (Raphinha-Vinícius — אותה נבחרת), 1 (Mbappé).`);

  // Penalties over/under — champion-biased runs usually add up → OVER
  const penalties = "OVER";
  rationale.push(`פנדלים: מעל 18.5 — סבבי נוקאאוט ארוכים נוטים להצטבר לסך גבוה.`);

  return {
    group_predictions: groupPredictions,
    knockout_tree: knockout,
    third_place_qualifiers,
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
      top_scorer_team: topScorerTeam,
      top_assists_player: topAssists,
      top_assists_team: topAssistsTeam,
      best_attack_team: bestAttackTeam,
      most_prolific_group: mostProlificGroup,
      driest_group: driestGroup,
      dirtiest_team: dirtiest,
      matchup_pick: matchupPick,
      penalties_over_under: penalties,
    },
    rationale,
  };
}

/** Convenience — list every team (for future LLM integration). */
export function listAllTeamsByRank(): Array<{ code: string; name_he: string; rank: number }> {
  return [...ALL_TEAMS]
    .sort((a, b) => a.fifa_ranking - b.fifa_ranking)
    .map((t) => ({ code: t.code, name_he: t.name_he, rank: t.fifa_ranking }));
}
