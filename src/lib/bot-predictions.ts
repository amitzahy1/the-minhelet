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

/** Players in each matchup and their team code — used to pick matchup winners. */
const MATCHUP_PLAYERS = [
  { p1: "Messi", team1: "ARG", p2: "Ronaldo", team2: "POR" },
  { p1: "Raphinha", team1: "BRA", p2: "Vinícius", team2: "BRA" },
  { p1: "Mbappé", team1: "FRA", p2: "Harry Kane", team2: "ENG" },
];

/** Known "star" player per country — used for top-scorer / top-assists picks. */
const TEAM_STAR: Record<string, { scorer: string; assists: string; scorerRep: number; assistsRep: number }> = {
  FRA: { scorer: "Kylian Mbappé", assists: "Antoine Griezmann", scorerRep: 95, assistsRep: 82 },
  ESP: { scorer: "Álvaro Morata", assists: "Pedri", scorerRep: 75, assistsRep: 85 },
  ARG: { scorer: "Lautaro Martínez", assists: "Lionel Messi", scorerRep: 82, assistsRep: 95 },
  ENG: { scorer: "Harry Kane", assists: "Jude Bellingham", scorerRep: 92, assistsRep: 80 },
  POR: { scorer: "Cristiano Ronaldo", assists: "Bernardo Silva", scorerRep: 80, assistsRep: 75 },
  BRA: { scorer: "Vinícius Jr.", assists: "Raphinha", scorerRep: 88, assistsRep: 78 },
  NED: { scorer: "Memphis Depay", assists: "Frenkie de Jong", scorerRep: 75, assistsRep: 72 },
  MAR: { scorer: "Youssef En-Nesyri", assists: "Hakim Ziyech", scorerRep: 68, assistsRep: 70 },
  BEL: { scorer: "Romelu Lukaku", assists: "Kevin De Bruyne", scorerRep: 78, assistsRep: 90 },
  GER: { scorer: "Kai Havertz", assists: "Jamal Musiala", scorerRep: 72, assistsRep: 78 },
  CRO: { scorer: "Andrej Kramarić", assists: "Luka Modrić", scorerRep: 65, assistsRep: 82 },
  COL: { scorer: "Luis Díaz", assists: "James Rodríguez", scorerRep: 74, assistsRep: 76 },
  SEN: { scorer: "Sadio Mané", assists: "Ismaïla Sarr", scorerRep: 72, assistsRep: 65 },
  URU: { scorer: "Darwin Núñez", assists: "Federico Valverde", scorerRep: 73, assistsRep: 72 },
  USA: { scorer: "Christian Pulisic", assists: "Tyler Adams", scorerRep: 68, assistsRep: 60 },
  MEX: { scorer: "Raúl Jiménez", assists: "Hirving Lozano", scorerRep: 65, assistsRep: 62 },
};

