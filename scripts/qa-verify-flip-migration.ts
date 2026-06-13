/**
 * QA — independent integrity check of the 2026-06-12 flip-pairs-3-4 migration.
 *
 * For every bracket and every group:
 *   1. Rebuild predictions with the POST-FIX canonical orientation
 *      (pairs [0,1],[2,3],[0,2],[1,3],[0,3],[1,2], home = first index).
 *   2. Run calculateStandings (the same engine the groups page used to derive
 *      group_predictions[G].order pre-tournament).
 *   3. Compare the recomputed order to the stored order array.
 *      If the migration was CORRECT, they must match (flipping home/away keeps
 *      per-team goal attribution identical to what the user saw pre-fix).
 *      A wrong / double-applied flip would diverge en masse.
 *   4. Cross-check the same thing on the PRE-migration backup using the OLD
 *      page orientation (pairs 3,4 as [d,b],[d,a]) — validates provenance.
 *   5. Diff current DB vs pre-migration backup: humans must differ ONLY by a
 *      home/away swap at indices 3+4 (plus any post-migration live edits,
 *      which are reported); the bot must be byte-identical.
 *   6. Spot-check: print 3 users' group A scores[4] under canonical labels.
 *
 * READ-ONLY: never writes to the database.
 * Run: npx tsx scripts/qa-verify-flip-migration.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import { GROUPS } from "../src/lib/tournament/groups";
import { calculateStandings } from "../src/lib/tournament/standings";
import type { GroupMatchPrediction } from "../src/types";

function loadEnv(): void {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const BOT_USER_ID = "fd5a8305-8f31-4478-ada1-5f88af05ba9c";
// Canonical post-fix orientation (= GROUP_MATCH_PAIRS everywhere in src).
const CANON_PAIRS: Array<[number, number]> = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
// OLD page orientation pre-fix: indices 3,4 were [d,b],[d,a] i.e. [3,1],[3,0].
const OLD_PAIRS: Array<[number, number]> = [[0, 1], [2, 3], [0, 2], [3, 1], [3, 0], [1, 2]];

interface Score { home: number | null; away: number | null }
interface GroupPred { order: number[]; scores: Score[] }
type GP = Record<string, GroupPred>;
interface Row { id: string; user_id: string; updated_at?: string; group_predictions: GP; profiles?: { display_name?: string } | null }

const LETTERS = Object.keys(GROUPS);

function recomputeOrder(letter: string, scores: Score[], pairs: Array<[number, number]>): number[] | null {
  const teams = GROUPS[letter];
  // Mirror the groups page exactly: skip if nothing filled, else null→0.
  const hasAny = scores.some((s) => s && s.home !== null);
  if (!hasAny) return null;
  const preds: GroupMatchPrediction[] = pairs.map(([i, j], k) => ({
    match_id: k,
    home_team_code: teams[i].code,
    away_team_code: teams[j].code,
    home_goals: scores[k]?.home ?? 0,
    away_goals: scores[k]?.away ?? 0,
  }));
  const standings = calculateStandings(teams.map((t) => ({ id: t.id, code: t.code })), preds);
  const idxByCode: Record<string, number> = {};
  teams.forEach((t, i) => { idxByCode[t.code] = i; });
  return standings.map((r) => idxByCode[r.team_code]);
}

function codes(letter: string, order: number[]): string {
  return order.map((i) => GROUPS[letter][i]?.code ?? `?${i}`).join(">");
}

function eq(a: number[] | null, b: number[] | null): boolean {
  return !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);
}

function scoreEq(a: Score | undefined, b: Score | undefined): boolean {
  return !!a && !!b && a.home === b.home && a.away === b.away;
}

async function main() {
  const { data, error } = await sb
    .from("user_brackets")
    .select("id, user_id, updated_at, group_predictions, profiles(display_name)")
    .order("user_id");
  if (error) throw error;
  const rows = (data as unknown as Row[]) || [];

  const backup: Row[] = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "backup-user_brackets-2026-06-12T04-18-55-472Z.json"), "utf8")
  );
  const backupByUser = new Map(backup.map((r) => [r.user_id, r]));

  console.log(`Loaded ${rows.length} bracket rows from DB, ${backup.length} from pre-migration backup.\n`);

  let mismatchCurrent = 0;
  let mismatchBackup = 0;
  let groupsChecked = 0;
  const diffNotes: string[] = [];

  for (const row of rows) {
    const name = row.profiles?.display_name || row.user_id.slice(0, 8);
    const isBot = row.user_id === BOT_USER_ID;
    const bak = backupByUser.get(row.user_id);
    const tag = isBot ? `${name} [BOT]` : name;
    const problems: string[] = [];

    for (const letter of LETTERS) {
      const gp = row.group_predictions?.[letter];
      if (!gp || !Array.isArray(gp.scores) || gp.scores.length !== 6 || !Array.isArray(gp.order)) {
        problems.push(`  ${letter}: MALFORMED group prediction (scores=${gp?.scores?.length}, order=${JSON.stringify(gp?.order)})`);
        continue;
      }
      groupsChecked++;

      // (3) Current DB scores under CANONICAL orientation vs stored order.
      const reco = recomputeOrder(letter, gp.scores, CANON_PAIRS);
      if (!reco) {
        problems.push(`  ${letter}: no scores filled — order not derivable (stored ${codes(letter, gp.order)})`);
      } else if (!eq(reco, gp.order)) {
        mismatchCurrent++;
        problems.push(
          `  ${letter}: ORDER MISMATCH (current scores, canonical) stored=${codes(letter, gp.order)} recomputed=${codes(letter, reco)}`
        );
      }

      // (4) Pre-migration backup scores under the OLD page orientation vs stored order.
      const bgp = bak?.group_predictions?.[letter];
      if (bgp && Array.isArray(bgp.scores) && bgp.scores.length === 6) {
        const pairsForBackup = isBot ? CANON_PAIRS : OLD_PAIRS; // bot was always canonical
        const recoB = recomputeOrder(letter, bgp.scores, pairsForBackup);
        if (recoB && !eq(recoB, bgp.order)) {
          mismatchBackup++;
          problems.push(
            `  ${letter}: BACKUP provenance mismatch (old orientation) stored=${codes(letter, bgp.order)} recomputed=${codes(letter, recoB)}`
          );
        }
        // (5) Diff current vs backup: humans → flip at 3,4 only; bot → identical.
        for (let i = 0; i < 6; i++) {
          const cur = gp.scores[i];
          const old = bgp.scores[i];
          const expected: Score | undefined =
            isBot || (i !== 3 && i !== 4) ? old : old ? { home: old.away, away: old.home } : old;
          if (!scoreEq(cur, expected)) {
            diffNotes.push(
              `  ${tag} ${letter}[${i}]: backup=${JSON.stringify(old)} expected-after-migration=${JSON.stringify(expected)} actual=${JSON.stringify(cur)}  <- post-migration edit or anomaly`
            );
          }
        }
        if (!eq(gp.order, bgp.order)) {
          diffNotes.push(`  ${tag} ${letter}: order CHANGED since backup ${codes(letter, bgp.order)} -> ${codes(letter, gp.order)}`);
        }
      } else if (!bak) {
        diffNotes.push(`  ${tag}: not present in pre-migration backup`);
      }
    }

    console.log(problems.length ? `✗ ${tag}` : `✓ ${tag} — all ${LETTERS.length} groups: recomputed standings match stored order`);
    for (const p of problems) console.log(p);
  }

  console.log(`\n--- Current-vs-backup raw diff (beyond the expected 3+4 flip) ---`);
  console.log(diffNotes.length ? diffNotes.join("\n") : "  none — every human bracket differs from backup by EXACTLY the home/away swap at indices 3+4; bot untouched.");

  // (6) Spot-check 3 human users: group A scores[4] = MEX (home) vs RSA (away) canonically.
  console.log(`\n--- Spot-check: group A scores[4] (canonical: home=MEX, away=RSA) ---`);
  const humans = rows.filter((r) => r.user_id !== BOT_USER_ID).slice(0, 3);
  for (const r of humans) {
    const name = r.profiles?.display_name || r.user_id.slice(0, 8);
    const s = r.group_predictions?.A?.scores?.[4];
    const bs = backupByUser.get(r.user_id)?.group_predictions?.A?.scores?.[4];
    const verdict = s && s.home !== null && s.away !== null
      ? s.home > s.away ? "MEX win" : s.home < s.away ? "RSA win (!)" : "draw"
      : "empty";
    console.log(`  ${name}: now MEX ${s?.home}-${s?.away} RSA => ${verdict}   (pre-migration raw: ${JSON.stringify(bs)})`);
  }

  console.log(`\nSummary: ${groupsChecked} user-groups checked.`);
  console.log(`  Current-scores vs stored-order mismatches : ${mismatchCurrent}`);
  console.log(`  Backup provenance mismatches (old orient.) : ${mismatchBackup}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
