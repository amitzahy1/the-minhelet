/**
 * Seed (or regenerate) the synthetic "🤖 בוט" account with a full set of
 * moderate-surprise predictions. Shares the exact create/generate/persist path
 * as the admin "בוט" button (src/lib/bot-seed.ts).
 *
 * Idempotent — overwrites only the bot's own bets. Run:
 *   `npx tsx scripts/seed-bot.ts`
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { seedBot } from "../src/lib/bot-seed";

function loadEnv(): void {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey);

  const result = await seedBot(supabase);
  console.log(`Bot ${result.created ? "created" : "updated"} — champion: ${result.champion}`);
  console.log("--- rationale ---");
  for (const line of result.rationale) console.log(line);
  console.log(`\n✅ Seeded 🤖 בוט (user ${result.botUserId}) into league ${result.leagueId}.`);
}

main().catch((e) => {
  console.error("seed-bot failed:", e);
  process.exit(1);
});