/** How far a team reaches in the predicted bracket (higher = further). */
function teamFinalRound(
  code: string,
  knockout: Record<string, { winner: string }>
): { round: number; label: string } {
  // champion? reached final & won
  if (knockout["final"]?.winner === code) return { round: 6, label: "אלוף" };
  // made the final (lost in final)
  if (knockout["sfl_0"]?.winner === code || knockout["sfr_0"]?.winner === code) {
    return { round: 5, label: "גמר" };
  }
  // made semi
  for (const k of ["qfl_0", "qfl_1", "qfr_0", "qfr_1"]) {
    if (knockout[k]?.winner === code) return { round: 4, label: "חצי גמר" };
  }
  // made QF
  for (const k of ["r16l_0", "r16l_1", "r16l_2", "r16l_3", "r16r_0", "r16r_1", "r16r_2", "r16r_3"]) {
    if (knockout[k]?.winner === code) return { round: 3, label: "רבע גמר" };
  }
  // made R16
  for (const k of Object.keys(R32_MATCHUPS)) {
    if (knockout[k]?.winner === code) return { round: 2, label: "שמינית" };
  }
  return { round: 1, label: "בתים" };
}

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
  // Pick top scorer / top assists by combining:
  //   (a) how far their team actually reaches in OUR predicted bracket
  //   (b) their known reputation score
  // A forward on a team that exits in R32 has less upside than one whose team goes to the final.
  const scorerCandidates = Object.entries(TEAM_STAR).map(([code, star]) => {
    const depth = teamFinalRound(code, knockout);
    return { code, player: star.scorer, rep: star.scorerRep, depth: depth.round, depthLabel: depth.label };
  }).sort((a, b) => (b.depth * 30 + b.rep) - (a.depth * 30 + a.rep));

  const assistsCandidates = Object.entries(TEAM_STAR).map(([code, star]) => {
    const depth = teamFinalRound(code, knockout);
    return { code, player: star.assists, rep: star.assistsRep, depth: depth.round, depthLabel: depth.label };
  }).sort((a, b) => (b.depth * 30 + b.rep) - (a.depth * 30 + a.rep));

  const topPick = scorerCandidates[0];
  const topScorer = topPick.player;
  const topScorerTeam = topPick.code;

  // Different player for assists (avoid same player for both)
  const assistsPick = assistsCandidates.find((a) => a.player !== topPick.player) || assistsCandidates[0];
  const topAssists = assistsPick.player;
  const topAssistsTeam = assistsPick.code;

  rationale.push(
    `מלך שערים: ${topScorer} (${topScorerTeam}) — ${getTeamByCode(topPick.code)?.name_he} מגיעה עד ${topPick.depthLabel} בסימולציה, ודירוג הכוכבים שלו ${topPick.rep}/100.`
  );
  rationale.push(
    `מלך בישולים: ${topAssists} (${topAssistsTeam}) — ${getTeamByCode(assistsPick.code)?.name_he} מגיעה עד ${assistsPick.depthLabel}, ודירוג היצירתיות שלו ${assistsPick.rep}/100.`
  );

  // Best attack = champion (plays the most games + scores the most)
  const bestAttackTeam = champion;
  rationale.push(
    `התקפה הטובה: ${championTeam?.name_he} — 7 משחקים בדרך לאליפות = הכי הרבה הזדמנויות לשערים.`
  );

  // Most prolific group = group with best avg rank (more balanced strong teams = open matches)
  const mostProlificGroup = groupsRanked[0].letter;
  // Driest group = group with worst avg rank (weaker teams = less goals)
  const driestGroup = groupsRanked[groupsRanked.length - 1].letter;
  rationale.push(
    `בית פורה: ${mostProlificGroup} — ממוצע דירוג ${groupsRanked[0].avg.toFixed(0)}, נבחרות איכותיות → יותר שערים.`
  );
  rationale.push(
    `בית יבש: ${driestGroup} — ממוצע דירוג ${groupsRanked[groupsRanked.length - 1].avg.toFixed(0)}, נבחרות חלשות → מעט שערים, משחקים זהירים.`
  );

  // Dirtiest team: historical data says South American sides (Uruguay, Argentina) lead in cards
  const dirtiest = "URU";
  rationale.push(
    `כסחנית: אורוגוואי — במונדיאל 2022 הייתה בין המובילות בכרטיסים, ובנבחרת יש שחקנים פיזיים (Giménez, Gómez).`
  );

  // Matchups — decide based on each player's team's predicted depth
  const matchupLogic = MATCHUP_PLAYERS.map((mu) => {
    const d1 = teamFinalRound(mu.team1, knockout);
    const d2 = teamFinalRound(mu.team2, knockout);
    let pick: "1" | "X" | "2";
    let note: string;
    if (mu.team1 === mu.team2) {
      pick = "X";
      note = `שניהם מ${getTeamByCode(mu.team1)?.name_he} — משחקים באותם משחקים, סביר לתיקו.`;
    } else if (d1.round > d2.round) {
      pick = "1";
      note = `${mu.p1} → ${d1.label}, ${mu.p2} → ${d2.label}. ${mu.p1} מקבל יותר משחקים.`;
    } else if (d2.round > d1.round) {
      pick = "2";
      note = `${mu.p2} → ${d2.label}, ${mu.p1} → ${d1.label}. ${mu.p2} מקבל יותר משחקים.`;
    } else {
      // Same depth — decide by player rep
      const rep1 = TEAM_STAR[mu.team1]?.scorerRep ?? 70;
      const rep2 = TEAM_STAR[mu.team2]?.scorerRep ?? 70;
      pick = rep1 >= rep2 ? "1" : "2";
      note = `שתי הנבחרות מגיעות ל${d1.label}. ${pick === "1" ? mu.p1 : mu.p2} עם דירוג כוכב גבוה יותר (${pick === "1" ? rep1 : rep2} vs ${pick === "1" ? rep2 : rep1}).`;
    }
    return { pick, note };
  });
  const matchupPick = joinMatchupPicks(matchupLogic.map((m) => m.pick));
  rationale.push("מאצ׳אפים:");
  matchupLogic.forEach((m, i) => rationale.push(`  ${i + 1}. ${m.note} → ${m.pick}`));

  // Penalties over/under — champion runs typically accumulate many penalty kicks
  const penalties = "OVER";
  rationale.push(
    `פנדלים: מעל 18.5 — 104 משחקים זה הרבה, ובשלבי הנוקאאוט יש הרבה פנדלים (כולל הארכות).`
  );

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
