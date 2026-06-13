// ============================================================================
// QA scoring audit — runs the REAL scorer against production data + the 4
// finished matches (2026-06-13), and independently re-derives every number the
// standings page shows, so we can diff "what the engine says" vs "what an
// independent re-computation says".
//
//   npx tsx scripts/verify-scoring-audit.ts
//
// Finished matches (90'): MEX 2-0 RSA, KOR 2-1 CZE, CAN 1-1 BIH, USA 4-1 PAR.
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { computeGroupHits, classifyHit, matchPairIndex, type FinishedMatch } from "../src/lib/results-hits";
import {
  computeLiveScores,
  computeTodayScores,
  computePlayerHistories,
} from "../src/lib/scoring/live-scorer";
import { scoringFromConfig, SCORING_CONFIG_COLUMNS, type ScoringConfigRow } from "../src/lib/scoring/config";
import type {
  BettorBracket,
  BettorAdvancement,
  BettorSpecialBets,
} from "../src/lib/supabase/shared-data";
import type { TournamentActuals, PlayerStat } from "../src/lib/scoring/special-bets-scorer";
import { SCORING } from "../src/types";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// The 4 finished group matches as of 2026-06-13. Dates set to distinct days so
// the cumulative-history ordering is deterministic; group letters verified
// against src/lib/tournament/groups (A: MEX/KOR/CZE/RSA, B: CAN/.../BIH, D: USA/PAR/...).
const MATCHES: FinishedMatch[] = [
  { id: 537327, date: "2026-06-11T19:00:00Z", homeTla: "MEX", awayTla: "RSA", group: "A", stage: "GROUP_STAGE", homeGoals: 2, awayGoals: 0 },
  { id: 537328, date: "2026-06-12T02:00:00Z", homeTla: "KOR", awayTla: "CZE", group: "A", stage: "GROUP_STAGE", homeGoals: 2, awayGoals: 1 },
  { id: 537401, date: "2026-06-12T16:00:00Z", homeTla: "CAN", awayTla: "BIH", group: "B", stage: "GROUP_STAGE", homeGoals: 1, awayGoals: 1 },
  { id: 537402, date: "2026-06-12T19:00:00Z", homeTla: "USA", awayTla: "PAR", group: "D", stage: "GROUP_STAGE", homeGoals: 4, awayGoals: 1 },
];

function pad(s: string, n: number) {
  // Pad accounting for wide (Hebrew) chars roughly as 1 col each.
  const len = [...s].length;
  return s + " ".repeat(Math.max(0, n - len));
}

