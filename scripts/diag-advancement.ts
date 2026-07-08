// ============================================================================
// Diagnostic: advancement (R16/QF/SF/Final/winner) scoring for ALL users.
// Replicates the standings-page pipeline exactly:
//   /api/matches merge (FD + demo overlay) → FINISHED list →
//   resolveKnockoutTree(LIVE_FEEDERS) → scoreAdvancementForUser per user.
// READ-ONLY.
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { toAppCode } from "../src/lib/fd-team-mapping";
import { ninetyMinuteScore, koWinnerFromScore, decisivePenalties } from "../src/lib/api-football-data";
import { normalizeTla, normalizeGroupLetter, type FinishedMatch } from "../src/lib/results-hits";
import { resolveKnockoutTree, fairPlayFromBoard, computeGroupOrders, type SlotState } from "../src/lib/scoring/knockout-resolver";
import { LIVE_FEEDERS } from "../src/lib/tournament/knockout-derivation";
import { GROUPS } from "../src/lib/tournament/groups";
import { scoreAdvancementForUser, deriveActualGroupOrders } from "../src/lib/scoring/advancement-scorer";
import { scoringFromConfig, SCORING_CONFIG_COLUMNS, type ScoringConfigRow } from "../src/lib/scoring/config";
import type { BettorAdvancement } from "../src/lib/supabase/shared-data";

