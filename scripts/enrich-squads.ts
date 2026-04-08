/**
 * Squad Enrichment Script — Adds club information to all players in squads-api.json
 *
 * Strategy: Fetch club squads from API-Football for the top ~80 clubs, then
 * cross-reference player IDs (extracted from photo URLs) with our national team data.
 *
 * Run: npx tsx scripts/enrich-squads.ts
 *
 * The script saves progress between runs (club-squads-cache.json) so you can
 * run it across multiple days if you hit the 100 req/day limit.
 *
 * After enrichment, players that couldn't be matched to a club will have club: "".
 */

import * as fs from "fs";
import * as path from "path";

const API_KEY = process.env.API_FOOTBALL_KEY || "bf9c9c08ac73c3896876105278ea7a2c";
const API_HOST = "v3.football.api-sports.io";

// --------------------------------------------------------------------------
// Top clubs where World Cup players typically play
// Format: { clubName: apiFootballTeamId }
// --------------------------------------------------------------------------
const TOP_CLUBS: Record<string, number> = {
  // England — Premier League
  "Arsenal": 42, "Aston Villa": 66, "Bournemouth": 35, "Brighton": 51,
  "Chelsea": 49, "Crystal Palace": 52, "Everton": 45, "Fulham": 36,
  "Ipswich": 57, "Leicester": 46, "Liverpool": 40, "Man City": 50,
  "Man United": 33, "Newcastle": 34, "Nottingham Forest": 65, "Tottenham": 47,
  "West Ham": 48, "Wolves": 39, "Southampton": 41, "Brentford": 55,

  // Spain — La Liga
  "Real Madrid": 541, "Barcelona": 529, "Atlético Madrid": 530,
  "Sevilla": 536, "Real Sociedad": 548, "Villarreal": 533,
  "Athletic Club": 531, "Real Betis": 543, "Girona": 547,
  "Valencia": 532, "Celta Vigo": 538, "Getafe": 546,
  "Osasuna": 727, "Mallorca": 798, "Rayo Vallecano": 728,

  // Germany — Bundesliga
  "Bayern": 157, "Dortmund": 165, "Leverkusen": 168,
  "RB Leipzig": 173, "Freiburg": 160, "Stuttgart": 172,
  "Wolfsburg": 161, "Frankfurt": 169, "Gladbach": 163,
  "Hoffenheim": 167, "Mainz": 164, "Union Berlin": 182, "Augsburg": 170,

  // Italy — Serie A
  "Inter": 505, "Milan": 489, "Juventus": 496, "Napoli": 492,
  "Roma": 497, "Lazio": 487, "Atalanta": 499, "Fiorentina": 502,
  "Bologna": 500, "Torino": 503, "Genoa": 495, "Udinese": 494,
  "Monza": 1579, "Cagliari": 490, "Parma": 511,

  // France — Ligue 1
  "PSG": 85, "Marseille": 81, "Lyon": 80, "Monaco": 91,
  "Lille": 79, "Nice": 84, "Lens": 116, "Rennes": 94,
  "Strasbourg": 95, "Toulouse": 96, "Nantes": 83, "Montpellier": 82,

  // Portugal — Primeira Liga
  "Porto": 212, "Benfica": 211, "Sporting CP": 228,
  "Braga": 217,

  // Netherlands — Eredivisie
  "Ajax": 194, "PSV": 197, "Feyenoord": 215, "AZ": 202,

  // Turkey — Super Lig
  "Galatasaray": 645, "Fenerbahçe": 611, "Beşiktaş": 549,
  "Trabzonspor": 607,

  // Belgium — Pro League
  "Club Brugge": 569, "Anderlecht": 554, "Genk": 631,

  // Scotland
  "Celtic": 247, "Rangers": 257,

  // Saudi Arabia
  "Al-Hilal": 2932, "Al-Nassr": 2939, "Al-Ittihad": 2934,
  "Al-Ahli": 2933,

  // Other important clubs
  "Bröndby": 400, "Copenhagen": 397, // Denmark
  "Salzburg": 571, "Rapid Vienna": 573, // Austria
  "Dynamo Kyiv": 334, "Shakhtar": 338, // Ukraine
  "Olympiacos": 314, "PAOK": 311, // Greece
  "Red Star": 591, // Serbia
  "Slavia Prague": 553, "Sparta Prague": 555, // Czech Republic
  "Zürich": 781, "Basel": 789, "Young Boys": 788, // Switzerland
  "Malmö": 368, "Hammarby": 367, // Sweden
  "Bodø/Glimt": 342, // Norway
  "Al-Duhail": 2948, "Al-Sadd": 2949, // Qatar
  "Al-Shabab": 2935, // Saudi
  "Pachuca": 2283, "América": 2277, "Monterrey": 2282, "Toluca": 2286, "Cruz Azul": 2281, // Mexico
  "Santos": 756, "Fluminense": 753, "Palmeiras": 754, "Flamengo": 755, "Internacional": 759, // Brazil
  "River Plate": 435, "Boca Juniors": 451, // Argentina
  "Nacional": 2364, "Peñarol": 2363, // Uruguay
  "Atlanta United": 1598, "Inter Miami": 9568, "LA Galaxy": 1599, "LAFC": 1605, // MLS
  "Chicago Fire": 1606,
  "Al-Ain": 2926, // UAE
  "Krasnodar": 891, // Russia
  "Shanghai Port": 1700, // China
  "Gamba Osaka": 282, "Kawasaki": 284, // Japan
  "Jeonbuk": 2763, // Korea
  "Salernitana": 514, // Italy
  "Almería": 723, // Spain
};

