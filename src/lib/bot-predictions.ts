// ============================================================================
// WC2026 — Bot prediction engine (rule-based, MODERATE surprises)
//
// Generates a full set of predictions seeded by FIFA rankings, but deliberately
// NOT pure chalk: it plants plausible, bounded upsets so the bot looks like a
// real (slightly contrarian) bettor rather than a ranking table.
//
//   • Champion = a TOP 5–8 team (a credible dark horse, never the #1 favourite),
//     driven to win it all.
//   • Groups: ≤1 upset per group, and ONLY between closely-ranked teams.
//   • Knockout: favourites usually advance, but a few close early-round ties flip.
//   • Scores: close games often draw or end 1-0; lopsided games stay lopsided.
//
// Fully DETERMINISTIC — every "random" choice comes from a string hash (no
// Math.random), so regenerating the bot yields the identical bracket and the
// rationale stays truthful.
// ============================================================================

import { GROUPS, GROUP_LETTERS, ALL_TEAMS, getTeamByCode } from "./tournament/groups";
import {
  R32_MATCHUPS,
  LATER_FEEDERS,
  resolveGroupSlot,
} from "./tournament/knockout-derivation";
import { joinMatchupPicks } from "./matchups";
import { PENALTIES_LINE } from "./constants";

export interface BotPrediction {
  group_predictions: Record<string, { order: number[]; scores: Array<{ home: number; away: number }> }>;
  knockout_tree: Record<string, { score1: number; score2: number; winner: string }>;
  third_place_qualifiers: string[];
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
  rationale: string[];
}

// Group match pair order (same as the store)
const GROUP_MATCH_PAIRS: Array<[number, number]> = [
  [0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2],
];

/** Deterministic [0,1) from a string seed (FNV-1a). No Math.random → the bot is
 *  reproducible: same inputs → same bracket every regenerate. */
function rand(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * MODERATE score model: favourite (lower FIFA rank) usually wins; close games
 * (small rank gap) sometimes draw or flip to the underdog. Goals are oriented to
 * (rank1 = home, rank2 = away). `key` makes the pick deterministic per match.
 */
function predictMatchScore(rank1: number, rank2: number, key: string): { home: number; away: number } {
  const diff = Math.abs(rank1 - rank2);
  const favHome = rank1 <= rank2;
  const r = rand("sc:" + key);
  const orient = (fav: number, dog: number) => (favHome ? { home: fav, away: dog } : { home: dog, away: fav });
  if (diff > 30) return orient(3, r < 0.5 ? 0 : 1);
  if (diff > 15) return orient(2, r < 0.6 ? 0 : 1);
  if (diff > 6) {
    if (r < 0.18) return { home: 1, away: 1 };  // draw
    if (r < 0.32) return orient(1, 2);          // mild upset — underdog wins 2-1
    return orient(2, 1);
  }
  // very close
  if (r < 0.34) return { home: 1, away: 1 };    // draw
  if (r < 0.62) return orient(1, 0);            // favourite edges it
  return orient(0, 1);                          // upset — underdog 1-0
}

const rankOf = (code: string): number => getTeamByCode(code)?.fifa_ranking ?? 999;

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
  if (knockout["final"]?.winner === code) return { round: 6, label: "אלוף" };
  if (knockout["sfl_0"]?.winner === code || knockout["sfr_0"]?.winner === code) {
    return { round: 5, label: "גמר" };
  }
  for (const k of ["qfl_0", "qfl_1", "qfr_0", "qfr_1"]) {
    if (knockout[k]?.winner === code) return { round: 4, label: "חצי גמר" };
  }
  for (const k of ["r16l_0", "r16l_1", "r16l_2", "r16l_3", "r16r_0", "r16r_1", "r16r_2", "r16r_3"]) {
    if (knockout[k]?.winner === code) return { round: 3, label: "רבע גמר" };
  }
  for (const k of Object.keys(R32_MATCHUPS)) {
    if (knockout[k]?.winner === code) return { round: 2, label: "שמינית גמר" };
  }
  return { round: 1, label: "בתים" };
}

const koStage = (key: string): "R32" | "R16" | "QF" | "SF" | "FINAL" => {
  if (key.startsWith("r32")) return "R32";
  if (key.startsWith("r16")) return "R16";
  if (key.startsWith("qf")) return "QF";
  if (key.startsWith("sf")) return "SF";
  return "FINAL";
};

