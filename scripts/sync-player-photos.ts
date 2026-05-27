/**
 * Player photo sync — pulls each announced national team's current squad
 * from API-Football and merges the photo URLs into squads-api.json so
 * every player on the announced 26 has an avatar on the squads page.
 *
 * Strategy:
 *   1. For each announced team (per OFFICIAL_SQUADS), look up its API
 *      team-id via the team-search endpoint (cached after first hit).
 *   2. Fetch `/players/squads?team=<id>` — returns the federation's
 *      current squad with photo URLs.
 *   3. Fuzzy-match each returned player against OFFICIAL_ROSTERS to attach
 *      the right photo to the right `nameEn`.
 *   4. Merge into src/lib/tournament/squads-api.json (preserve existing
 *      entries, only add new players + update photos that were null).
 *
 * Rate limit: API-Football free tier is 100 req/day, 10/min. We throttle
 * 7s between requests. 26 teams = ~3 minutes total.
 *
 * Run: `npx tsx scripts/sync-player-photos.ts`
 */

import * as fs from "fs";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

void createClient; // type import warm-up; keeps tsx happy with the dynamic require below

function loadEnv(): void {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv();

const API_KEY = process.env.API_FOOTBALL_KEY;
const API_HOST = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
if (!API_KEY) {
  console.error("✗ API_FOOTBALL_KEY missing in .env.local");
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");
const SQUADS_API_PATH = path.join(ROOT, "src/lib/tournament/squads-api.json");
const ROSTERS_PATH = path.join(ROOT, "src/lib/tournament/official-rosters.ts");
const TEAM_ID_CACHE_PATH = path.join(__dirname, "api-football-team-ids.json");

// Search-name overrides — TLA → full English country name. Hard-mapping all
// 26 announced (+ a few extras) so we never have to rely on api-football's
// search interpreting our 3-letter code correctly. Lowering false-positive
// hits like "ESP" → wrong team id 19195.
const SEARCH_NAME: Record<string, string> = {
  ARG: "Argentina", AUS: "Australia", AUT: "Austria", BEL: "Belgium",
  BIH: "Bosnia and Herzegovina", BRA: "Brazil", CAN: "Canada", CIV: "Ivory Coast",
  COD: "DR Congo", COL: "Colombia", CPV: "Cape Verde", CRO: "Croatia",
  CUR: "Curacao", CZE: "Czech Republic", ECU: "Ecuador", EGY: "Egypt",
  ENG: "England", ESP: "Spain", FRA: "France", GER: "Germany",
  GHA: "Ghana", HAI: "Haiti", IRN: "Iran", IRQ: "Iraq",
  ITA: "Italy", JOR: "Jordan", JPN: "Japan", KOR: "South Korea",
  KSA: "Saudi Arabia", MAR: "Morocco", MEX: "Mexico", NED: "Netherlands",
  NOR: "Norway", NZL: "New Zealand", PAN: "Panama", PAR: "Paraguay",
  POR: "Portugal", QAT: "Qatar", RSA: "South Africa", SCO: "Scotland",
  SEN: "Senegal", SUI: "Switzerland", SWE: "Sweden", TUN: "Tunisia",
  TUR: "Türkiye", URU: "Uruguay", USA: "USA", UZB: "Uzbekistan",
  ALG: "Algeria",
};

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function api<T>(path: string): Promise<T> {
  const res = await fetch(`https://${API_HOST}${path}`, {
    headers: { "x-apisports-key": API_KEY! },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${path}`);
  return (await res.json()) as T;
}

interface SearchTeamResponse {
  response: { team: { id: number; name: string; country: string; national: boolean } }[];
}

interface SquadResponse {
  response: {
    team: { id: number; name: string };
    players: { id: number; name: string; age: number; number: number; position: string; photo: string }[];
  }[];
}

function loadTeamIdCache(): Record<string, number> {
  try { return JSON.parse(fs.readFileSync(TEAM_ID_CACHE_PATH, "utf8")); }
  catch { return {}; }
}
function saveTeamIdCache(cache: Record<string, number>) {
  fs.writeFileSync(TEAM_ID_CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function findTeamId(code: string): Promise<number | null> {
  const query = SEARCH_NAME[code] || code;
  const data = await api<SearchTeamResponse>(`/teams?search=${encodeURIComponent(query)}`);
  const teams = data.response.map((r) => r.team);
  // Strict senior national team filter:
  //   1. .national === true (must be a national team)
  //   2. Country matches the search query exactly (avoids picking another
  //      country's team that happens to have a similar name)
  //   3. Name doesn't include youth / women / Olympic tags
  const youthRe = /U-?\d{2}|Olympic|Women|\bW\b|\bWomen's\b/i;
  const senior = teams.filter(
    (t) =>
      t.national &&
      !youthRe.test(t.name) &&
      (t.country === query || t.name === query),
  );
  if (senior.length > 0) return senior[0].id;
  // Fallback: any national team that isn't youth/women, in case country/name
  // don't match the search string exactly (e.g. "Türkiye" stored differently).
  const looser = teams.filter((t) => t.national && !youthRe.test(t.name));
  return looser[0]?.id ?? null;
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

interface ApiPlayer { nameEn: string; num: number; pos: "GK" | "DEF" | "MID" | "FW"; photo: string; age: number; club?: string }
interface OfficialRoster { nameEn: string; pos: "GK" | "DEF" | "MID" | "FW"; club: string; starter?: boolean }

function fuzzyMatchByName(target: string, candidates: ApiPlayer[]): ApiPlayer | null {
  let hit = candidates.find((c) => c.nameEn === target);
  if (hit) return hit;
  const last = target.split(/\s+/).pop() || "";
  if (last.length >= 3) {
    hit = candidates.find(
      (c) =>
        c.nameEn === last ||
        c.nameEn.endsWith(` ${last}`) ||
        c.nameEn.endsWith(`. ${last}`) ||
        c.nameEn.endsWith(`-${last}`),
    );
    if (hit) return hit;
  }
  const nl = norm(last);
  if (nl.length >= 3) {
    hit = candidates.find((c) => norm(c.nameEn).split(/\s+/).some((t) => t === nl || t.endsWith(nl)));
    if (hit) return hit;
  }
  // Initial-surname pattern ("A. Silva" → "António Silva").
  const im = target.match(/^([A-Za-z])\.\s*(.+)$/);
  if (im) {
    const [, initial, surname] = im;
    const sN = norm(surname);
    hit = candidates.find((c) => {
      const first = c.nameEn.split(/\s+/)[0];
      return first && first[0].toUpperCase() === initial.toUpperCase() && norm(c.nameEn).includes(sN);
    });
    if (hit) return hit;
  }
  return null;
}

function positionFromApi(pos: string): "GK" | "DEF" | "MID" | "FW" {
  const s = pos.toLowerCase();
  if (s.startsWith("goal")) return "GK";
  if (s.startsWith("def")) return "DEF";
  if (s.startsWith("mid")) return "MID";
  return "FW";
}

function isWellCovered(roster: OfficialRoster[], apiData: { players: ApiPlayer[] }): boolean {
  if (!roster.length || !apiData.players?.length) return false;
  const byName = new Map(apiData.players.map((p) => [p.nameEn, p]));
  let missing = 0;
  for (const rp of roster) {
    const direct = byName.get(rp.nameEn);
    if (direct?.photo) continue;
    // Also check last-token fallback (matches getSquad() merge logic).
    const last = rp.nameEn.split(/\s+/).pop() || "";
    const fallback = last.length >= 3 && apiData.players.find(
      (p) => p.nameEn === last || p.nameEn.endsWith(` ${last}`) || p.nameEn.endsWith(`. ${last}`),
    );
    if (fallback?.photo) continue;
    missing++;
  }
  // ≥90% covered → don't re-fetch this team on retry.
  return missing / roster.length < 0.1;
}

async function main() {
  const apiData = JSON.parse(fs.readFileSync(SQUADS_API_PATH, "utf8")) as Record<string, { players: ApiPlayer[]; logo?: string }>;
  const rostersModule = await import(ROSTERS_PATH);
  const officialRosters = rostersModule.OFFICIAL_ROSTERS as Record<string, OfficialRoster[]>;
  const officialSquadsModule = await import(path.join(ROOT, "src/lib/tournament/official-squads.ts"));
  const announced = Object.keys(officialSquadsModule.OFFICIAL_SQUADS) as string[];

  const teamIds = loadTeamIdCache();
  let photosAdded = 0;
  let playersAdded = 0;
  let teamsHit = 0;

  for (const code of announced.sort()) {
    const roster = officialRosters[code];
    if (!roster) continue;

    // Skip teams that are already well-covered (≥90% of starters have photos).
    if (apiData[code] && isWellCovered(roster, apiData[code])) {
      console.log(`[${code}] already well-covered, skipping`);
      continue;
    }

    // Resolve team id (cache).
    if (!teamIds[code]) {
      try {
        const id = await findTeamId(code);
        if (!id) {
          console.log(`[${code}] team-id lookup returned no result, skipping`);
          continue;
        }
        teamIds[code] = id;
        saveTeamIdCache(teamIds);
        await sleep(7000); // rate-limit between search calls
      } catch (e) {
        console.log(`[${code}] team-id lookup failed: ${e}`);
        continue;
      }
    }

    // Fetch the squad.
    let squadResp: SquadResponse | null = null;
    try {
      squadResp = await api<SquadResponse>(`/players/squads?team=${teamIds[code]}`);
    } catch (e) {
      console.log(`[${code}] squad fetch failed: ${e}`);
      await sleep(7000);
      continue;
    }
    await sleep(7000);

    const apiPlayers: ApiPlayer[] = (squadResp.response?.[0]?.players || []).map((p) => ({
      nameEn: p.name,
      num: p.number,
      pos: positionFromApi(p.position),
      photo: p.photo,
      age: p.age,
    }));

    if (apiPlayers.length === 0) {
      console.log(`[${code}] empty squad response`);
      continue;
    }
    teamsHit++;

    // Merge: for each official-roster player, ensure squads-api has an entry
    // with a photo. If not, fuzzy-match into the api response and grab it.
    const existing = apiData[code] || { players: [] };
    const byName = new Map<string, ApiPlayer>(existing.players.map((p) => [p.nameEn, p]));

    let teamAdds = 0;
    for (const rp of roster) {
      const existingPlayer = byName.get(rp.nameEn);
      if (existingPlayer?.photo) continue; // already has a photo, skip

      // Try to fuzzy-match against the api response.
      const apiMatch = fuzzyMatchByName(rp.nameEn, apiPlayers);
      if (!apiMatch) continue;

      if (existingPlayer) {
        existingPlayer.photo = apiMatch.photo;
        existingPlayer.num = existingPlayer.num || apiMatch.num;
        existingPlayer.age = existingPlayer.age || apiMatch.age;
        photosAdded++;
      } else {
        existing.players.push({
          nameEn: rp.nameEn,
          num: apiMatch.num,
          pos: rp.pos,
          photo: apiMatch.photo,
          age: apiMatch.age,
          club: rp.club || apiMatch.club,
        });
        playersAdded++;
      }
      teamAdds++;
    }
    apiData[code] = existing;
    console.log(`[${code}] +${teamAdds} photo(s) (api roster had ${apiPlayers.length} players, our roster has ${roster.length})`);
  }

  fs.writeFileSync(SQUADS_API_PATH, JSON.stringify(apiData, null, 2));
  console.log("");
  console.log(`✓ Hit ${teamsHit}/${announced.length} teams`);
  console.log(`✓ Added ${photosAdded} photos to existing entries, created ${playersAdded} new entries`);
  console.log(`✓ Wrote ${SQUADS_API_PATH}`);
}

void main().catch((e) => { console.error(e); process.exit(1); });
