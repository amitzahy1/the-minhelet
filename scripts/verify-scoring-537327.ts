// One-off diagnostic: run the real scorer against production brackets and the
// repaired MEX-RSA result, and print exactly who earns what. Run:
//   npx tsx scripts/verify-scoring-537327.ts
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { computeGroupHits, type FinishedMatch } from "../src/lib/results-hits";
import { computeLiveScores } from "../src/lib/scoring/live-scorer";
import type { BettorBracket } from "../src/lib/supabase/shared-data";
import { GROUPS } from "../src/lib/tournament/groups";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Group A teams:", GROUPS["A"]?.map((t: { code: string }) => t.code));

  const { data: rows, error } = await sb
    .from("user_brackets")
    .select("user_id, group_predictions, knockout_tree, knockout_tree_live, champion, locked_at, profiles(display_name)");
  if (error) throw error;

  const brackets: BettorBracket[] = (rows || []).map((d) => ({
    userId: d.user_id,
    displayName: (d.profiles as unknown as { display_name: string })?.display_name || d.user_id.slice(0, 8),
    groupPredictions: (d.group_predictions as BettorBracket["groupPredictions"]) || {},
    knockoutTree: (d.knockout_tree as BettorBracket["knockoutTree"]) || {},
    knockoutTreeLive: (d.knockout_tree_live as BettorBracket["knockoutTreeLive"]) || {},
    champion: d.champion,
    lockedAt: d.locked_at,
  }));
  console.log(`\nLoaded ${brackets.length} brackets`);

  const matches: FinishedMatch[] = [
    { id: 537327, date: "2026-06-11T19:00:00Z", homeTla: "MEX", awayTla: "RSA", group: "A", stage: "GROUP_STAGE", homeGoals: 2, awayGoals: 0 },
    { id: 537328, date: "2026-06-12T02:00:00Z", homeTla: "KOR", awayTla: "CZE", group: "A", stage: "GROUP_STAGE", homeGoals: 2, awayGoals: 1 },
  ];

  for (const match of matches) {
    console.log(`\n--- computeGroupHits (${match.homeTla} ${match.homeGoals}-${match.awayGoals} ${match.awayTla}) ---`);
    const hits = computeGroupHits(match, brackets);
    if (hits.length === 0) console.log("!! NO HITS RETURNED — pair matching failed !!");
    for (const h of hits) {
      console.log(`${h.name.padEnd(20)} pred ${h.pred.home ?? "-"}-${h.pred.away ?? "-"}  → ${h.hit}`);
    }
  }

  console.log("\n--- computeLiveScores totals (both matches) ---");
  const scores = computeLiveScores(brackets, matches);
  for (const s of Object.values(scores).sort((a, b) => b.total - a.total)) {
    console.log(
      `${s.displayName.padEnd(20)} total=${s.total}  matchPts=${s.matchPts} (totoGroup=${s.totoGroup} exactGroup=${s.exactGroup})`,
      JSON.stringify({ totoHits: s.totoHits, exactHits: s.exactHits, miss: s.missHits, empty: s.emptyHits })
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