/** Generate a complete bot prediction with moderate, deterministic surprises. */
export function generateBotPrediction(): BotPrediction {
  const rationale: string[] = [];

  // Pick a credible dark-horse champion: the 5th–8th best team in the field
  // (deterministic). The bot then drives this team to win the whole thing — a
  // surprising-but-plausible winner, never the outright #1, never an absurd one.
  const fieldByRank = [...ALL_TEAMS].sort((a, b) => a.fifa_ranking - b.fifa_ranking);
  const championTarget = fieldByRank[4 + Math.floor(rand("champ") * 4)].code;
  const championTeam0 = getTeamByCode(championTarget);
  rationale.push(
    `אלוף (הפתעה): ${championTeam0?.name_he ?? championTarget} (#${championTeam0?.fifa_ranking ?? "?"}) — לא הפייבוריטית מספר 1, אלא סוס שחור מהצמרת (מקום 5–8 בדירוג) שהבוט מוביל עד הזכייה.`
  );

  // ---------- Groups ----------
  const groupPredictions: BotPrediction["group_predictions"] = {};
  for (const letter of GROUP_LETTERS) {
    const teams = GROUPS[letter];
    const byRank = teams
      .map((t, i) => ({ idx: i, rank: t.fifa_ranking }))
      .sort((a, b) => a.rank - b.rank)
      .map((x) => x.idx);

    let order = [...byRank];
    const champIdx = teams.findIndex((t) => t.code === championTarget);
    if (champIdx >= 0) {
      // The champion-to-be wins its group.
      order = [champIdx, ...byRank.filter((i) => i !== champIdx)];
    } else {
      const gap12 = teams[order[1]].fifa_ranking - teams[order[0]].fifa_ranking;
      const gap23 = teams[order[2]].fifa_ranking - teams[order[1]].fifa_ranking;
      if (gap12 <= 8 && rand("gw:" + letter) < 0.3) {
        [order[0], order[1]] = [order[1], order[0]]; // runner-up wins the group
      } else if (gap23 <= 9 && rand("g2:" + letter) < 0.55) {
        [order[1], order[2]] = [order[2], order[1]]; // underdog grabs 2nd
      }
    }

    const scores = GROUP_MATCH_PAIRS.map(([i, j]) =>
      predictMatchScore(teams[i].fifa_ranking, teams[j].fifa_ranking, `${letter}:${i}:${j}`),
    );
    groupPredictions[letter] = { order, scores };

    const top = teams[order[0]];
    const second = teams[order[1]];
    const upset = order[0] !== byRank[0] || order[1] !== byRank[1];
    rationale.push(
      `בית ${letter}: ${top.name_he} (#${top.fifa_ranking}) ראשון, ${second.name_he} (#${second.fifa_ranking}) שני${upset ? " — הפתעה קטנה: עקפו את הדירוג כי הפער קטן." : "."}`,
    );
  }

  // ---------- Knockout ----------
  const knockout: BotPrediction["knockout_tree"] = {};
  let upsetBudget = 3; // bounded early-round dark-horse upsets

  function koDecide(t1: string, t2: string, key: string): string {
    if (t1 === championTarget) return t1;
    if (t2 === championTarget) return t2;
    const fav = rankOf(t1) <= rankOf(t2) ? t1 : t2;
    const dog = fav === t1 ? t2 : t1;
    const gap = Math.abs(rankOf(t1) - rankOf(t2));
    const stage = koStage(key);
    const early = stage === "R32" || stage === "R16";
    if (early && upsetBudget > 0 && gap <= 10 && rand("ko:" + key) < 0.4) {
      upsetBudget--;
      return dog;
    }
    return fav;
  }

  function koScore(t1: string, winner: string, key: string): { score1: number; score2: number } {
    // Cosmetic winner-consistent scoreline (Tree-1 simulation scores earn 0 pts;
    // only the winner feeds advancement).
    const margin = rand("kom:" + key) < 0.5 ? 1 : 2;
    const loser = rand("kol:" + key) < 0.45 ? 1 : 0;
    const wg = loser + margin;
    return winner === t1 ? { score1: wg, score2: loser } : { score1: loser, score2: wg };
  }

  // R32: resolve each slot from group predictions, then decide the winner.
  for (const [key, { h, a }] of Object.entries(R32_MATCHUPS)) {
    const t1 = resolveGroupSlot(h, groupPredictions);
    const t2 = resolveGroupSlot(a, groupPredictions);
    if (!t1 || !t2) continue;
    const winner = koDecide(t1, t2, key);
    knockout[key] = { ...koScore(t1, winner, key), winner };
  }

  // Later rounds: cascade winners.
  const laterOrder = ["r16l_0", "r16l_1", "r16l_2", "r16l_3", "r16r_0", "r16r_1", "r16r_2", "r16r_3",
                      "qfl_0", "qfl_1", "qfr_0", "qfr_1",
                      "sfl_0", "sfr_0", "final"];
  for (const key of laterOrder) {
    const [f1, f2] = LATER_FEEDERS[key] || [];
    const t1 = knockout[f1]?.winner;
    const t2 = knockout[f2]?.winner;
    if (!t1 || !t2) continue;
    const winner = koDecide(t1, t2, key);
    knockout[key] = { ...koScore(t1, winner, key), winner };
  }

  const champion = knockout["final"]?.winner ?? championTarget;
  const championTeam = getTeamByCode(champion);

  // Third place qualifiers (3rd of the 8 best-avg-rank groups).
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
  // Top scorer / assists: combine how far the player's team reaches with star
  // reputation, then pick the SECOND-best candidate (a less-obvious, still
  // credible shout — a real bettor doesn't always take the chalk striker).
  const scorerCandidates = Object.entries(TEAM_STAR).map(([code, star]) => {
    const depth = teamFinalRound(code, knockout);
    return { code, player: star.scorer, rep: star.scorerRep, depth: depth.round, depthLabel: depth.label };
  }).sort((a, b) => (b.depth * 30 + b.rep) - (a.depth * 30 + a.rep));

  const assistsCandidates = Object.entries(TEAM_STAR).map(([code, star]) => {
    const depth = teamFinalRound(code, knockout);
    return { code, player: star.assists, rep: star.assistsRep, depth: depth.round, depthLabel: depth.label };
  }).sort((a, b) => (b.depth * 30 + b.rep) - (a.depth * 30 + a.rep));

  const topPick = scorerCandidates[1] ?? scorerCandidates[0];
  const topScorer = topPick.player;
  const topScorerTeam = topPick.code;

  const assistsPick = assistsCandidates.find((a) => a.player !== topPick.player && a.code !== topPick.code)
    ?? assistsCandidates[1] ?? assistsCandidates[0];
  const topAssists = assistsPick.player;
  const topAssistsTeam = assistsPick.code;

  rationale.push(
    `מלך שערים: ${topScorer} (${topScorerTeam}) — בחירה לא טריוויאלית: ${getTeamByCode(topPick.code)?.name_he} מגיעה עד ${topPick.depthLabel}, דירוג כוכב ${topPick.rep}/100.`,
  );
  rationale.push(
    `מלך בישולים: ${topAssists} (${topAssistsTeam}) — ${getTeamByCode(assistsPick.code)?.name_he} עד ${assistsPick.depthLabel}, יצירתיות ${assistsPick.rep}/100.`,
  );

  // Best attack = the dark-horse champion (most games + the run that surprised).
  const bestAttackTeam = champion;
  rationale.push(`התקפה הטובה: ${championTeam?.name_he} — הריצה עד האליפות = הכי הרבה שערים בדרך.`);

  const mostProlificGroup = groupsRanked[0].letter;
  const driestGroup = groupsRanked[groupsRanked.length - 1].letter;
  rationale.push(`בית פורה: ${mostProlificGroup} (ממוצע דירוג ${groupsRanked[0].avg.toFixed(0)}); בית יבש: ${driestGroup} (${groupsRanked[groupsRanked.length - 1].avg.toFixed(0)}).`);

  const dirtiest = "URU";
  rationale.push(`כסחנית: אורוגוואי — נבחרת פיזית, מהמובילות בכרטיסים במונדיאל 2022.`);

  // Matchups — decide by each player's team's predicted depth.
  const matchupLogic = MATCHUP_PLAYERS.map((mu) => {
    const d1 = teamFinalRound(mu.team1, knockout);
    const d2 = teamFinalRound(mu.team2, knockout);
    let pick: "1" | "X" | "2";
    let note: string;
    if (mu.team1 === mu.team2) {
      pick = "X";
      note = `שניהם מ${getTeamByCode(mu.team1)?.name_he} — סביר לתיקו.`;
    } else if (d1.round > d2.round) {
      pick = "1";
      note = `${mu.p1} → ${d1.label}, ${mu.p2} → ${d2.label}.`;
    } else if (d2.round > d1.round) {
      pick = "2";
      note = `${mu.p2} → ${d2.label}, ${mu.p1} → ${d1.label}.`;
    } else {
      const rep1 = TEAM_STAR[mu.team1]?.scorerRep ?? 70;
      const rep2 = TEAM_STAR[mu.team2]?.scorerRep ?? 70;
      pick = rep1 >= rep2 ? "1" : "2";
      note = `שתיהן ל${d1.label}; הוכרע לפי דירוג כוכב.`;
    }
    return { pick, note };
  });
  const matchupPick = joinMatchupPicks(matchupLogic.map((m) => m.pick));
  rationale.push("מאצ׳אפים:");
  matchupLogic.forEach((m, i) => rationale.push(`  ${i + 1}. ${m.note} → ${m.pick}`));

  const penalties = "OVER";
  rationale.push(`פנדלים: מעל ${PENALTIES_LINE} — 104 משחקים + שלבי נוקאאוט = הרבה פנדלים (כולל הארכות, ללא דו-קרב פנדלים).`);

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
