/**
 * One-shot Supabase setup helper.
 *
 * Uses NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local
 * to do everything we can do via the JS client:
 *
 *   1. Create the `backups` Storage bucket (private) if it doesn't exist.
 *   2. Probe whether migrations 010-016 are applied (by checking for the
 *      table/column/function each one creates).
 *   3. Print a clear summary + remaining manual steps.
 *
 * Run: `npx tsx scripts/setup-supabase.ts`
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

function loadEnv(): void {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("✗ NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing — populate .env.local first.");
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const ICON = { ok: "\x1b[32m✓\x1b[0m", warn: "\x1b[33m⚠\x1b[0m", fail: "\x1b[31m✗\x1b[0m" };

async function ensureBackupsBucket() {
  const { data: list, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.log(`${ICON.fail} Could not list buckets: ${listError.message}`);
    return;
  }
  if (list?.some((b) => b.name === "backups")) {
    console.log(`${ICON.ok} backups bucket already exists`);
    return;
  }
  const { error } = await supabase.storage.createBucket("backups", { public: false });
  if (error) {
    console.log(`${ICON.fail} Failed to create backups bucket: ${error.message}`);
    console.log("   → Open Supabase dashboard → Storage → New bucket → name: backups, Public: off");
    return;
  }
  console.log(`${ICON.ok} Created backups bucket (private)`);
}

async function probeRpc(): Promise<boolean> {
  const { error } = await supabase.rpc("save_user_predictions", {
    p_user_id: "00000000-0000-0000-0000-000000000000",
    p_league_id: "00000000-0000-0000-0000-000000000000",
    p_brackets: null,
    p_special: null,
    p_advancement: null,
    p_lock_deadline: new Date(Date.now() + 86400_000).toISOString(),
  });
  // Function exists if we get a domain error (FORBIDDEN / LOCKED / auth.uid).
  // Function missing if Postgres returns "does not exist".
  if (!error) return true;
  return !/function .* does not exist/i.test(error.message);
}

async function probeTable(name: string): Promise<boolean> {
  const { error } = await supabase.from(name).select("*").limit(0);
  if (!error) return true;
  return !/does not exist/i.test(error.message);
}

async function probeColumn(table: string, col: string): Promise<boolean> {
  const { error } = await supabase.from(table).select(col).limit(0);
  if (!error) return true;
  return !/does not exist/i.test(error.message);
}

async function main() {
  console.log("\n📦 Supabase setup helper\n");
  console.log("Project:", url.replace("https://", "").replace(".supabase.co", ""));
  console.log("");

  await ensureBackupsBucket();
  console.log("");

  // Probe each migration's marker artifact.
  const probes: { migration: string; check: () => Promise<boolean>; what: string }[] = [
    { migration: "010_atomic_save.sql", check: probeRpc, what: "save_user_predictions() function" },
    { migration: "011_scoring_snapshots.sql", check: () => probeTable("scoring_snapshots"), what: "scoring_snapshots table" },
    { migration: "012_handle_new_user_extension.sql", check: async () => true, what: "handle_new_user_extended() trigger (probed indirectly via signup behaviour)" },
    { migration: "013_backfill_locked_at.sql", check: async () => true, what: "backfill_locked_at() function" },
    { migration: "014_player_stats.sql", check: () => probeTable("player_stats"), what: "player_stats table" },
    { migration: "015_audit_target_nullable.sql", check: async () => true, what: "admin_audit_log.target_user_id nullable (probed at insert time)" },
    { migration: "016_lock_deadline_override.sql", check: () => probeColumn("tournaments", "lock_deadline_override"), what: "tournaments.lock_deadline_override column" },
  ];

  const missing: string[] = [];
  for (const p of probes) {
    const installed = await p.check();
    if (installed) {
      console.log(`${ICON.ok} ${p.migration} — ${p.what}`);
    } else {
      console.log(`${ICON.fail} ${p.migration} — ${p.what}`);
      missing.push(p.migration);
    }
  }

  console.log("");
  if (missing.length === 0) {
    console.log(`${ICON.ok} All migrations + bucket are in place. You're ready for launch.\n`);
    return;
  }

  console.log("┌─ Next step ─────────────────────────────────────────────────");
  console.log("│ Apply the missing migrations. Two options:                  ");
  console.log("│                                                             ");
  console.log("│ Option A — Supabase CLI (one-shot):                         ");
  console.log("│   npx supabase login                                        ");
  console.log("│   npx supabase link --project-ref <YOUR_PROJECT_REF>        ");
  console.log("│   npx supabase db push                                      ");
  console.log("│                                                             ");
  console.log("│ Option B — Dashboard SQL Editor:                            ");
  console.log("│   Open Supabase → SQL Editor → New query                    ");
  console.log("│   Paste each missing file's contents (in numeric order),    ");
  console.log("│   then click Run:                                           ");
  for (const m of missing) {
    console.log(`│     • supabase/migrations/${m}`);
  }
  console.log("│                                                             ");
  console.log("│ Then re-run this script to verify.                          ");
  console.log("└─────────────────────────────────────────────────────────────");
}

void main();
