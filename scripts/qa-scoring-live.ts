// QA: read the LIVE scoring_config row and show exactly what the app will use.
// Self-contained: parses .env.local, queries Supabase (read-only), and flags any
// column that differs from the canonical scoring values. Run:
//   npx tsx scripts/qa-scoring-live.ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Canonical values = the SCORING constant (guarded by scoring-consistency.test.ts).
const EXPECTED: Record<string, number> = {
  toto_group: 2, toto_r32: 3, toto_r16: 3, toto_qf: 3, toto_sf: 3, toto_third: 3, toto_final: 4,
  exact_group: 1, exact_r32: 1, exact_r16: 1, exact_qf: 1, exact_sf: 2, exact_third: 1, exact_final: 2,
  group_advance_exact: 3, group_advance_partial: 1, group_advance_as_3rd: 0,
  advance_r16: 2, advance_qf: 3, advance_sf: 6, advance_final: 10, advance_winner: 16,
  top_scorer_exact: 12, top_scorer_relative: 7, top_assists_exact: 9, top_assists_relative: 5,
  best_attack: 8, prolific_group: 6, driest_group: 6, dirtiest_team: 6, matchup: 5, penalties_over_under: 6,
  top_scorer_min_goals: 3, top_assists_min: 2,
};

function envFromFile(): Record<string, string> {
  const txt = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const out: Record<string, string> = {};
  for (const line of txt.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

async function main() {
  const env = envFromFile();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / ANON_KEY in .env.local");

  const supabase = createClient(url, key);
  const cols = Object.keys(EXPECTED).join(",");
  const { data, error } = await supabase.from("scoring_config").select(cols).limit(1).maybeSingle();
  if (error) throw new Error(`DB error: ${error.message}`);
  if (!data) throw new Error("No scoring_config row found");

  const row = data as Record<string, number>;
  const diffs: string[] = [];
  for (const [col, expected] of Object.entries(EXPECTED)) {
    const got = row[col];
    const flag = got === expected ? "  " : "❌";
    if (got !== expected) diffs.push(`${col}: DB=${got} expected=${expected}`);
    console.log(`${flag} ${col.padEnd(22)} ${String(got).padStart(3)}`);
  }
  console.log("");
  if (diffs.length === 0) {
    console.log("✓ LIVE scoring_config matches the canonical values exactly.");
  } else {
    console.log(`⚠ ${diffs.length} column(s) differ from canonical:\n  ` + diffs.join("\n  "));
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e.message || e); process.exit(1); });
