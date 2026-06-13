// ============================================================================
// amitanalysis/engine — WC2026 Monte-Carlo + per-bet EV engine (Amit's slip)
//
// Pipeline (Groll/Zeileis-style, market-calibrated):
//   1. Team strength ratings, calibrated by iterative simulation so the sim
//      reproduces (a) de-vigged bookmaker GROUP-WINNER probabilities for all 48
//      teams and (b) a blended CHAMPION target (market + model-consensus + the
//      Kimi report) for the top teams.
//   2. Bivariate-ish independent-Poisson scoreline model from rating diffs.
//   3. Monte-Carlo the whole tournament, REUSING the repo's authoritative
//      thirds-ranker + Annex-C assignment + R32 bracket topology, so the bracket
//      that the sim plays out is the SAME one that scores Amit's bets.
//   4. Accumulate every probability Amit's bets depend on, then compute
//      E[points] per bet under the LIVE scoring_config, plus the EV-optimal
//      alternative for each (the basis of the change-list).
//
//   Run:  npx tsx amitanalysis/engine/run.ts [N]
// ============================================================================
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { GROUPS, GROUP_LETTERS } from "../../src/lib/tournament/groups";
import { rankBestThirds, type ThirdsInputRow } from "../../src/lib/tournament/thirds-ranker";
import { getThirdsAssignment } from "../../src/lib/tournament/annex-c";
import { buildR32Matchups, LATER_FEEDERS } from "../../src/lib/tournament/knockout-derivation";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, "..", "data");
const OUT = path.join(__dirname, "..");
const load = (p: string) => JSON.parse(readFileSync(p, "utf8"));

const N = parseInt(process.argv[2] || "150000", 10);
const PENALTIES_LINE = 21.5;

// ---- data ----
const odds = load(path.join(DATA, "odds-market.json"));
const models = load(path.join(DATA, "models.json"));
const report = load(path.join(DATA, "report-data.json"));
const scoring = load(path.join(DATA, "scoring-config.json"));
const raw = load(path.join(OUT, "amit-bets.raw.json"));
const bets = {
  groups: raw.user_brackets.group_predictions as Record<string, { order: number[]; scores: { home: number; away: number }[] }>,
  adv: raw.advancement_picks as {
    group_qualifiers: Record<string, string[]>;
    advance_to_r16: string[]; advance_to_qf: string[]; advance_to_sf: string[]; advance_to_final: string[];
    winner: string;
  },
  special: raw.special_bets as Record<string, string | null>,
  champion: raw.user_brackets.champion as string,
};

// ---- teams ----
interface Team { code: string; name: string; group: string; idx: number; fifa: number; }
const TEAMS: Team[] = [];
const codeToTeam: Record<string, Team> = {};
for (const L of GROUP_LETTERS) {
  GROUPS[L].forEach((t, i) => {
    const tm: Team = { code: t.code, name: t.name, group: L, idx: i, fifa: t.fifa_ranking ?? 50 };
    TEAMS.push(tm); codeToTeam[t.code] = tm;
  });
}
const num = (v: unknown): number | null =>
  typeof v === "number" ? v : (v && typeof v === "object" && "impliedDevig" in (v as any)) ? (v as any).impliedDevig : null;

// ---- targets ----
// group-winner target per team (market, de-vigged, sums to 1 within group)
const gwTarget: Record<string, number> = {};
for (const L of GROUP_LETTERS) {
  const g = odds.group_winner?.[L] || {};
  for (const t of GROUPS[L]) gwTarget[t.code] = num(g[t.code]) ?? 0.05;
}
// champion blend target = mean of {market devig, model consensus, report} where present
const champTarget: Record<string, number> = {};
for (const t of TEAMS) {
  const vals: number[] = [];
  const mk = num(odds.outright_winner?.bookmaker_consensus?.[t.code]); if (mk != null) vals.push(mk);
  const mc = models.consensus_champion_pct?.[t.code]; if (mc != null) vals.push(mc / 100);
  const rp = report.championship_pct?.[t.code]; if (rp != null) vals.push(rp / 100);
  if (vals.length) champTarget[t.code] = vals.reduce((a, b) => a + b, 0) / vals.length;
}
// normalize champion target to sum 1 across all teams (residual mass to unlisted via tiny floor)
{
  let s = 0; for (const c in champTarget) s += champTarget[c];
  for (const c in champTarget) champTarget[c] /= s;
}