const ROOT = "/Users/amitzahy/Documents/Draft/wc2026";
const env = Object.fromEntries(
  readFileSync(resolve(ROOT, ".env.local"), "utf8")
    .split("\n").filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  // ---- 1. Rebuild the /api/matches merged view (FD + demo overlay) ----
  const [fdRes, demoRes] = await Promise.all([
    fetch("https://api.football-data.org/v4/competitions/WC/matches?season=2026", {
      headers: { "X-Auth-Token": env.FOOTBALL_DATA_TOKEN },
    }).then((r) => r.json()),
    sb.from("demo_match_results").select("match_id, home_goals, away_goals, home_penalties, away_penalties, home_team, away_team, group_id, stage, status, scheduled_at"),
  ]);
  const demoById = new Map((demoRes.data || []).map((r: any) => [String(r.match_id), r]));
  const seen = new Set<string>();
  const merged: any[] = [];
  for (const m of fdRes.matches || []) {
    seen.add(String(m.id));
    const demo = demoById.get(String(m.id));
    const reg = ninetyMinuteScore(m.score);
    merged.push({
      id: m.id, date: m.utcDate,
      homeTla: toAppCode(m.homeTeam?.tla), awayTla: toAppCode(m.awayTeam?.tla),
      group: m.group, stage: m.stage,
      status: demo?.status ?? m.status,
      homeGoals: demo?.home_goals ?? reg.home,
      awayGoals: demo?.away_goals ?? reg.away,
      homePenalties: demo?.home_penalties ?? decisivePenalties(m.score).home,
      awayPenalties: demo?.away_penalties ?? decisivePenalties(m.score).away,
      winner: koWinnerFromScore(m.score, demo?.status ?? m.status),
    });
  }
  for (const r of demoRes.data || []) {
    if (seen.has(String(r.match_id)) || !r.home_team || !r.away_team) continue;
    merged.push({
      id: Number(r.match_id) || 0, date: r.scheduled_at || "",
      homeTla: r.home_team, awayTla: r.away_team,
      group: r.group_id ? `GROUP_${r.group_id}` : undefined, stage: r.stage ?? undefined,
      status: r.status ?? "FINISHED",
      homeGoals: r.home_goals, awayGoals: r.away_goals,
      homePenalties: r.home_penalties, awayPenalties: r.away_penalties,
      winner: null,
    });
  }
  const finished: FinishedMatch[] = merged
    .filter((m) => m.status === "FINISHED" && m.homeGoals != null && m.awayGoals != null)
    .map((m) => ({
      id: m.id, date: m.date,
      homeTla: m.homeTla, awayTla: m.awayTla,
      group: normalizeGroupLetter(m.group), stage: m.stage || "GROUP_STAGE",
      homeGoals: m.homeGoals, awayGoals: m.awayGoals,
      homePenalties: m.homePenalties, awayPenalties: m.awayPenalties,
      winner: m.winner,
    }));
  console.log(`Finished matches: ${finished.length} (KO: ${finished.filter((m) => m.stage !== "GROUP_STAGE" && m.stage !== "GROUP").length})`);

  // ---- 2. Scoring config + actuals ----
  const { data: cfgRow } = await sb.from("scoring_config").select(SCORING_CONFIG_COLUMNS).limit(1).maybeSingle();
  const scoring = scoringFromConfig(cfgRow as Partial<ScoringConfigRow> | null);
  console.log("\nAdvancement point values (DB-resolved):", JSON.stringify(scoring.advancement));

  const { data: actuals } = await sb.from("tournament_actuals").select("dirtiest_board, best_thirds_override").limit(1).maybeSingle();
  const fairPlay = fairPlayFromBoard(actuals?.dirtiest_board);
  const thirdsOverride = Array.isArray(actuals?.best_thirds_override) && actuals!.best_thirds_override.length === 8
    ? actuals!.best_thirds_override : null;
  console.log("bestThirdsOverride:", JSON.stringify(thirdsOverride));

  // ---- 3. Resolve tree exactly like live-scorer's advancement path ----
  const tree = resolveKnockoutTree(finished, thirdsOverride, fairPlay, LIVE_FEEDERS);
  const stageTeams = (stage: string) => {
    const s = new Set<string>();
    for (const slot of Object.values(tree) as SlotState[]) {
      if (slot.stage === stage) { if (slot.team1) s.add(slot.team1); if (slot.team2) s.add(slot.team2); }
    }
    return s;
  };
  const reachedR16 = stageTeams("R16");
  const reachedQF = stageTeams("QF");
  const reachedSF = stageTeams("SF");
  const finalSlot = (tree as any)["final"];
  const reachedFinal = new Set<string>([finalSlot?.team1, finalSlot?.team2].filter(Boolean));
  const champion = finalSlot?.winner ?? null;
  console.log(`\nreached R16 (${reachedR16.size}):`, [...reachedR16].sort().join(" "));
  console.log(`reached QF  (${reachedQF.size}):`, [...reachedQF].sort().join(" "));
  console.log(`reached SF  (${reachedSF.size}):`, [...reachedSF].sort().join(" "));
  console.log(`reached Final:`, [...reachedFinal].join(" "), "| champion:", champion);

  // Sanity: dump every R16/QF slot
  console.log("\n-- R16/QF slots --");
  for (const [k, s] of Object.entries(tree) as [string, SlotState][]) {
    if (s.stage === "R16" || s.stage === "QF")
      console.log(`${k}: ${s.team1 ?? "?"} vs ${s.team2 ?? "?"} → winner ${s.winner ?? "-"} (${s.score1 ?? "-"}:${s.score2 ?? "-"})`);
  }

  // ---- 4. Group orders + best thirds (for group-qualifier part) ----
  const groupOrders = computeGroupOrders(finished, fairPlay);
  const actualGroupOrders = deriveActualGroupOrders(tree as any, groupOrders, GROUPS);
  const allR32 = new Set<string>();
  for (const [k, s] of Object.entries(tree) as [string, SlotState][]) {
    if (!k.startsWith("r32")) continue;
    if (s.team1) allR32.add(s.team1); if (s.team2) allR32.add(s.team2);
  }
  const bestThirdsCodes = new Set<string>();
  for (const [letter, order] of Object.entries(groupOrders)) {
    const code = GROUPS[letter]?.[order[2]]?.code;
    if (code && allR32.has(code)) bestThirdsCodes.add(code);
  }

  // ---- 5. Score every user ----
  const { data: advRows } = await sb.from("advancement_picks").select("*, profiles(display_name)");
  console.log(`\n=== PER-USER ADVANCEMENT (users: ${advRows?.length}) ===`);
  for (const d of advRows || []) {
    const adv: BettorAdvancement = {
      userId: d.user_id,
      displayName: (d.profiles as any)?.display_name || d.user_id.slice(0, 8),
      groupQualifiers: d.group_qualifiers || {},
      advanceToR16: d.advance_to_r16 || [],
      advanceToQF: d.advance_to_qf || [],
      advanceToSF: d.advance_to_sf || [],
      advanceToFinal: d.advance_to_final || [],
      winner: d.winner || "",
    };
    const b = scoreAdvancementForUser(adv, actualGroupOrders, bestThirdsCodes, tree as any, champion, scoring);
    const hits = (reason: string) => b.lines.filter((l) => l.reason === reason);
    const r16Hits = hits("ADVANCE_R16"), qfHits = hits("ADVANCE_QF"), sfHits = hits("ADVANCE_SF"), fHits = hits("ADVANCE_FINAL");
    console.log(`\n${adv.displayName}  total=${b.total}  (groupExact=${b.groupExactPts} groupPartial=${b.groupPartialPts} r16=${b.r16Pts} qf=${b.qfPts} sf=${b.sfPts} final=${b.finalPts} winner=${b.winnerPts})`);
    console.log(`  R16 picks (${adv.advanceToR16.filter(Boolean).length}): ${adv.advanceToR16.join(" ")}`);
    console.log(`  R16 hits  (${r16Hits.length} × ${scoring.advancement.r16} = ${b.r16Pts}): ${r16Hits.map((l) => l.pick).join(" ")}`);
    console.log(`  QF picks  (${adv.advanceToQF.filter(Boolean).length}): ${adv.advanceToQF.join(" ")}`);
    console.log(`  QF hits   (${qfHits.length} × ${scoring.advancement.qf} = ${b.qfPts}): ${qfHits.map((l) => l.pick).join(" ")}`);
    console.log(`  SF picks  (${adv.advanceToSF.filter(Boolean).length}): ${adv.advanceToSF.join(" ")} | hits (${sfHits.length}): ${sfHits.map((l) => l.pick).join(" ")}`);
    console.log(`  Final picks: ${adv.advanceToFinal.join(" ")} | hits (${fHits.length}): ${fHits.map((l) => l.pick).join(" ")} | winner pick: ${adv.winner}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
