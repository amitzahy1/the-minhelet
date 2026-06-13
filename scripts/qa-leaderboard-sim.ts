// ============================================================================
// QA one-off: reproduce the standings page leaderboard exactly, end to end.
//
//   npx tsx scripts/qa-leaderboard-sim.ts
//
// Mirrors src/app/(app)/standings/page.tsx:
//   1. GET /api/matches from PRODUCTION, apply the page's finishedMatches
//      filter + mapping (FINISHED, non-null goals, normalizeGroupLetter,
//      stage fallback GROUP_STAGE).
//   2. Load profiles / user_brackets / special_bets / advancement_picks /
//      scoring_log / scoring_config from Supabase with the SAME selects +
//      mappings as shared-data.ts & useScoring (scoringFromConfig).
//   3. computeLiveScores with the SAME options object the page passes
//      (advancements, specialBets, tournamentActuals, playerStats,
//      bestThirdsOverride, scoring).
//   4. Rebuild the page's realPlayers rows and print the final table.
//   5. Compare against the expected snapshot, sanity-check
//      computeTodayScores + computePlayerHistories.
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

import { normalizeGroupLetter, type FinishedMatch } from "../src/lib/results-hits";
import {
  computeLiveScores,
  computeTodayScores,
  computePlayerHistories,
} from "../src/lib/scoring/live-scorer";
import {
  scoringFromConfig,
  SCORING_CONFIG_COLUMNS,
  type ScoringConfigRow,
} from "../src/lib/scoring/config";
import { SCORING } from "../src/types";
import type {
  BettorBracket,
  BettorSpecialBets,
  BettorAdvancement,
} from "../src/lib/supabase/shared-data";
import type {
  TournamentActuals,
  PlayerStat,
} from "../src/lib/scoring/special-bets-scorer";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://the-minhelet.vercel.app";