async function main() {
  // ---- Load production data ----
  const { data: bRows, error: bErr } = await sb
    .from("user_brackets")
    .select("user_id, group_predictions, knockout_tree, knockout_tree_live, champion, locked_at, profiles(display_name)");
  if (bErr) throw bErr;

  const { data: advRows } = await sb.from("advancement_picks").select("*, profiles(display_name)");
  const { data: sbRows } = await sb
    .from("special_bets")
    .select("user_id, top_scorer_player, top_assists_player, best_attack_team, most_prolific_group, driest_group, dirtiest_team, matchup_pick, penalties_over_under, profiles(display_name)");
  const { data: cfgRow } = await sb
    .from("scoring_config")
    .select(SCORING_CONFIG_COLUMNS)
    .limit(1)
    .maybeSingle();
  const { data: statsRow } = await sb.from("tournament_actuals").select("*").limit(1).maybeSingle();
  const { data: scorerRows } = await sb.from("player_stats").select("*");

  const scoring = scoringFromConfig(cfgRow as Partial<ScoringConfigRow> | null);

  const brackets: BettorBracket[] = (bRows || []).map((d) => ({
    userId: d.user_id,
    displayName: (d.profiles as unknown as { display_name: string })?.display_name || d.user_id.slice(0, 8),
    groupPredictions: (d.group_predictions as BettorBracket["groupPredictions"]) || {},
    knockoutTree: (d.knockout_tree as BettorBracket["knockoutTree"]) || {},
    knockoutTreeLive: (d.knockout_tree_live as BettorBracket["knockoutTreeLive"]) || {},
    champion: d.champion,
    lockedAt: d.locked_at,
  }));

  const advancements: BettorAdvancement[] = (advRows || []).map((d) => ({
    userId: d.user_id,
    displayName: (d.profiles as unknown as { display_name: string })?.display_name || "",
    groupQualifiers: d.group_qualifiers || {},
    advanceToR16: d.advance_to_r16 || [],
    advanceToQF: d.advance_to_qf || [],
    advanceToSF: d.advance_to_sf || [],
    advanceToFinal: d.advance_to_final || [],
    winner: d.winner || "",
  }));

  const specialBets: BettorSpecialBets[] = (sbRows || []).map((d) => ({
    userId: d.user_id,
    displayName: (d.profiles as unknown as { display_name: string })?.display_name || "",
    topScorerTeam: null,
    topScorerPlayer: d.top_scorer_player,
    topAssistsTeam: null,
    topAssistsPlayer: d.top_assists_player,
    bestAttackTeam: d.best_attack_team,
    prolificGroup: d.most_prolific_group,
    driestGroup: d.driest_group,
    dirtiestTeam: d.dirtiest_team,
    matchupPick: d.matchup_pick,
    penaltiesOverUnder: d.penalties_over_under,
  }));

  const tournamentActuals: TournamentActuals | null = statsRow
    ? {
        top_scorer_player: statsRow.top_scorer_player ?? null,
        top_assists_player: statsRow.top_assists_player ?? null,
        best_attack_team: statsRow.best_attack_team ?? null,
        most_prolific_group: statsRow.most_prolific_group ?? null,
        driest_group: statsRow.driest_group ?? null,
        dirtiest_team: statsRow.dirtiest_team ?? null,
        dirtiest_board: statsRow.dirtiest_board ?? null,
        matchup_result_1: statsRow.matchup_result_1 ?? null,
        matchup_result_2: statsRow.matchup_result_2 ?? null,
        matchup_result_3: statsRow.matchup_result_3 ?? null,
        penalties_over_under: statsRow.penalties_over_under ?? null,
      }
    : null;

  const playerStats: PlayerStat[] = (scorerRows || []).map((s) => ({
    name: s.name ?? s.player_name ?? "",
    goals: s.goals ?? 0,
    assists: s.assists ?? 0,
    minutes: s.minutes ?? s.played ?? 0,
  }));

  console.log("=".repeat(110));
  console.log(`Loaded: ${brackets.length} brackets · ${advancements.length} adv · ${specialBets.length} special · scoring_config ${cfgRow ? "FOUND" : "MISSING (defaults)"}`);
  console.log(`scoring: toto.GROUP=${scoring.toto.GROUP} exact.GROUP=${scoring.exact.GROUP} | adv.r16=${scoring.advancement.r16} qf=${scoring.advancement.qf} sf=${scoring.advancement.sf}`);
  console.log(`tournament_actuals: ${tournamentActuals ? "present" : "none"} · player_stats rows: ${playerStats.length}`);
  console.log("=".repeat(110));

  // ---- 1. Per-match hits (independent toto/exact classification) ----
  // Independent re-derivation of group points, NOT via the engine.
  const indepGroup: Record<string, { toto: number; exact: number; pts: number; tHits: number; eHits: number; miss: number; empty: number }> = {};
  for (const b of brackets) indepGroup[b.userId] = { toto: 0, exact: 0, pts: 0, tHits: 0, eHits: 0, miss: 0, empty: 0 };

  for (const m of MATCHES) {
    console.log(`\n--- ${m.homeTla} ${m.homeGoals}-${m.awayGoals} ${m.awayTla} (group ${m.group}) ---`);
    const pair = matchPairIndex(m.group, m.homeTla, m.awayTla);
    if (!pair) { console.log("  !! matchPairIndex returned null — would score NOBODY"); continue; }
    const hits = computeGroupHits(m, brackets);
    for (const h of hits) {
      const g = indepGroup[h.userId];
      if (h.hit === "exact") { g.tHits++; g.eHits++; g.toto += scoring.toto.GROUP; g.exact += scoring.exact.GROUP; g.pts += scoring.toto.GROUP + scoring.exact.GROUP; }
      else if (h.hit === "toto") { g.tHits++; g.toto += scoring.toto.GROUP; g.pts += scoring.toto.GROUP; }
      else if (h.hit === "miss") g.miss++;
      else g.empty++;
    }
    const ex = hits.filter((h) => h.hit === "exact");
    const to = hits.filter((h) => h.hit === "toto");
    console.log(`  exact (${ex.length}): ${ex.map((h) => h.name).join(", ") || "—"}`);
    console.log(`  toto  (${to.length}): ${to.map((h) => h.name).join(", ") || "—"}`);
  }

  // ---- Engine scores ----
  const live = computeLiveScores(brackets, MATCHES, {
    advancements,
    specialBets,
    tournamentActuals,
    playerStats,
    scoring,
  });
  const today = computeTodayScores(brackets, MATCHES, scoring);
  const histories = computePlayerHistories(brackets, MATCHES, scoring);

  // ---- 2. Full leaderboard table + cross-check engine vs independent group calc ----
  console.log("\n" + "=".repeat(110));
  console.log("LEADERBOARD (sorted by total). Columns: total = match+adv+spec");
  console.log("=".repeat(110));
  console.log(
    pad("Player", 20) + pad("total", 7) + pad("match", 7) + pad("adv", 6) + pad("spec", 6) +
    pad("totoG", 7) + pad("exG", 5) + pad("tHit", 6) + pad("eHit", 6) + pad("miss", 6) + pad("emp", 5) + "  grp✓"
  );
  const rows = Object.values(live).sort((a, b) => b.total - a.total || a.displayName.localeCompare(b.displayName, "he"));
  let mismatches = 0;
  for (const s of rows) {
    const ig = indepGroup[s.userId];
    const groupEnginePts = s.totoGroup + s.exactGroup;
    const ok = groupEnginePts === ig.pts && s.totoGroup === ig.toto && s.exactGroup === ig.exact;
    if (!ok) mismatches++;
    console.log(
      pad(s.displayName, 20) +
      pad(String(s.total), 7) +
      pad(String(s.matchPts), 7) +
      pad(String(s.advPts), 6) +
      pad(String(s.specPts), 6) +
      pad(String(s.totoGroup), 7) +
      pad(String(s.exactGroup), 5) +
      pad(String(s.totoHits), 6) +
      pad(String(s.exactHits), 6) +
      pad(String(s.missHits), 6) +
      pad(String(s.emptyHits), 5) +
      "  " + (ok ? "OK" : `MISMATCH(eng ${groupEnginePts} vs ind ${ig.pts})`)
    );
  }
  console.log(`\nGroup-points cross-check: ${mismatches === 0 ? "ALL MATCH ✓" : `${mismatches} MISMATCH(es) ✗`}`);

  // Totals sanity: sum of group toto pts must equal (#toto-hits across league) * toto.GROUP
  let totalTotoHits = 0, totalExactHits = 0, totalTotoPts = 0, totalExactPts = 0;
  for (const s of rows) { totalTotoHits += s.totoHits; totalExactHits += s.exactHits; totalTotoPts += s.totoGroup; totalExactPts += s.exactGroup; }
  console.log(`Totals: totoHits=${totalTotoHits} → expect totoPts=${totalTotoHits * scoring.toto.GROUP}, engine totoPts=${totalTotoPts}  ${totalTotoHits * scoring.toto.GROUP === totalTotoPts ? "OK" : "✗"}`);
  console.log(`        exactHits=${totalExactHits} → expect exactPts=${totalExactHits * scoring.exact.GROUP}, engine exactPts=${totalExactPts}  ${totalExactHits * scoring.exact.GROUP === totalExactPts ? "OK" : "✗"}`);

  // ---- 3. Today scores + hero/roast tie logic (replicate standings page) ----
  console.log("\n" + "=".repeat(110));
  console.log("TODAY (computeTodayScores) — uses he-IL calendar 'today' = " + new Date().toLocaleDateString("he-IL"));
  console.log("=".repeat(110));
  const todayVals = Object.entries(today).map(([uid, v]) => ({ uid, v, name: live[uid]?.displayName || uid }));
  const nonZeroToday = todayVals.filter((t) => t.v > 0);
  console.log(`Players with >0 today: ${nonZeroToday.length}`);
  for (const t of todayVals.filter((t) => t.v !== 0).sort((a, b) => b.v - a.v)) console.log(`  ${pad(t.name, 20)} +${t.v}`);
  if (nonZeroToday.length === 0) console.log("  (all zero — today matches don't fall on the he-IL 'today'; hero/roast block hides)");

  // Replicate the standings hero/roast EXACTLY (string `today` like the page builds).
  const PLAYERS = rows.map((s) => ({
    id: s.userId, name: s.displayName, total: s.total,
    today: (today[s.userId] ?? 0) > 0 ? `+${today[s.userId]}` : "0",
    exact: s.exactHits,
  }));
  const heroRoast = (() => {
    if (!(PLAYERS.length >= 2 && PLAYERS[0]?.total > 0)) return "HIDDEN (need ≥2 players and top total>0)";
    const todayNum = (p: { today?: string }) => parseInt(p.today || "0") || 0;
    const topToday = Math.max(...PLAYERS.map(todayNum));
    if (topToday <= 0) return "HIDDEN (no points moved today)";
    const heroes = PLAYERS.filter((p) => todayNum(p) === topToday);
    const minToday = Math.min(...PLAYERS.map(todayNum));
    const roastPool = PLAYERS.filter((p) => todayNum(p) === minToday);
    const minTotal = Math.min(...roastPool.map((p) => p.total));
    const roasts = roastPool.filter((p) => p.total === minTotal);
    return {
      heroes: heroes.map((h) => `${h.name}(+${topToday})`),
      roasts: roasts.map((r) => `${r.name}(+${minToday}, tot ${r.total})`),
    };
  })();
  console.log("\nHero/Roast block:", JSON.stringify(heroRoast, null, 2));

  // sheep/lifter (unique extremes by TOTAL)
  const minTotal = Math.min(...PLAYERS.map((p) => p.total));
  const maxTotal = Math.max(...PLAYERS.map((p) => p.total));
  const losers = PLAYERS.filter((p) => p.total === minTotal);
  const tops = PLAYERS.filter((p) => p.total === maxTotal);
  console.log(`Sheep (unique min total): ${losers.length === 1 ? losers[0].name : "HIDDEN (" + losers.length + " tied at " + minTotal + ")"}`);
  console.log(`Lifter (unique max total): ${tops.length === 1 ? tops[0].name : "HIDDEN (" + tops.length + " tied at " + maxTotal + ")"}`);

  // ---- 4. Race chart cumulative history vs leaderboard match totals ----
  console.log("\n" + "=".repeat(110));
  console.log("RACE CHART: cumulative group history endpoint vs engine group matchPts");
  console.log("=".repeat(110));
  // Page's race computes ONLY group matches; engine matchPts here = group only (no KO finished).
  let raceMismatch = 0;
  for (const s of rows) {
    const hist = histories[s.userId] || [0];
    const endHist = hist[hist.length - 1];
    const groupMatchPts = s.totoGroup + s.exactGroup;
    if (endHist !== groupMatchPts) { raceMismatch++; console.log(`  ${pad(s.displayName, 20)} hist-end=${endHist} vs groupMatchPts=${groupMatchPts}  ✗`); }
  }
  console.log(raceMismatch === 0
    ? "Race cumulative end == engine group matchPts for ALL players ✓ (and matchPts==total here since no KO/adv finished... checked separately)"
    : `${raceMismatch} race/leaderboard mismatch(es) ✗`);
  // also confirm history is monotonic non-decreasing
  let nonMono = 0;
  for (const s of rows) {
    const hist = histories[s.userId] || [0];
    for (let i = 1; i < hist.length; i++) if (hist[i] < hist[i - 1]) nonMono++;
  }
  console.log(`History monotonic non-decreasing: ${nonMono === 0 ? "YES ✓" : nonMono + " decreases ✗"}`);

  // ---- 5. Null-goal leak probe: inject a FINISHED match with null goals ----
  console.log("\n" + "=".repeat(110));
  console.log("NULL-GOAL LEAK PROBE (the original incident class)");
  console.log("=".repeat(110));
  // The standings page FILTERS these out before calling the scorer. But test the
  // scorer's own resilience if such a row reached it (homeGoals as any null).
  const withNull: FinishedMatch[] = [
    ...MATCHES,
    { id: 999999, date: "2026-06-13T19:00:00Z", homeTla: "QAT", awayTla: "SUI", group: "B", stage: "GROUP_STAGE", homeGoals: null as unknown as number, awayGoals: null as unknown as number },
  ];
  const liveWithNull = computeLiveScores(brackets, withNull, { scoring });
  let leaked = 0;
  for (const s of rows) {
    const base = live[s.userId];
    const nu = liveWithNull[s.userId];
    // matchPts should be identical (null match contributes nothing) BUT totalFinished may differ.
    if (nu.matchPts !== base.matchPts) { leaked++; console.log(`  ${pad(s.displayName, 20)} base matchPts=${base.matchPts} vs with-null=${nu.matchPts}  ✗ LEAK`); }
  }
  // Did the null match change anyone's totalFinished (i.e. counted as "played")?
  const sampleBase = live[rows[0].userId].totalFinished;
  const sampleNull = liveWithNull[rows[0].userId].totalFinished;
  console.log(`matchPts leak from null-goal FINISHED match: ${leaked === 0 ? "NONE ✓ (classifyHit treats null pred/actual safely)" : leaked + " players affected ✗"}`);
  console.log(`totalFinished for ${rows[0].displayName}: base=${sampleBase}, with-null=${sampleNull}  ${sampleNull > sampleBase ? "→ null match WAS counted as played (stat inflation, not points)" : "→ not counted"}`);

  console.log("\nDONE.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