// ---- RNG (seeded mulberry32) ----
let _seed = 0x9e3779b9 >>> 0;
function rng(): number {
  _seed |= 0; _seed = (_seed + 0x6D2B79F5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function poisson(lambda: number): number {
  // Knuth; lambda is small (<5) here.
  const L = Math.exp(-lambda); let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

// ---- match model ----
const BASE = Math.log(1.32); // ~avg goals per team
const SPREAD = 1.0;          // strength scale absorbed into ratings during calibration
function lambdas(sH: number, sA: number): [number, number] {
  const d = SPREAD * (sH - sA);
  const lh = Math.min(5, Math.max(0.12, Math.exp(BASE + d)));
  const la = Math.min(5, Math.max(0.12, Math.exp(BASE - d)));
  return [lh, la];
}
// knockout: sample a winner (regulation Poisson; draw → shootout via gentle logistic)
function sampleKOWinner(a: string, b: string, s: Record<string, number>): string {
  const [la, lb] = lambdas(s[a], s[b]);
  const ga = poisson(la), gb = poisson(lb);
  if (ga > gb) return a;
  if (gb > ga) return b;
  const pa = 1 / (1 + Math.exp(-0.45 * (s[a] - s[b])));
  return rng() < pa ? a : b;
}

// ---- fast group standings (points, GD, GF, then rating) ----
const FIX: [number, number][] = [[0, 1], [2, 3], [0, 2], [3, 1], [3, 0], [1, 2]];
function simGroup(L: string, s: Record<string, number>): {
  order: string[]; thirdRow: ThirdsInputRow; goals: number; teamGoals: Record<string, number>;
} {
  const codes = GROUPS[L].map(t => t.code);
  const pts = [0, 0, 0, 0], gf = [0, 0, 0, 0], ga = [0, 0, 0, 0];
  let totalGoals = 0;
  for (const [h, a] of FIX) {
    const [lh, la] = lambdas(s[codes[h]], s[codes[a]]);
    const gh = poisson(lh), gaa = poisson(la);
    gf[h] += gh; ga[h] += gaa; gf[a] += gaa; ga[a] += gh; totalGoals += gh + gaa;
    if (gh > gaa) pts[h] += 3; else if (gaa > gh) pts[a] += 3; else { pts[h]++; pts[a]++; }
  }
  const idx = [0, 1, 2, 3].sort((x, y) => {
    if (pts[y] !== pts[x]) return pts[y] - pts[x];
    const gdx = gf[x] - ga[x], gdy = gf[y] - ga[y];
    if (gdy !== gdx) return gdy - gdx;
    if (gf[y] !== gf[x]) return gf[y] - gf[x];
    return s[codes[y]] - s[codes[x]]; // final tiebreak by strength (stand-in for H2H/FIFA)
  });
  const order = idx.map(i => codes[i]);
  const t3 = idx[2];
  const teamGoals: Record<string, number> = {};
  for (let i = 0; i < 4; i++) teamGoals[codes[i]] = gf[i];
  return {
    order,
    thirdRow: {
      group: L, team_code: codes[t3], played: 3, points: pts[t3],
      goal_difference: gf[t3] - ga[t3], goals_for: gf[t3], fair_play_score: 0,
      fifa_ranking: codeToTeam[codes[t3]].fifa,
    },
    goals: totalGoals, teamGoals,
  };
}

// ---- accumulators ----
interface Acc {
  pos: Record<string, [number, number, number, number]>; // group finish 1/2/3/4
  third8: Record<string, number>;   // qualified as best-third
  r16: Record<string, number>; qf: Record<string, number>; sf: Record<string, number>;
  fin: Record<string, number>; champ: Record<string, number>;
  bestAttack: Record<string, number>;
  prolific: Record<string, number>; driest: Record<string, number>;
  n: number;
}
function newAcc(): Acc {
  const z: Record<string, number> = {}, z4: Record<string, [number, number, number, number]> = {};
  for (const t of TEAMS) { z[t.code] = 0; z4[t.code] = [0, 0, 0, 0]; }
  return {
    pos: JSON.parse(JSON.stringify(z4)), third8: { ...z }, r16: { ...z }, qf: { ...z },
    sf: { ...z }, fin: { ...z }, champ: { ...z }, bestAttack: { ...z },
    prolific: Object.fromEntries(GROUP_LETTERS.map(l => [l, 0])),
    driest: Object.fromEntries(GROUP_LETTERS.map(l => [l, 0])), n: 0,
  };
}

function simTournament(s: Record<string, number>, acc: Acc) {
  const orders: Record<string, string[]> = {};
  const thirdRows: ThirdsInputRow[] = [];
  const teamGoals: Record<string, number> = {};
  let prolL = "", prolG = -1, driL = "", driG = 1e9;
  for (const L of GROUP_LETTERS) {
    const r = simGroup(L, s);
    orders[L] = r.order;
    thirdRows.push(r.thirdRow);
    for (const c in r.teamGoals) teamGoals[c] = (teamGoals[c] || 0) + r.teamGoals[c];
    if (acc) {
      for (let p = 0; p < 4; p++) acc.pos[r.order[p]][p]++;
    }
    if (r.goals > prolG) { prolG = r.goals; prolL = L; }
    if (r.goals < driG) { driG = r.goals; driL = L; }
  }
  if (acc) { acc.prolific[prolL]++; acc.driest[driL]++; }

  // best-8 thirds → Annex C → R32 matchups (repo authoritative pipeline)
  const ranking = rankBestThirds(thirdRows);
  if (acc) for (const g of ranking.qualifiedGroups) acc.third8[ranking.teamByGroup[g]]++;
  const { assignment } = getThirdsAssignment(ranking.qualifiedGroups);
  const matchups = buildR32Matchups(assignment || undefined);

  const resolve = (slot: string): string => orders[slot[0]][+slot[1] - 1];
  const winners: Record<string, string> = {};
  // R32
  for (const key of Object.keys(matchups)) {
    const t1 = resolve(matchups[key].h), t2 = resolve(matchups[key].a);
    const w = sampleKOWinner(t1, t2, s);
    winners[key] = w;
    if (acc) acc.r16[w]++; // reached R16 = won R32
  }
  // R16 / QF / SF / Final via repo feeders
  const playFeeder = (key: string, accSet: Record<string, number> | null) => {
    const [f1, f2] = LATER_FEEDERS[key];
    const t1 = winners[f1], t2 = winners[f2];
    const w = sampleKOWinner(t1, t2, s);
    winners[key] = w;
    if (acc && accSet) accSet[w]++;
    return w;
  };
  for (const k of ["r16l_0", "r16l_1", "r16l_2", "r16l_3", "r16r_0", "r16r_1", "r16r_2", "r16r_3"]) playFeeder(k, acc ? acc.qf : null);
  for (const k of ["qfl_0", "qfl_1", "qfr_0", "qfr_1"]) playFeeder(k, acc ? acc.sf : null);
  for (const k of ["sfl_0", "sfr_0"]) playFeeder(k, acc ? acc.fin : null);
  const champ = playFeeder("final", null);
  if (acc) acc.champ[champ]++;

  // best attack = most total goals scored in the tournament
  if (acc) {
    let bestC = "", bestG = -1;
    for (const c in teamGoals) if (teamGoals[c] > bestG) { bestG = teamGoals[c]; bestC = c; }
    acc.bestAttack[bestC]++;
  }
}

function runMC(s: Record<string, number>, n: number): Acc {
  const acc = newAcc();
  for (let i = 0; i < n; i++) simTournament(s, acc);
  acc.n = n;
  return acc;
}

// ---- calibration ----
// rating(team) = level[group] + spread[team], with two decoupled targets:
//   • GROUP-WINNER target → intra-group SPREAD (12 independent 4-team problems;
//     spread re-centered to sum 0 within each group). Sets within-group order,
//     scorelines, qualifiers — which depend only on intra-group differences.
//   • CHAMPION target → 12 group LEVELS (one knob per group), matched to each
//     group's total champion mass (Σ champion-target over its teams). Sets the
//     cross-group / deep-run strength. 12 near-independent knobs ⇒ stable.
function calibrate(): { s: Record<string, number>; level: Record<string, number>; spread: Record<string, number> } {
  const level: Record<string, number> = {}, spread: Record<string, number> = {};
  for (const L of GROUP_LETTERS) {
    const avgFifa = GROUPS[L].reduce((a, t) => a + (t.fifa_ranking ?? 50), 0) / 4;
    level[L] = (40 - avgFifa) * 0.02;
    GROUPS[L].forEach(t => { spread[t.code] = (avgFifa - (t.fifa_ranking ?? 50)) * 0.03; });
  }
  // target champion mass per group
  const massTarget: Record<string, number> = {};
  for (const L of GROUP_LETTERS) massTarget[L] = GROUPS[L].reduce((a, t) => a + (champTarget[t.code] || 0), 0);

  const ITERS = 48, NCAL = 7000, cap = 0.8;
  const clamp = (x: number) => Math.max(-cap, Math.min(cap, x));
  const combine = () => { const s: Record<string, number> = {}; for (const t of TEAMS) s[t.code] = level[t.group] + spread[t.code]; return s; };
  for (let it = 0; it < ITERS; it++) {
    const acc = runMC(combine(), NCAL);
    const n = acc.n, lr = Math.pow(0.965, it);
    const ηs = 0.7 * lr, ηl = 0.7 * lr;
    // spread ← group-winner (per group, re-centered)
    for (const L of GROUP_LETTERS) {
      const codes = GROUPS[L].map(t => t.code);
      const delta = codes.map(c => ηs * clamp(Math.log((gwTarget[c] + 1e-3) / (acc.pos[c][0] / n + 1e-3))));
      const dm = delta.reduce((a, b) => a + b, 0) / 4;
      codes.forEach((c, i) => { spread[c] += delta[i] - dm; });
    }
    // level ← group champion mass
    for (const L of GROUP_LETTERS) {
      const simMass = GROUPS[L].reduce((a, t) => a + acc.champ[t.code] / n, 0);
      level[L] += ηl * clamp(Math.log((massTarget[L] + 2e-3) / (simMass + 2e-3)));
    }
    const gm = GROUP_LETTERS.reduce((a, L) => a + level[L], 0) / GROUP_LETTERS.length;
    for (const L of GROUP_LETTERS) level[L] -= gm;
  }
  return { s: combine(), level, spread };
}

// ---- analytic group scoreline probs from lambdas ----
function poisPmf(k: number, l: number): number { return Math.exp(-l) * Math.pow(l, k) / fact(k); }
function fact(n: number): number { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; }
function scorelineProbs(lh: number, la: number, MAX = 9) {
  let pH = 0, pD = 0, pA = 0; const exact: Record<string, number> = {};
  for (let h = 0; h <= MAX; h++) for (let a = 0; a <= MAX; a++) {
    const p = poisPmf(h, lh) * poisPmf(a, la);
    exact[`${h}-${a}`] = p;
    if (h > a) pH += p; else if (h < a) pA += p; else pD += p;
  }
  return { pH, pD, pA, exact };
}

// ============================================================================
console.error(`[engine] calibrating…`);
const S = calibrate().s;
console.error(`[engine] final MC: ${N.toLocaleString()} sims…`);
const acc = runMC(S, N);
const P = (x: number) => x / acc.n;

// ---- validation: sim champion vs targets ----
const topByChamp = [...TEAMS].sort((a, b) => acc.champ[b.code] - acc.champ[a.code]).slice(0, 10);
const validation = topByChamp.map(t => ({
  code: t.code, simChamp: +(100 * P(acc.champ[t.code])).toFixed(1),
  targetChamp: +((champTarget[t.code] || 0) * 100).toFixed(1),
  market: num(odds.outright_winner?.bookmaker_consensus?.[t.code]) != null ? +(100 * num(odds.outright_winner.bookmaker_consensus[t.code])!).toFixed(1) : null,
  simReachSF: +(100 * P(acc.sf[t.code])).toFixed(1),
  simReachQF: +(100 * P(acc.qf[t.code])).toFixed(1),
}));

// ---- group-winner calibration check (favorite per group: sim vs market) ----
const gwCheck = GROUP_LETTERS.map(L => {
  const codes = GROUPS[L].map(t => t.code);
  const fav = codes.reduce((a, b) => (gwTarget[a] >= gwTarget[b] ? a : b));
  return { group: L, fav, simWin: +(100 * P(acc.pos[fav][0])).toFixed(1), targetWin: +(100 * gwTarget[fav]).toFixed(1) };
});

// ---- per-bet EV ----
const SC = scoring;
const results: any = { meta: { N: acc.n, asOf: "2026-06-10", penaltiesLine: PENALTIES_LINE }, validation, groupWinnerCheck: gwCheck };

// GROUP SCORELINES (analytic)
let groupScoreEV = 0, groupScoreOptEV = 0;
const groupScoreDetail: any[] = [];
for (const L of GROUP_LETTERS) {
  const codes = GROUPS[L].map(t => t.code);
  const g = bets.groups[L];
  g.scores.forEach((sc, fi) => {
    const [hi, ai] = FIX[fi];
    const [lh, la] = lambdas(S[codes[hi]], S[codes[ai]]);
    const sp = scorelineProbs(lh, la);
    const predType = sc.home > sc.away ? "H" : sc.home < sc.away ? "A" : "D";
    const pType = predType === "H" ? sp.pH : predType === "A" ? sp.pA : sp.pD;
    const pExact = sp.exact[`${sc.home}-${sc.away}`] || 0;
    const ev = SC.toto_group * pType + SC.exact_group * pExact;
    // optimal scoreline
    let bestEV = -1, bestHA = "";
    for (let h = 0; h <= 6; h++) for (let a = 0; a <= 6; a++) {
      const t = h > a ? sp.pH : h < a ? sp.pA : sp.pD;
      const e = SC.toto_group * t + SC.exact_group * (sp.exact[`${h}-${a}`] || 0);
      if (e > bestEV) { bestEV = e; bestHA = `${h}-${a}`; }
    }
    groupScoreEV += ev; groupScoreOptEV += bestEV;
    groupScoreDetail.push({
      group: L, fixture: `${codeToTeam[codes[hi]].name} v ${codeToTeam[codes[ai]].name}`,
      pred: `${sc.home}-${sc.away}`, predType, evNow: +ev.toFixed(3),
      bestScore: bestHA, bestEV: +bestEV.toFixed(3), gain: +(bestEV - ev).toFixed(3),
      lambdas: [+lh.toFixed(2), +la.toFixed(2)],
    });
  });
}
results.groupScorelines = { evNow: +groupScoreEV.toFixed(1), evOptimal: +groupScoreOptEV.toFixed(1), detail: groupScoreDetail };

// GROUP QUALIFIERS (advancement order)
let gqEV = 0, gqOptEV = 0; const gqDetail: any[] = [];
for (const L of GROUP_LETTERS) {
  const [p1, p2] = bets.adv.group_qualifiers[L];
  const codes = GROUPS[L].map(t => t.code);
  const Ppos = (c: string, pos: number) => P(acc.pos[c][pos]);
  const Pthird = (c: string) => P(acc.third8[c]);
  const slotEV = (c: string, asFirst: boolean) =>
    SC.group_advance_exact * (asFirst ? Ppos(c, 0) : Ppos(c, 1)) +
    SC.group_advance_partial * (asFirst ? Ppos(c, 1) : Ppos(c, 0)) +
    SC.group_advance_as_3rd * Pthird(c);
  const evNow = slotEV(p1, true) + slotEV(p2, false);
  // optimal (a,b) distinct in group
  let bestEV = -1, bestPair = "";
  for (const a of codes) for (const b of codes) {
    if (a === b) continue;
    const e = slotEV(a, true) + slotEV(b, false);
    if (e > bestEV) { bestEV = e; bestPair = `${a}/${b}`; }
  }
  gqEV += evNow; gqOptEV += bestEV;
  gqDetail.push({
    group: L, pick: `${p1}/${p2}`, evNow: +evNow.toFixed(3),
    best: bestPair, bestEV: +bestEV.toFixed(3), gain: +(bestEV - evNow).toFixed(3),
    probs: Object.fromEntries(codes.map(c => [c, { p1st: +Ppos(c, 0).toFixed(3), p2nd: +Ppos(c, 1).toFixed(3), p3q: +Pthird(c).toFixed(3) }])),
  });
}
results.groupQualifiers = { evNow: +gqEV.toFixed(1), evOptimal: +gqOptEV.toFixed(1), detail: gqDetail };

// ADVANCEMENT REACH LISTS
function reachBlock(picks: string[], probMap: Record<string, number>, value: number, k: number) {
  const evNow = picks.reduce((a, c) => a + value * P(probMap[c]), 0);
  const ranked = [...TEAMS].map(t => ({ code: t.code, p: P(probMap[t.code]) })).sort((a, b) => b.p - a.p);
  const optimal = ranked.slice(0, k);
  const evOpt = optimal.reduce((a, t) => a + value * t.p, 0);
  return {
    evNow: +evNow.toFixed(2), evOptimal: +evOpt.toFixed(2), gain: +(evOpt - evNow).toFixed(2),
    picks: picks.map(c => ({ code: c, p: +P(probMap[c]).toFixed(3) })),
    optimal: optimal.map(t => ({ code: t.code, p: +t.p.toFixed(3) })),
  };
}
results.advanceR16 = reachBlock(bets.adv.advance_to_r16, acc.r16, SC.advance_r16, 16);
results.advanceQF = reachBlock(bets.adv.advance_to_qf, acc.qf, SC.advance_qf, 8);
results.advanceSF = reachBlock(bets.adv.advance_to_sf, acc.sf, SC.advance_sf, 4);
results.advanceFinal = reachBlock(bets.adv.advance_to_final, acc.fin, SC.advance_final, 2);
// winner
{
  const ranked = [...TEAMS].map(t => ({ code: t.code, p: P(acc.champ[t.code]) })).sort((a, b) => b.p - a.p);
  results.winner = {
    pick: bets.adv.winner, pPick: +P(acc.champ[bets.adv.winner]).toFixed(3),
    evNow: +(SC.advance_winner * P(acc.champ[bets.adv.winner])).toFixed(2),
    best: ranked[0].code, evOptimal: +(SC.advance_winner * ranked[0].p).toFixed(2),
    top5: ranked.slice(0, 5).map(t => ({ code: t.code, p: +t.p.toFixed(3) })),
  };
}

// SPECIALS — sim-derived parts + market inputs
const bestAttackRanked = [...TEAMS].map(t => ({ code: t.code, p: P(acc.bestAttack[t.code]) })).sort((a, b) => b.p - a.p);
const prolRanked = GROUP_LETTERS.map(l => ({ g: l, p: P(acc.prolific[l]) })).sort((a, b) => b.p - a.p);
const driRanked = GROUP_LETTERS.map(l => ({ g: l, p: P(acc.driest[l]) })).sort((a, b) => b.p - a.p);
results.specials = {
  best_attack: {
    pick: bets.special.best_attack_team, pSim: +P(acc.bestAttack[bets.special.best_attack_team!]).toFixed(3),
    evNow: +(SC.best_attack * P(acc.bestAttack[bets.special.best_attack_team!])).toFixed(2),
    simTop5: bestAttackRanked.slice(0, 5).map(t => ({ code: t.code, p: +t.p.toFixed(3) })),
    marketTop: odds.best_attack_or_most_goals_team,
  },
  prolific_group: {
    pick: bets.special.most_prolific_group, pSim: +P(acc.prolific[bets.special.most_prolific_group!]).toFixed(3),
    evNow: +(SC.prolific_group * P(acc.prolific[bets.special.most_prolific_group!])).toFixed(2),
    simTop5: prolRanked.slice(0, 5),
  },
  driest_group: {
    pick: bets.special.driest_group, pSim: +P(acc.driest[bets.special.driest_group!]).toFixed(3),
    evNow: +(SC.driest_group * P(acc.driest[bets.special.driest_group!])).toFixed(2),
    simTop5: driRanked.slice(0, 5),
  },
  top_scorer: { pick: bets.special.top_scorer_player, market: odds.top_scorer?.slice(0, 8) },
  top_assists: { pick: bets.special.top_assists_player, market: odds.top_assists?.slice(0, 6) },
  penalties: { pick: bets.special.penalties_over_under, line: PENALTIES_LINE },
};

// HEADLINE expected score (sum of lockable EV; specials computed in report)
results.headline = {
  groupScorelines: results.groupScorelines.evNow,
  groupQualifiers: results.groupQualifiers.evNow,
  advanceR16: results.advanceR16.evNow, advanceQF: results.advanceQF.evNow,
  advanceSF: results.advanceSF.evNow, advanceFinal: results.advanceFinal.evNow,
  winner: results.winner.evNow,
};
results.headline.advancementTotal = +(results.advanceR16.evNow + results.advanceQF.evNow +
  results.advanceSF.evNow + results.advanceFinal.evNow + results.winner.evNow + results.groupQualifiers.evNow).toFixed(1);

writeFileSync(path.join(OUT, "engine-results.json"), JSON.stringify(results, null, 2));

// ---- console summary ----
console.log("\n=== CALIBRATION CHECK (sim champion% vs blended target / market) ===");
for (const v of validation) console.log(`  ${v.code}: sim ${v.simChamp}%  (target ${v.targetChamp}%, market ${v.market ?? "—"}%)  | SF ${v.simReachSF}% QF ${v.simReachQF}%`);
console.log("\n=== GROUP-WINNER CHECK (favorite: sim vs market target) ===");
console.log("  " + gwCheck.map(g => `${g.group}:${g.fav} ${g.simWin}/${g.targetWin}`).join("  "));
console.log("\n=== AMIT EV (points; lockable bets) ===");
console.log(`  Group scorelines (72):  ${results.groupScorelines.evNow}  (optimal ${results.groupScorelines.evOptimal})`);
console.log(`  Group qualifiers:       ${results.groupQualifiers.evNow}  (optimal ${results.groupQualifiers.evOptimal})`);
console.log(`  Advance R16:            ${results.advanceR16.evNow}  (optimal ${results.advanceR16.evOptimal})`);
console.log(`  Advance QF:             ${results.advanceQF.evNow}  (optimal ${results.advanceQF.evOptimal})`);
console.log(`  Advance SF:             ${results.advanceSF.evNow}  (optimal ${results.advanceSF.evOptimal})`);
console.log(`  Advance Final:          ${results.advanceFinal.evNow}  (optimal ${results.advanceFinal.evOptimal})`);
console.log(`  Winner (${results.winner.pick}):           ${results.winner.evNow}  (best ${results.winner.best} ${results.winner.evOptimal})`);
console.log(`  Best attack (${results.specials.best_attack.pick}):  sim P=${results.specials.best_attack.pSim}`);
console.log(`  Prolific grp (${results.specials.prolific_group.pick}): sim P=${results.specials.prolific_group.pSim}  top=${JSON.stringify(results.specials.prolific_group.simTop5.slice(0,3))}`);
console.log(`  Driest grp (${results.specials.driest_group.pick}):   sim P=${results.specials.driest_group.pSim}  top=${JSON.stringify(results.specials.driest_group.simTop5.slice(0,3))}`);
console.log(`\n  wrote engine-results.json (N=${acc.n})`);
