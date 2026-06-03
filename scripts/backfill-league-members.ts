/**
 * Backfill missing `league_members` rows.
 *
 * Some accounts (admin/test-created, or joins that predated the membership
 * insert) have a `profiles` row but no `league_members` row. After the global
 * lock, /api/shared-bets resolves the viewer's league via league_members, so
 * those users would get a 404 and see NO standings/comparison. This inserts a
 * membership row (into the single league) for every profile missing one.
 *
 * Idempotent — safe to re-run. Aborts if there isn't exactly one league.
 *
 * Run: `npx tsx scripts/backfill-league-members.ts`
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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, serviceKey);

  const { data: leagues, error: lErr } = await supabase.from("leagues").select("id, name");
  if (lErr) throw lErr;
  if (!leagues || leagues.length !== 1) {
    console.error(`Expected exactly 1 league, found ${leagues?.length ?? 0}. Aborting (resolve manually).`);
    process.exit(1);
  }
  const leagueId = leagues[0].id as string;
  console.log(`League: ${leagues[0].name ?? leagueId} (${leagueId})`);

  const [{ data: profiles, error: pErr }, { data: members, error: mErr }] = await Promise.all([
    supabase.from("profiles").select("id, display_name"),
    supabase.from("league_members").select("user_id").eq("league_id", leagueId),
  ]);
  if (pErr) throw pErr;
  if (mErr) throw mErr;

  const memberIds = new Set((members ?? []).map((m) => m.user_id as string));
  const orphans = (profiles ?? []).filter((p) => !memberIds.has(p.id as string));

  console.log(`Profiles: ${profiles?.length ?? 0} · members: ${memberIds.size} · orphans: ${orphans.length}`);
  if (orphans.length === 0) {
    console.log("Nothing to backfill — every profile already has a membership row. ✅");
    return;
  }
  console.log("Orphans:", orphans.map((o) => o.display_name || o.id).join(", "));

  const rows = orphans.map((o) => ({ league_id: leagueId, user_id: o.id as string }));
  const { error: insErr } = await supabase.from("league_members").insert(rows);
  if (insErr) throw insErr;

  console.log(`Inserted ${rows.length} league_members row(s). ✅`);
}

main().catch((e) => {
  console.error("backfill-league-members failed:", e);
  process.exit(1);
});
