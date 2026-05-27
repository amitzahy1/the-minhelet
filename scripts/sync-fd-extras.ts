/**
 * Pull the "extra" Football-Data.org data we don't get from /matches:
 *
 *   1. Team crests for all 48 participating teams → fd-crests.json
 *      (used to replace flag emojis with the real federation badges)
 *
 *   2. Per-match venue + referees → fd-match-details.json
 *      (NULL pre-tournament; FD populates 24-48h before kickoff. Re-run this
 *      script daily during the tournament — Vercel cron does it for you,
 *      but it can also be triggered manually.)
 *
 * Rate limit: free tier is 10 req/min. 48 teams via 1 call + 104 matches via
 * 104 calls = ~105 calls. Throttles 7s/call. Total runtime ~12 min.
 *
 * Run: `npx tsx scripts/sync-fd-extras.ts`
 */

import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const TOKEN = process.env.FOOTBALL_DATA_TOKEN!;
const BASE = "https://api.football-data.org/v4";
const headers = { "X-Auth-Token": TOKEN };
const ROOT = path.resolve(__dirname, "..");
const CRESTS_PATH = path.join(ROOT, "src/lib/tournament/fd-crests.json");
const DETAILS_PATH = path.join(ROOT, "src/lib/tournament/fd-match-details.json");

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

interface FdTeam { id: number; tla?: string; name?: string; crest?: string }
interface CrestsFile { syncedAt: string; crests: Record<string, { name: string; crest: string; id: number }> }

interface FdReferee { id: number; name: string; type?: string; nationality?: string }
interface MatchDetail {
  utcDate?: string;
  stage?: string;
  status?: string;
  venue?: string | null;
  referees?: FdReferee[];
  score?: {
    duration?: string;
    fullTime?: { home: number | null; away: number | null };
    penalties?: { home: number | null; away: number | null };
  };
}
interface DetailsFile {
  syncedAt: string;
  matches: Record<string, {
    venue: string | null;
    referees: { name: string; role: string; nationality: string | null }[];
    stage: string | null;
    status: string | null;
  }>;
}

async function syncTeamCrests(): Promise<void> {
  console.log("→ Fetching /competitions/WC/teams?season=2026 ...");
  const res = await fetch(`${BASE}/competitions/WC/teams?season=2026`, { headers });
  if (!res.ok) throw new Error(`teams HTTP ${res.status}`);
  const j = await res.json() as { teams?: FdTeam[] };
  const out: CrestsFile = { syncedAt: new Date().toISOString(), crests: {} };
  for (const t of j.teams || []) {
    const code = t.tla;
    if (!code || !t.crest) continue;
    out.crests[code] = { name: t.name || code, crest: t.crest, id: t.id };
  }
  fs.writeFileSync(CRESTS_PATH, JSON.stringify(out, null, 2));
  console.log(`✓ Wrote ${Object.keys(out.crests).length} crests → ${CRESTS_PATH}`);
}

async function syncMatchDetails(): Promise<void> {
  console.log("→ Fetching match list to enumerate IDs ...");
  const listRes = await fetch(`${BASE}/competitions/WC/matches?season=2026`, { headers });
  if (!listRes.ok) throw new Error(`matches HTTP ${listRes.status}`);
  const list = await listRes.json() as { matches?: Array<{ id: number; venue?: string | null; referees?: FdReferee[] }> };
  const matchIds = (list.matches || []).map((m) => m.id);
  console.log(`→ Found ${matchIds.length} matches. Fetching detail for each (throttled 7s)...`);

  // Preserve existing entries so a re-run mid-tournament doesn't lose finished-match enrichment.
  let existing: DetailsFile = { syncedAt: new Date().toISOString(), matches: {} };
  if (fs.existsSync(DETAILS_PATH)) {
    try { existing = JSON.parse(fs.readFileSync(DETAILS_PATH, "utf8")); } catch { /* keep default */ }
  }

  let withVenue = 0;
  let withReferees = 0;
  for (let i = 0; i < matchIds.length; i++) {
    const id = matchIds[i];
    try {
      const r = await fetch(`${BASE}/matches/${id}`, { headers });
      if (!r.ok) {
        console.log(`  [${i + 1}/${matchIds.length}] ${id} HTTP ${r.status} — keeping existing`);
        await sleep(7000);
        continue;
      }
      const d = await r.json() as MatchDetail;
      existing.matches[String(id)] = {
        venue: d.venue ?? null,
        stage: d.stage ?? null,
        status: d.status ?? null,
        referees: (d.referees || []).map((ref) => ({
          name: ref.name,
          role: ref.type || "REFEREE",
          nationality: ref.nationality || null,
        })),
      };
      if (existing.matches[String(id)].venue) withVenue++;
      if (existing.matches[String(id)].referees.length > 0) withReferees++;
      if ((i + 1) % 10 === 0) {
        // Save progress every 10 matches in case the script gets killed.
        existing.syncedAt = new Date().toISOString();
        fs.writeFileSync(DETAILS_PATH, JSON.stringify(existing, null, 2));
      }
      if ((i + 1) % 25 === 0 || i === matchIds.length - 1) {
        console.log(`  [${i + 1}/${matchIds.length}] venue=${withVenue} referees=${withReferees}`);
      }
    } catch (e) {
      console.log(`  [${i + 1}/${matchIds.length}] ${id} error:`, String(e).slice(0, 60));
    }
    await sleep(7000);
  }

  existing.syncedAt = new Date().toISOString();
  fs.writeFileSync(DETAILS_PATH, JSON.stringify(existing, null, 2));
  console.log(`✓ Wrote ${Object.keys(existing.matches).length} match details — ${withVenue} with venue, ${withReferees} with referees → ${DETAILS_PATH}`);
}

async function main() {
  const mode = process.argv[2] || "all";
  if (mode === "crests" || mode === "all") await syncTeamCrests();
  if (mode === "details" || mode === "all") await syncMatchDetails();
}

void main().catch((e) => { console.error(e); process.exit(1); });