// --------------------------------------------------------------------------

interface ClubPlayer {
  id: number;
  name: string;
  position: string;
}

interface ClubCache {
  [clubName: string]: {
    teamId: number;
    players: ClubPlayer[];
    fetchedAt: string;
  };
}

interface SquadApiPlayer {
  nameEn: string;
  num: number;
  pos: "GK" | "DEF" | "MID" | "FW";
  photo: string;
  age: number;
  club?: string;
}

interface SquadApiTeam {
  players: SquadApiPlayer[];
  logo?: string;
}

function extractPlayerId(photoUrl: string): number | null {
  const match = photoUrl.match(/\/players\/(\d+)\./);
  return match ? parseInt(match[1]) : null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchClubSquad(clubName: string, teamId: number): Promise<ClubPlayer[] | "rate-limited"> {
  const url = `https://${API_HOST}/players/squads?team=${teamId}`;
  const res = await fetch(url, {
    headers: { "x-apisports-key": API_KEY },
  });

  if (!res.ok) {
    console.error(`  HTTP ${res.status} for ${clubName} (ID: ${teamId})`);
    return [];
  }

  const data = await res.json();

  // Check for rate limiting
  if (data.errors?.rateLimit) {
    return "rate-limited";
  }

  const entry = data.response?.[0];
  if (!entry?.players) return [];

  return entry.players.map((p: { id: number; name: string; position: string }) => ({
    id: p.id,
    name: p.name,
    position: p.position,
  }));
}

async function checkApiQuota(): Promise<{ current: number; limit: number }> {
  const res = await fetch(`https://${API_HOST}/status`, {
    headers: { "x-apisports-key": API_KEY },
  });
  const data = await res.json();
  return {
    current: data.response?.requests?.current || 0,
    limit: data.response?.requests?.limit_day || 100,
  };
}

async function main() {
  const squadsPath = path.join(__dirname, "..", "src", "lib", "tournament", "squads-api.json");
  const cachePath = path.join(__dirname, "club-squads-cache.json");

  // Load squads data
  const squads: Record<string, SquadApiTeam> = JSON.parse(fs.readFileSync(squadsPath, "utf-8"));

  // Build player ID -> team+index map from our national team data
  const playerIdMap = new Map<number, { teamCode: string; playerIndex: number }[]>();
  for (const [teamCode, team] of Object.entries(squads)) {
    for (let i = 0; i < team.players.length; i++) {
      const p = team.players[i];
      const pid = extractPlayerId(p.photo);
      if (pid) {
        const entries = playerIdMap.get(pid) || [];
        entries.push({ teamCode, playerIndex: i });
        playerIdMap.set(pid, entries);
      }
    }
  }

  console.log(`Total unique player IDs in squads: ${playerIdMap.size}`);

  // Load or initialize club cache
  let cache: ClubCache = {};
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
  } catch { /* first run */ }

  const alreadyCached = new Set(Object.keys(cache));
  const clubsToFetch = Object.entries(TOP_CLUBS).filter(([name]) => !alreadyCached.has(name));

  console.log(`\nClub squads cache: ${alreadyCached.size} clubs already cached`);
  console.log(`Clubs to fetch: ${clubsToFetch.length}`);

  // Check API quota
  const quota = await checkApiQuota();
  const remaining = quota.limit - quota.current;
  console.log(`API quota: ${quota.current}/${quota.limit} used, ${remaining} remaining`);

  if (clubsToFetch.length > 0 && remaining > 1) {
    const batchSize = Math.min(clubsToFetch.length, remaining - 1); // leave 1 for safety
    console.log(`\nFetching ${batchSize} club squads (7s between requests to avoid rate limit)...\n`);

    let rateLimitHits = 0;

    for (let i = 0; i < batchSize; i++) {
      const [clubName, teamId] = clubsToFetch[i];
      process.stdout.write(`  [${i + 1}/${batchSize}] ${clubName} (ID: ${teamId})... `);

      try {
        const result = await fetchClubSquad(clubName, teamId);
        if (result === "rate-limited") {
          console.log("RATE LIMITED - waiting 60s...");
          rateLimitHits++;
          await sleep(60000); // Wait a full minute
          // Retry
          process.stdout.write(`  [${i + 1}/${batchSize}] ${clubName} (ID: ${teamId}) [RETRY]... `);
          const retry = await fetchClubSquad(clubName, teamId);
          if (retry === "rate-limited") {
            console.log("still rate limited, skipping");
            continue;
          }
          if (retry.length > 0) {
            cache[clubName] = { teamId, players: retry, fetchedAt: new Date().toISOString() };
            console.log(`${retry.length} players`);
          } else {
            console.log("no players found");
          }
        } else if (result.length > 0) {
          cache[clubName] = { teamId, players: result, fetchedAt: new Date().toISOString() };
          console.log(`${result.length} players`);
        } else {
          console.log("no players found");
        }
      } catch (e) {
        console.log(`error: ${e}`);
      }

      // Save cache periodically (every 10 clubs)
      if ((i + 1) % 10 === 0) {
        fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
      }

      // Respect 10 req/min limit: wait 7 seconds between requests
      if (i < batchSize - 1) await sleep(7000);
    }

    // Save cache
    fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2), "utf-8");
    console.log(`\nCache saved: ${cachePath}`);
    if (rateLimitHits > 0) {
      console.log(`Rate limit hits: ${rateLimitHits}`);
    }
  }

  // --------------------------------------------------------------------------
  // Phase 2: Cross-reference club players with national team players
  // --------------------------------------------------------------------------
  console.log("\n--- Cross-referencing players with clubs ---\n");

  // Build club player ID -> club name map
  const clubByPlayerId = new Map<number, string>();
  for (const [clubName, data] of Object.entries(cache)) {
    for (const p of data.players) {
      clubByPlayerId.set(p.id, clubName);
    }
  }

  console.log(`Club players in cache: ${clubByPlayerId.size}`);

  // Enrich squads-api.json
  let matched = 0;
  let unmatched = 0;
  const unmatchedPlayers: { team: string; name: string; id: number }[] = [];

  for (const [teamCode, team] of Object.entries(squads)) {
    for (let i = 0; i < team.players.length; i++) {
      const p = team.players[i];
      // Skip if already has a club
      if (p.club) continue;

      const pid = extractPlayerId(p.photo);
      if (pid && clubByPlayerId.has(pid)) {
        team.players[i] = { ...p, club: clubByPlayerId.get(pid)! };
        matched++;
      } else {
        unmatched++;
        if (pid) unmatchedPlayers.push({ team: teamCode, name: p.nameEn, id: pid });
      }
    }
  }

  console.log(`\nMatched: ${matched} players with clubs`);
  console.log(`Unmatched: ${unmatched} players (missing club data)`);

  if (unmatchedPlayers.length > 0 && unmatchedPlayers.length <= 50) {
    console.log("\nUnmatched players:");
    for (const p of unmatchedPlayers) {
      console.log(`  ${p.team}: ${p.name} (ID: ${p.id})`);
    }
  }

  // --------------------------------------------------------------------------
  // Phase 3: Also merge club info from the manual squads-data.ts
  // (for teams that have manual data with clubs)
  // --------------------------------------------------------------------------
  // This is handled at runtime in squads-data.ts, but we can also bake it in

  // --------------------------------------------------------------------------
  // Phase 4: Write enriched data back
  // --------------------------------------------------------------------------
  fs.writeFileSync(squadsPath, JSON.stringify(squads, null, 2), "utf-8");
  console.log(`\nSaved enriched squads to: ${squadsPath}`);

  // Print stats per team
  console.log("\n--- Per-team coverage ---\n");
  for (const [code, team] of Object.entries(squads)) {
    const withClub = team.players.filter(p => p.club).length;
    const total = team.players.length;
    const pct = Math.round((withClub / total) * 100);
    const bar = pct === 100 ? "FULL" : `${pct}%`;
    console.log(`  ${code}: ${withClub}/${total} (${bar})`);
  }
}

main().catch(console.error);
