// One-time data repair (2026-06-12): the groups betting page generated match
// pairs 4+5 of each group with REVERSED home/away orientation vs the canonical
// GROUP_MATCH_PAIRS the scorer/bot/admin-editor use ([d,b],[d,a] instead of
// [b,d],[a,d]). Every human-entered bracket therefore has scores[3] and
// scores[4] stored flipped in every group. This script swaps home<->away at
// those two indices for all brackets EXCEPT the bot's (generated canonically
// via bot-predictions.ts).
//
// Run AFTER deploying the generateMatchups orientation fix:
//   npx tsx scripts/migrate-flip-pairs-3-4.ts          (dry run)
//   npx tsx scripts/migrate-flip-pairs-3-4.ts --apply  (writes)
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

const BOT_USER_ID = "fd5a8305-8f31-4478-ada1-5f88af05ba9c"; // 🤖 בוט — already canonical
const FLIP_INDICES = [3, 4];

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const apply = process.argv.includes("--apply");

// ⛔ ALREADY APPLIED on 2026-06-12 (~04:19 UTC). The swap is an involution —
// running --apply again would flip the now-canonical data BACK to corrupted.
// Kept in the repo for documentation/recovery only.
if (apply && !process.argv.includes("--i-am-reversing-the-2026-06-12-repair")) {
  console.error(
    "ABORT: this migration already ran on 2026-06-12. Re-running --apply would re-corrupt pairs 4+5.\n" +
    "If you REALLY need to reverse it, pass --i-am-reversing-the-2026-06-12-repair as well."
  );
  process.exit(1);
}

interface Score { home: number | null; away: number | null }
type GroupPreds = Record<string, { order: number[]; scores: Score[] }>;

async function main() {
  const { data: rows, error } = await sb
    .from("user_brackets")
    .select("id, user_id, group_predictions, profiles(display_name)");
  if (error) throw error;

  writeFileSync(
    `scripts/backup-user_brackets-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    JSON.stringify(rows, null, 2)
  );
  console.log(`Backed up ${rows!.length} bracket rows locally.`);

  for (const row of rows!) {
    const name = (row.profiles as unknown as { display_name: string })?.display_name || row.user_id;
    if (row.user_id === BOT_USER_ID) {
      console.log(`SKIP (bot, canonical): ${name}`);
      continue;
    }
    const gp = (row.group_predictions || {}) as GroupPreds;
    let touched = 0;
    for (const letter of Object.keys(gp)) {
      const scores = gp[letter]?.scores;
      if (!Array.isArray(scores) || scores.length !== 6) continue;
      for (const i of FLIP_INDICES) {
        const s = scores[i];
        if (!s) continue;
        scores[i] = { home: s.away, away: s.home };
        touched++;
      }
    }
    console.log(`${apply ? "FLIP" : "would flip"} ${touched} scores for ${name}`);
    if (apply && touched > 0) {
      // Bump updated_at too: the client store's hydrate guard keeps localStorage
      // when localTs > server updated_at — without the bump, returning clients
      // would keep their PRE-migration (flipped) local copy forever.
      const { error: upErr } = await sb
        .from("user_brackets")
        .update({ group_predictions: gp, updated_at: new Date().toISOString() })
        .eq("id", row.id);
      if (upErr) throw new Error(`update failed for ${name}: ${upErr.message}`);
    }
  }
  console.log(apply ? "\nDONE — data migrated." : "\nDry run only. Re-run with --apply to write.");
}

main().catch((e) => { console.error(e); process.exit(1); });
