// ============================================================================
// scripts/local-backup-snapshot.ts
//
// One-off LOCAL backup: dumps every persistence-critical table (the same set as
// /api/admin/backup-snapshot) to a timestamped JSON file under local-backups/
// (gitignored — contains participants' predictions). Use before a risky
// scoring/logic change.
//
//   npx tsx scripts/local-backup-snapshot.ts
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Minimal .env.local loader (no dotenv dependency assumed).
function loadEnv() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, k, v] = m;
      if (!(k in process.env)) process.env[k] = v.replace(/^["']|["']$/g, "");
    }
  } catch {
    /* no .env.local — rely on real env */
  }
}

const BACKUP_TABLES = [
  "profiles",
  "leagues",
  "league_members",
  "user_brackets",
  "special_bets",
  "advancement_picks",
  "demo_match_results",
  "tournament_actuals",
  "scoring_config",
  "scoring_snapshots",
  "player_stats",
  "admin_audit_log",
  "admins",
  "tournaments",
];

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey);

  const dump: Record<string, unknown[]> = {};
  const errors: { table: string; error: string }[] = [];
  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      errors.push({ table, error: error.message });
      console.warn(`  ✗ ${table}: ${error.message}`);
      continue;
    }
    dump[table] = data || [];
    console.log(`  ✓ ${table}: ${data?.length ?? 0} rows`);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dir = join(process.cwd(), "local-backups");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `backup-${stamp}.json`);
  writeFileSync(
    file,
    JSON.stringify({ snapshotAt: new Date().toISOString(), triggeredBy: "local-script", tables: dump, errors }, null, 0),
  );
  console.log(`\nBackup written: ${file}`);
  if (errors.length) console.log(`(${errors.length} table(s) errored — see above)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