const env = Object.fromEntries(
  readFileSync(resolve(ROOT, ".env.local"), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const sbAnon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Expected snapshot from the prior verification (default scoring, day 2 done).
const EXPECTED: Record<string, number> = {
  "טוביה": 6, "הקוף": 5, "אוהד": 5, "רואי": 4, "רון גל": 4, "בוט": 4,
  "עידן": 3, "ברגמן": 3, "אור": 3, "דור": 2, "עמית": 2, "יוני": 2,
};

interface MatchApi {
  id: number;
  date: string;
  homeTla: string;
  awayTla: string;
  group?: string;
  stage?: string;
  status?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
  winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
}

function pad(s: string, n: number): string {
  // Hebrew-safe-ish padding by code points
  const len = Array.from(s).length;
  return s + " ".repeat(Math.max(0, n - len));
}

async function main() {
  // ---------- (1) /api/matches → finishedMatches, exactly as the page ----------
  const matchesRes = await fetch(`${BASE}/api/matches`).then((r) => r.json()).catch(() => ({ matches: [] }));
  const all: MatchApi[] = matchesRes.matches || [];
  console.log(`/api/matches → ${all.length} matches total`);

  const finishedMatches: FinishedMatch[] = all
    .filter(
      (m) =>
        m.status === "FINISHED" &&
        m.homeGoals !== null && m.homeGoals !== undefined &&
        m.awayGoals !== null && m.awayGoals !== undefined
    )
    .map((m) => ({
      id: m.id,
      date: m.date,
      homeTla: m.homeTla,
      awayTla: m.awayTla,
      group: normalizeGroupLetter(m.group),
      stage: m.stage || "GROUP_STAGE",
      homeGoals: m.homeGoals as number,
      awayGoals: m.awayGoals as number,
      homePenalties: m.homePenalties ?? null,
      awayPenalties: m.awayPenalties ?? null,
      winner: m.winner ?? null,
    }));
  console.log(`finishedMatches (page filter) → ${finishedMatches.length}:`);
  for (const m of finishedMatches) {
    console.log(
      `  #${m.id} ${m.date}  ${m.homeTla} ${m.homeGoals}-${m.awayGoals} ${m.awayTla}` +
      `  group=${m.group || "-"} stage=${m.stage}`
    );
  }

  // ---------- (1b) /api/tournament-stats + /api/best-thirds, as the page ----------
  const statsRes = await fetch(`${BASE}/api/tournament-stats`).then((r) => r.json()).catch(() => null);
  const thirdsRes = await fetch(`${BASE}/api/best-thirds`).then((r) => r.json()).catch(() => ({ override: null }));

  let tournamentActuals: TournamentActuals | null = null;
  if (statsRes?.actuals) {
    const a = statsRes.actuals;
    tournamentActuals = {
      top_scorer_player: a.top_scorer_player ?? null,
      top_assists_player: a.top_assists_player ?? null,
      best_attack_team: a.best_attack_team ?? null,
      most_prolific_group: a.most_prolific_group ?? null,
      driest_group: a.driest_group ?? null,
      dirtiest_team: a.dirtiest_team ?? null,
      dirtiest_board: a.dirtiest_board ?? null,
      matchup_result_1: a.matchup_result_1 ?? null,
      matchup_result_2: a.matchup_result_2 ?? null,
      matchup_result_3: a.matchup_result_3 ?? null,
      penalties_over_under: a.penalties_over_under ?? null,
    };
  }
  let playerStats: PlayerStat[] = [];
  if (Array.isArray(statsRes?.scorers)) {
    playerStats = statsRes.scorers.map(
      (s: { name: string; goals: number; assists?: number; played?: number }) => ({
        name: s.name,
        goals: s.goals ?? 0,
        assists: s.assists ?? 0,
        minutes: s.played ?? 0,
      })
    );
  }
  const overrideRaw = thirdsRes?.override;
  const bestThirdsOverride =
    Array.isArray(overrideRaw) && overrideRaw.length === 8 ? (overrideRaw as string[]) : null;

  console.log(`\n/api/tournament-stats → actuals=${tournamentActuals ? "present" : "null"}, scorers=${playerStats.length}`);
  if (tournamentActuals) {
    const nonNull = Object.entries(tournamentActuals).filter(([, v]) => v !== null && v !== undefined);
    console.log(`  non-null actuals: ${nonNull.length ? nonNull.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(", ") : "(none)"}`);
  }
  console.log(`/api/best-thirds → override=${bestThirdsOverride ? JSON.stringify(bestThirdsOverride) : "null"}`);

  // ---------- (2) Supabase loads — same selects/mappings as shared-data.ts ----------
  const { data: leagueRow, error: leagueErr } = await sb.from("leagues").select("id").limit(1).single();
  if (leagueErr) throw leagueErr;
  const leagueId: string = leagueRow.id;
  console.log(`\nleague_id = ${leagueId}`);

  const [profilesQ, bracketsQ, specialsQ, advQ, logQ, configQ, configAnonQ] = await Promise.all([
    sb.from("profiles").select("id, display_name, avatar_url").order("display_name"),
    sb
      .from("user_brackets")
      .select("user_id, group_predictions, knockout_tree, knockout_tree_live, champion, locked_at, profiles(display_name)")
      .eq("league_id", leagueId),
    sb
      .from("special_bets")
      .select("user_id, top_scorer_team, top_scorer_player, top_assists_team, top_assists_player, best_attack_team, most_prolific_group, driest_group, dirtiest_team, matchup_pick, penalties_over_under, profiles(display_name)")
      .eq("league_id", leagueId),
    sb.from("advancement_picks").select("*, profiles(display_name)").eq("league_id", leagueId),
    sb
      .from("scoring_log")
      .select("user_id, match_id, points, reason, created_at")
      .eq("league_id", leagueId)
      .order("created_at", { ascending: true }),
    sb.from("scoring_config").select(SCORING_CONFIG_COLUMNS).limit(1).maybeSingle(),
    // What the BROWSER's anon-key client would get (RLS view) — the page reads
    // scoring_config through createClient() with the anon key.
    sbAnon.from("scoring_config").select(SCORING_CONFIG_COLUMNS).limit(1).maybeSingle(),
  ]);
  for (const [label, q] of Object.entries({ profiles: profilesQ, brackets: bracketsQ, specials: specialsQ, advancements: advQ, scoring_log: logQ, scoring_config: configQ })) {
    if ((q as { error: unknown }).error) throw new Error(`${label}: ${JSON.stringify((q as { error: unknown }).error)}`);
  }

  const profiles = (profilesQ.data || []).map((p) => ({
    id: p.id as string,
    displayName: (p.display_name as string) || "",
  }));

  const brackets: BettorBracket[] = (bracketsQ.data || []).map((d) => ({
    userId: d.user_id,
    displayName: (d.profiles as unknown as { display_name: string })?.display_name || "",
    groupPredictions: (d.group_predictions as BettorBracket["groupPredictions"]) || {},
    knockoutTree: (d.knockout_tree as BettorBracket["knockoutTree"]) || {},
    knockoutTreeLive: (d.knockout_tree_live as BettorBracket["knockoutTreeLive"]) || {},
    champion: d.champion,
    lockedAt: d.locked_at,
  }));

  const specialBets: BettorSpecialBets[] = (specialsQ.data || []).map((d) => ({
    userId: d.user_id,
    displayName: (d.profiles as unknown as { display_name: string })?.display_name || "",
    topScorerTeam: (d as Record<string, unknown>).top_scorer_team as string ?? null,
    topScorerPlayer: d.top_scorer_player,
    topAssistsTeam: (d as Record<string, unknown>).top_assists_team as string ?? null,
    topAssistsPlayer: d.top_assists_player,
    bestAttackTeam: d.best_attack_team,
    prolificGroup: d.most_prolific_group,
    driestGroup: d.driest_group,
    dirtiestTeam: d.dirtiest_team,
    matchupPick: d.matchup_pick,
    penaltiesOverUnder: d.penalties_over_under,
  }));

  const advancements: BettorAdvancement[] = (advQ.data || []).map((d) => ({
    userId: d.user_id,
    displayName: (d.profiles as unknown as { display_name: string })?.display_name || "",
    groupQualifiers: d.group_qualifiers || {},
    advanceToR16: d.advance_to_r16 || [],
    advanceToQF: d.advance_to_qf || [],
    advanceToSF: d.advance_to_sf || [],
    advanceToFinal: d.advance_to_final || [],
    winner: d.winner || "",
  }));

  const scoringLog = logQ.data || [];

  console.log(`profiles=${profiles.length} brackets=${brackets.length} specials=${specialBets.length} advancements=${advancements.length} scoring_log=${scoringLog.length}`);
  if (scoringLog.length > 0) {
    console.log("  !! scoring_log is NON-EMPTY — the page seeds breakdowns from it before the live overlay");
  }

  // ---------- scoring_config → scoringFromConfig ----------
  const configRow = configQ.data as Partial<ScoringConfigRow> | null;
  const scoring = scoringFromConfig(configRow);
  console.log(`\nscoring_config row (service role): ${configRow ? JSON.stringify(configRow) : "NULL (table empty)"}`);
  console.log(`scoring_config row (anon key, as browser): ${configAnonQ.data ? "readable" : `NOT readable (data=${JSON.stringify(configAnonQ.data)}, error=${JSON.stringify(configAnonQ.error)})`}`);
  // Diff resolved scoring vs the built-in SCORING constant
  const diffs: string[] = [];
  const cmp = (path: string, a: number, b: number) => { if (a !== b) diffs.push(`${path}: resolved=${a} default=${b}`); };
  for (const k of Object.keys(SCORING.toto)) cmp(`toto.${k}`, (scoring.toto as Record<string, number>)[k], (SCORING.toto as Record<string, number>)[k]);
  for (const k of Object.keys(SCORING.exact)) cmp(`exact.${k}`, (scoring.exact as Record<string, number>)[k], (SCORING.exact as Record<string, number>)[k]);
  for (const k of Object.keys(SCORING.advancement)) cmp(`advancement.${k}`, (scoring.advancement as Record<string, number>)[k], (SCORING.advancement as Record<string, number>)[k]);
  for (const k of Object.keys(SCORING.specials)) cmp(`specials.${k}`, (scoring.specials as Record<string, number>)[k], (SCORING.specials as Record<string, number>)[k]);
  for (const k of Object.keys(SCORING.relative_minimums)) cmp(`relative_minimums.${k}`, (scoring.relative_minimums as Record<string, number>)[k], (SCORING.relative_minimums as Record<string, number>)[k]);
  console.log(diffs.length === 0
    ? "resolved scoring === built-in SCORING defaults (no admin overrides in effect)"
    : `resolved scoring DIFFERS from defaults:\n  ${diffs.join("\n  ")}`);

  // ---------- (3) computeLiveScores — same options object as the page ----------
  const liveScores = computeLiveScores(brackets, finishedMatches, {
    advancements,
    specialBets,
    tournamentActuals,
    playerStats,
    bestThirdsOverride,
    scoring,
  });
  const todayScores = computeTodayScores(brackets, finishedMatches, scoring);
  const playerHistories = computePlayerHistories(brackets, finishedMatches, scoring);

  // ---------- (4) Rebuild the page's realPlayers rows ----------
  // (scoring_log seed + live overlay, exactly like realPlayers in page.tsx)
  const REASON_MATCH = new Set(["toto_group", "exact_group", "toto_knockout", "exact_knockout"]);
  const REASON_ADV = new Set(["group_adv_exact", "group_adv_partial", "adv_r16", "adv_qf", "adv_sf", "adv_final", "winner"]);
  const rows = profiles.map((profile) => {
    const live = liveScores[profile.id];
    // scoring_log aggregates (page does this first)
    let logMatch = 0, logAdv = 0, logSpec = 0;
    for (const e of scoringLog.filter((e) => e.user_id === profile.id)) {
      if (REASON_MATCH.has(e.reason)) logMatch += e.points;
      else if (REASON_ADV.has(e.reason)) logAdv += e.points;
      else logSpec += e.points;
    }
    const matchPts = live
      ? live.totoGroup + live.exactGroup + live.totoKnockout + live.exactKnockout
      : logMatch;
    const advPts = live?.advPts ?? logAdv;
    const specPts = live?.specPts ?? logSpec;
    const total = matchPts + advPts + specPts;
    const totoHits = live?.totoHits ?? 0;
    const exactHits = live?.exactHits ?? 0;
    const played = live?.totalFinished ?? 0;
    return {
      id: profile.id,
      name: profile.displayName || "ללא שם",
      matchPts, advPts, specPts, total,
      toto: played > 0 ? `${Math.round((totoHits / played) * 100)}%` : "0%",
      totoHits, exactHits, played,
      today: todayScores[profile.id] ?? 0,
      hasBracket: !!live,
    };
  });

  rows.sort((a, b) => b.total - a.total);

  console.log("\n================ FINAL TABLE (page reproduction, sorted by total) ================");
  console.log(`${pad("#", 3)}${pad("name", 16)}${pad("total", 7)}${pad("match", 7)}${pad("adv", 5)}${pad("spec", 6)}${pad("toto%", 7)}${pad("totoH", 7)}${pad("exactH", 8)}${pad("today", 7)}bracket`);
  rows.forEach((r, i) => {
    console.log(
      `${pad(String(i + 1), 3)}${pad(r.name, 16)}${pad(String(r.total), 7)}${pad(String(r.matchPts), 7)}${pad(String(r.advPts), 5)}${pad(String(r.specPts), 6)}${pad(r.toto, 7)}${pad(String(r.totoHits), 7)}${pad(String(r.exactHits), 8)}${pad(`+${r.today}`, 7)}${r.hasBracket ? "yes" : "NO BRACKET"}`
    );
  });

  // ---------- (5) Compare against the expected snapshot ----------
  console.log("\n================ EXPECTED vs ACTUAL ================");
  const matchName = (expected: string) =>
    rows.find((r) => r.name === expected) ||
    rows.find((r) => r.name.includes(expected) || expected.includes(r.name));
  let deviations = 0;
  for (const [name, expTotal] of Object.entries(EXPECTED)) {
    const row = matchName(name);
    if (!row) { console.log(`  MISSING: expected user "${name}" not found in table`); deviations++; continue; }
    const ok = row.total === expTotal && row.matchPts === expTotal && row.advPts === 0 && row.specPts === 0;
    if (!ok) {
      deviations++;
      console.log(`  DEVIATION: ${name} (matched "${row.name}") expected total=${expTotal} all-matchPts; got total=${row.total} match=${row.matchPts} adv=${row.advPts} spec=${row.specPts}`);
    } else {
      console.log(`  OK: ${name} = ${expTotal} (matchPts only)`);
    }
  }
  const expectedNames = new Set(Object.keys(EXPECTED));
  for (const r of rows) {
    const matched = [...expectedNames].some((n) => r.name === n || r.name.includes(n) || n.includes(r.name));
    if (!matched) { console.log(`  EXTRA user in table not in expected snapshot: "${r.name}" total=${r.total}`); deviations++; }
  }
  console.log(deviations === 0 ? "RESULT: table matches expected snapshot exactly." : `RESULT: ${deviations} deviation(s) — see above.`);

  // ---------- (6) computeTodayScores sanity ----------
  console.log("\n================ computeTodayScores sanity ================");
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const todayLocal = new Date().toLocaleDateString("he-IL");
  console.log(`machine timezone=${tz} (page uses the VIEWER'S local tz, not forced Asia/Jerusalem)`);
  console.log(`today (toLocaleDateString he-IL, local tz) = ${todayLocal}`);
  const todayMatches = finishedMatches.filter((m) => new Date(m.date).toLocaleDateString("he-IL") === todayLocal);
  console.log(`finished matches counted as "today": ${todayMatches.length}`);
  for (const m of todayMatches) {
    console.log(`  #${m.id} ${m.date} → local ${new Date(m.date).toLocaleString("he-IL")}  ${m.homeTla} ${m.homeGoals}-${m.awayGoals} ${m.awayTla}`);
  }
  for (const m of finishedMatches) {
    if (!todayMatches.includes(m)) {
      console.log(`  (not today) #${m.id} ${m.date} → local date ${new Date(m.date).toLocaleDateString("he-IL")}`);
    }
  }
  const nonZeroToday = rows.filter((r) => r.today > 0);
  console.log(`users with today>0: ${nonZeroToday.length ? nonZeroToday.map((r) => `${r.name}=+${r.today}`).join(", ") : "(none)"}`);

  // ---------- (7) computePlayerHistories sanity ----------
  console.log("\n================ computePlayerHistories sanity ================");
  const groupFinished = finishedMatches.filter((m) => m.stage === "GROUP_STAGE" || m.stage === "GROUP").length;
  const expectedLen = Math.max(1 + groupFinished, 2);
  let histErrors = 0;
  for (const b of brackets) {
    const series = playerHistories[b.userId] || [];
    const live = liveScores[b.userId];
    const expectedLast = live ? live.totoGroup + live.exactGroup : 0;
    const last = series[series.length - 1];
    const lenOk = series.length === expectedLen;
    const lastOk = last === expectedLast;
    const monotonic = series.every((v, i) => i === 0 || v >= series[i - 1]);
    const startsZero = series[0] === 0;
    if (!lenOk || !lastOk || !monotonic || !startsZero) {
      histErrors++;
      console.log(`  PROBLEM ${b.displayName}: series=[${series.join(",")}] lenOk=${lenOk}(want ${expectedLen}) lastOk=${lastOk}(want ${expectedLast}) monotonic=${monotonic} startsZero=${startsZero}`);
    } else {
      console.log(`  OK ${pad(b.displayName, 16)} [${series.join(",")}] (last=${last} == group matchPts)`);
    }
  }
  console.log(histErrors === 0 ? "histories: all consistent." : `histories: ${histErrors} problem(s).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
