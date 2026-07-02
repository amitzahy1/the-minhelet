// ============================================================================
// One-off audit: verify the site's STORED results & stats vs Football-Data.
//
//   npx tsx scripts/audit-results.ts
//
// Pulls every demo_match_results row + tournament_actuals from Supabase, then
// fetches the authoritative Football-Data feed (matches + scorers) and ESPN
// player stats, and cross-checks:
//   1. Stored match score  vs  FD 90' score (regularTime ?? fullTime)
//   2. Stored vs ESPN group score (the 3rd opinion)
//   3. FD scorer goals      vs  ESPN scorer goals (MAX-merge divergence)
// Writes a full JSON dump to scratchpad and prints a human summary.
// READ-ONLY. No writes.
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { toAppCode } from "../src/lib/fd-team-mapping";
import { ninetyMinuteScore } from "../src/lib/api-football-data";
import { getEspnResults, getEspnPlayerStats, getEspnCardBoard } from "../src/lib/api-espn";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(
  readFileSync(resolve(ROOT, ".env.local"), "utf8")
    .split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const FD = env.FOOTBALL_DATA_TOKEN;
const FD_STAGE: Record<string, string> = {
  GROUP_STAGE: "GROUP", LAST_32: "R32", LAST_16: "R16",
  QUARTER_FINALS: "QF", SEMI_FINALS: "SF", THIRD_PLACE: "THIRD", FINAL: "FINAL",
};

async function main() {
  // ---- 1. Stored state ----
  const { data: demo } = await sb
    .from("demo_match_results")
    .select("match_id, stage, group_id, home_team, away_team, home_goals, away_goals, home_penalties, away_penalties, status, entered_by, scheduled_at, updated_at");
  const { data: actuals } = await sb.from("tournament_actuals").select("*").limit(1).maybeSingle();
  const demoById = new Map((demo || []).map((r: any) => [String(r.match_id), r]));

  // ---- 2. Authoritative FD feed ----
  const fdRes = await fetch(`https://api.football-data.org/v4/competitions/WC/matches?season=2026`, {
    headers: { "X-Auth-Token": FD }, cache: "no-store" as any,
  });
  const fdJson = await fdRes.json();
  const fdMatches: any[] = fdJson.matches || [];
  const fdById = new Map(fdMatches.map((m) => [String(m.id), m]));

  const scoRes = await fetch(`https://api.football-data.org/v4/competitions/WC/scorers?season=2026&limit=100`, {
    headers: { "X-Auth-Token": FD }, cache: "no-store" as any,
  });
  const fdScorers = ((await scoRes.json()).scorers || []).map((s: any) => ({
    name: s.player?.name, team: s.team?.tla, goals: s.goals ?? 0, assists: s.assists ?? 0,
  }));

  const espnResults = (await getEspnResults().catch(() => null)) || [];
  const espnPlayers = (await getEspnPlayerStats().catch(() => null)) || [];
  const espnCards = (await getEspnCardBoard().catch(() => null)) || [];

  // ---- 3. Score cross-check ----
  const scoreIssues: any[] = [];
  const fdFinished = fdMatches.filter((m) => m.status === "FINISHED");
  for (const m of fdFinished) {
    const id = String(m.id);
    const { home: fh, away: fa } = ninetyMinuteScore(m.score);
    const stored = demoById.get(id);
    const home = toAppCode(m.homeTeam?.tla);
    const away = toAppCode(m.awayTeam?.tla);
    const label = `${home}-${away} (${m.stage})`;
    if (fh == null || fa == null) continue; // FD hasn't published score yet
    if (!stored) {
      scoreIssues.push({ kind: "MISSING_IN_DB", id, label, fd: `${fh}-${fa}` });
      continue;
    }
    if (stored.home_goals !== fh || stored.away_goals !== fa) {
      scoreIssues.push({
        kind: "SCORE_MISMATCH", id, label,
        stored: `${stored.home_goals}-${stored.away_goals}`,
        fd: `${fh}-${fa}`, source: stored.entered_by, updated: stored.updated_at,
      });
    }
  }
  // Stored rows FD does NOT have as finished (or doesn't have at all)
  for (const r of demo || []) {
    const fd = fdById.get(String(r.match_id));
    if (!fd) { scoreIssues.push({ kind: "DB_ROW_NOT_IN_FD", id: r.match_id, label: `${r.home_team}-${r.away_team}`, stored: `${r.home_goals}-${r.away_goals}`, source: r.entered_by }); continue; }
    if (fd.status !== "FINISHED") scoreIssues.push({ kind: "DB_FINISHED_FD_NOT", id: r.match_id, label: `${r.home_team}-${r.away_team}`, stored: `${r.home_goals}-${r.away_goals}`, fdStatus: fd.status, source: r.entered_by });
  }

  // ---- 4. ESPN group score third-opinion (catches FD itself being wrong) ----
  const espnVsStored: any[] = [];
  for (const r of (demo || []).filter((x: any) => x.stage === "GROUP" || x.stage === "GROUP_STAGE")) {
    const ev = espnResults.find((e: any) =>
      (e.homeCode === r.home_team && e.awayCode === r.away_team) || (e.homeCode === r.away_team && e.awayCode === r.home_team));
    if (!ev) continue;
    const flip = ev.homeCode === r.away_team;
    const eh = flip ? ev.awayGoals : ev.homeGoals;
    const ea = flip ? ev.homeGoals : ev.awayGoals;
    if (eh !== r.home_goals || ea !== r.away_goals)
      espnVsStored.push({ label: `${r.home_team}-${r.away_team}`, stored: `${r.home_goals}-${r.away_goals}`, espn: `${eh}-${ea}` });
  }

  // ---- 5. Scorer goal divergence FD vs ESPN (the MAX-merge that never decreases) ----
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’`´׳]/g, "").replace(/[^a-z ]+/g, " ").replace(/\s+/g, " ").trim();
  const espnByName = new Map(espnPlayers.map((p: any) => [norm(p.name), p]));
  const goalDivergence: any[] = [];
  for (const s of fdScorers) {
    const e = espnByName.get(norm(s.name));
    if (e && e.goals !== s.goals) goalDivergence.push({ name: s.name, fdGoals: s.goals, espnGoals: e.goals, shown: Math.max(s.goals, e.goals) });
  }

  const out = {
    generatedAt: new Date().toISOString(),
    counts: { demoRows: demo?.length, fdFinished: fdFinished.length, fdScorers: fdScorers.length, espnPlayers: espnPlayers.length, espnResults: espnResults.length },
    scoreIssues, espnVsStored, goalDivergence,
    actuals,
    espnCards,
    fdScorersTop: [...fdScorers].sort((a, b) => b.goals - a.goals).slice(0, 25),
  };
  const path = "/private/tmp/claude-502/-Users-amitzahy-Documents-Draft-wc2026/f9158ddf-c4e1-47c9-a935-47115115c956/scratchpad/audit.json";
  writeFileSync(path, JSON.stringify(out, null, 2));

  console.log("=== AUDIT SUMMARY ===");
  console.log("counts:", JSON.stringify(out.counts));
  console.log(`\n--- SCORE ISSUES (stored vs Football-Data): ${scoreIssues.length} ---`);
  for (const i of scoreIssues) console.log(JSON.stringify(i));
  console.log(`\n--- ESPN vs STORED group score (3rd opinion): ${espnVsStored.length} ---`);
  for (const i of espnVsStored) console.log(JSON.stringify(i));
  console.log(`\n--- GOAL TALLY DIVERGENCE FD vs ESPN (MAX-merge shows the higher): ${goalDivergence.length} ---`);
  for (const i of goalDivergence) console.log(JSON.stringify(i));
  console.log(`\nFull dump: ${path}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
