/**
 * Official Squad Sync — scrape Wikipedia for WC2026 federation-announced & FIFA-confirmed squads.
 * Run: npx tsx scripts/sync-official-squads.ts
 *
 * Rewrites src/lib/tournament/official-squads.ts between the
 * <generated-start> / <generated-end> sentinel comments. Helpers in that
 * file are preserved.
 *
 * Today (2026-05-19): expect ~17 teams in state "announced", 0 FIFA-confirmed.
 * After June 2, 2026: re-run — Wikipedia lead should mention FIFA confirmation,
 * promoting all announced entries to "fifa_confirmed".
 */

import * as fs from "fs";
import * as path from "path";

const WIKI_URL = "https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_squads";

// Wikipedia H3 heading id → our 3-letter team code (matches src/lib/tournament/groups.ts).
const WIKI_TO_CODE: Record<string, string> = {
  // Group A
  Mexico: "MEX", South_Korea: "KOR", Czech_Republic: "CZE", South_Africa: "RSA",
  // Group B
  Canada: "CAN", Qatar: "QAT", Switzerland: "SUI", Bosnia_and_Herzegovina: "BIH",
  // Group C
  Brazil: "BRA", Morocco: "MAR", Scotland: "SCO", Haiti: "HAI",
  // Group D
  United_States: "USA", Paraguay: "PAR", Turkey: "TUR", Australia: "AUS",
  // Group E
  Germany: "GER", Ecuador: "ECU", Ivory_Coast: "CIV", "Curaçao": "CUR",
  // Group F
  Netherlands: "NED", Japan: "JPN", Sweden: "SWE", Tunisia: "TUN",
  // Group G
  Belgium: "BEL", Iran: "IRN", Egypt: "EGY", New_Zealand: "NZL",
  // Group H
  Spain: "ESP", Uruguay: "URU", Saudi_Arabia: "KSA", Cape_Verde: "CPV",
  // Group I
  France: "FRA", Senegal: "SEN", Norway: "NOR", Iraq: "IRQ",
  // Group J
  Argentina: "ARG", Austria: "AUT", Algeria: "ALG", Jordan: "JOR",
  // Group K
  Portugal: "POR", Colombia: "COL", Uzbekistan: "UZB", DR_Congo: "COD",
  // Group L
  England: "ENG", Croatia: "CRO", Ghana: "GHA", Panama: "PAN",
};

const MONTHS: Record<string, string> = {
  January: "01", February: "02", March: "03", April: "04", May: "05", June: "06",
  July: "07", August: "08", September: "09", October: "10", November: "11", December: "12",
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractSection(html: string, id: string): string | null {
  const re = new RegExp(`<h3[^>]*id="${escapeRegex(id)}"[^>]*>`);
  const m = html.match(re);
  if (!m || m.index === undefined) return null;
  const rest = html.slice(m.index + m[0].length);
  const nextHeading = rest.search(/<div class="mw-heading mw-heading[23]"|<h[23]\b/);
  return nextHeading > 0 ? rest.slice(0, nextHeading) : rest.slice(0, 50_000);
}

function parseAnnouncementDate(section: string): string | null {
  const re = /(?:announced (?:their|its|her) final squad on|final squad was announced on)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*(\d{4}))?/i;
  const m = section.match(re);
  if (!m) return null;
  const month = MONTHS[m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase()];
  if (!month) return null;
  const day = m[2].padStart(2, "0");
  const year = m[3] ?? "2026";
  return `${year}-${month}-${day}`;
}

function detectFifaConfirmation(html: string): string | null {
  // Pattern A: "FIFA confirmed [all] [48] squads on May 18[, 2026]"
  const a = html.match(/FIFA confirmed (?:all )?(?:48 )?(?:final )?squads?(?:[^.]*?)on\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*(\d{4}))?/i);
  if (a) {
    const month = MONTHS[a[1].charAt(0).toUpperCase() + a[1].slice(1).toLowerCase()];
    const day = a[2].padStart(2, "0");
    const year = a[3] ?? "2026";
    return `${year}-${month}-${day}`;
  }
  // Pattern B: "[All] [final] squads were confirmed by FIFA on 18 May[ 2026]"
  const b = html.match(/(?:All )?(?:final )?squads? (?:were )?confirmed by FIFA on\s+(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)(?:\s+(\d{4}))?/i);
  if (b) {
    const month = MONTHS[b[2].charAt(0).toUpperCase() + b[2].slice(1).toLowerCase()];
    const day = b[1].padStart(2, "0");
    const year = b[3] ?? "2026";
    return `${year}-${month}-${day}`;
  }
  return null;
}

interface SyncedStatus {
  state: "announced" | "fifa_confirmed";
  announcedAt: string;
  confirmedAt?: string;
  source: string;
}

interface ScrapedPlayer {
  nameEn: string;
  pos: "GK" | "DEF" | "MID" | "FW";
  club: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripHtml(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

const POS_MAP: Record<string, ScrapedPlayer["pos"]> = {
  GK: "GK",
  DF: "DEF",
  MF: "MID",
  FW: "FW",
};

function parsePlayerRows(section: string): ScrapedPlayer[] {
  const tableMatch = section.match(/<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) return [];
  const rows = tableMatch[1].split(/<tr class="nat-fs-player">/).slice(1);
  const players: ScrapedPlayer[] = [];
  for (const row of rows) {
    const posMatch = row.match(/<span style="display:none">\d+<\/span><a[^>]*>(GK|DF|MF|FW)<\/a>/);
    if (!posMatch) continue;
    const pos = POS_MAP[posMatch[1]];
    // Name lives in <th ... scope="row">…</th>. Strip any link, then "(captain)" annotation.
    const thMatch = row.match(/<th[^>]*scope="row"[^>]*>([\s\S]*?)<\/th>/);
    if (!thMatch) continue;
    let rawName = thMatch[1];
    // Remove the "(captain)" italic small-tag suffix entirely
    rawName = rawName.replace(/<small>[\s\S]*?<\/small>/g, "");
    const nameEn = stripHtml(rawName);
    if (!nameEn) continue;
    // Club is the last <td style="text-align:left">: it always contains a flag span + a club link.
    // Grab the last <a>…</a> inside that td.
    const clubTdMatch = row.match(/<td style="text-align:left"[^>]*>([\s\S]*?)<\/td>\s*(?:<\/tr>|$)/);
    let club = "";
    if (clubTdMatch) {
      const links = [...clubTdMatch[1].matchAll(/<a[^>]*>([^<]+)<\/a>/g)];
      if (links.length) club = stripHtml(links[links.length - 1][1]);
    }
    players.push({ nameEn, pos, club });
  }
  return players;
}

function pickDefaultStarterNames(players: ScrapedPlayer[]): Set<string> {
  const target: Record<ScrapedPlayer["pos"], number> = { GK: 1, DEF: 4, MID: 3, FW: 3 };
  const picked = new Set<string>();
  for (const pos of ["GK", "DEF", "MID", "FW"] as const) {
    let count = 0;
    for (const p of players) {
      if (p.pos === pos && count < target[pos]) {
        picked.add(p.nameEn);
        count++;
      }
    }
  }
  return picked;
}

async function main(): Promise<void> {
  console.log(`Fetching ${WIKI_URL} ...`);
  const res = await fetch(WIKI_URL, { headers: { "User-Agent": "wc2026-app/1.0 (amitz@tailormed.co) sync-official-squads" } });
  if (!res.ok) {
    console.error(`Wikipedia fetch failed: HTTP ${res.status} ${res.statusText}`);
    process.exit(2);
  }
  const html = await res.text();
  if (html.length < 50_000) {
    console.error(`Suspiciously short page (${html.length} bytes) — aborting to avoid wiping existing data`);
    process.exit(2);
  }

  const synced: Record<string, SyncedStatus> = {};
  const rosters: Record<string, ScrapedPlayer[]> = {};
  const skipped: string[] = [];
  const rosterWarnings: string[] = [];

  for (const [wikiId, code] of Object.entries(WIKI_TO_CODE)) {
    const section = extractSection(html, wikiId);
    if (!section) {
      skipped.push(`${wikiId}: section not found`);
      continue;
    }
    const announcedAt = parseAnnouncementDate(section);
    if (!announcedAt) continue; // Federation hasn't published their final 26 yet
    synced[code] = {
      state: "announced",
      announcedAt,
      source: `${WIKI_URL}#${wikiId}`,
    };
    const players = parsePlayerRows(section);
    if (players.length < 23) {
      rosterWarnings.push(`${code}: only ${players.length} players parsed (expected 23–26)`);
    }
    if (players.length) {
      rosters[code] = players;
    }
  }

  const fifaDate = detectFifaConfirmation(html);
  if (fifaDate && new Date(fifaDate) <= new Date()) {
    for (const code of Object.keys(synced)) {
      synced[code].state = "fifa_confirmed";
      synced[code].confirmedAt = fifaDate;
    }
  }

  if (skipped.length) {
    console.warn(`\nSkipped sections (${skipped.length}):`);
    for (const s of skipped) console.warn(`  - ${s}`);
  }
  if (rosterWarnings.length) {
    console.warn(`\nRoster size warnings (${rosterWarnings.length}):`);
    for (const w of rosterWarnings) console.warn(`  - ${w}`);
  }

  const entries = Object.entries(synced).sort(([a], [b]) => a.localeCompare(b));
  const generatedBody = entries.map(([code, s]) => {
    const lines = [
      `  ${code}: {`,
      `    state: ${JSON.stringify(s.state)},`,
      `    announcedAt: ${JSON.stringify(s.announcedAt)},`,
    ];
    if (s.confirmedAt) lines.push(`    confirmedAt: ${JSON.stringify(s.confirmedAt)},`);
    lines.push(`    source: ${JSON.stringify(s.source)},`);
    lines.push(`  },`);
    return lines.join("\n");
  }).join("\n");

  const lastSync = new Date().toISOString();
  const block =
`export const OFFICIAL_SQUADS: Record<string, OfficialStatus> = {${entries.length ? "\n" + generatedBody + "\n" : ""}};
export const LAST_SYNC: string | null = ${JSON.stringify(lastSync)};`;

  const statusPath = path.resolve(__dirname, "..", "src", "lib", "tournament", "official-squads.ts");
  const existing = fs.readFileSync(statusPath, "utf8");
  const startMarker = "// <generated-start>";
  const endMarker = "// <generated-end>";
  const startIdx = existing.indexOf(startMarker);
  const endIdx = existing.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    console.error(`Could not find generated sentinels in ${statusPath} — refusing to overwrite`);
    process.exit(2);
  }
  const before = existing.slice(0, startIdx + startMarker.length);
  const after = existing.slice(endIdx);
  const next = `${before} — do not edit between these sentinels; regenerated by the scraper.\n${block}\n${after}`;
  fs.writeFileSync(statusPath, next, "utf8");

  // Write the per-team full rosters scraped from Wikipedia.
  const rosterEntries = Object.entries(rosters).sort(([a], [b]) => a.localeCompare(b));
  const rosterLines: string[] = [];
  for (const [code, players] of rosterEntries) {
    const starters = pickDefaultStarterNames(players);
    rosterLines.push(`  ${code}: [`);
    for (const p of players) {
      const isStarter = starters.has(p.nameEn);
      const parts = [
        `nameEn: ${JSON.stringify(p.nameEn)}`,
        `pos: ${JSON.stringify(p.pos)}`,
        `club: ${JSON.stringify(p.club)}`,
      ];
      if (isStarter) parts.push(`starter: true`);
      rosterLines.push(`    { ${parts.join(", ")} },`);
    }
    rosterLines.push(`  ],`);
  }
  const rosterBody = rosterLines.join("\n");
  const rosterFile =
`// ============================================================================
// WC2026 — Full 26-man rosters for federations that have announced their squads.
// Auto-generated by scripts/sync-official-squads.ts — DO NOT EDIT BY HAND.
// Source: ${WIKI_URL}
// Last sync: ${lastSync}
//
// Consumed by getSquad() in ./squads-data.ts, which prefers these rosters over
// the hand-curated estimates whenever a team appears here.
// ============================================================================

export interface OfficialRosterPlayer {
  nameEn: string;
  pos: "GK" | "DEF" | "MID" | "FW";
  club: string;
  starter?: boolean;
}

export const OFFICIAL_ROSTERS: Record<string, OfficialRosterPlayer[]> = {${rosterEntries.length ? "\n" + rosterBody + "\n" : ""}};
`;
  const rostersPath = path.resolve(__dirname, "..", "src", "lib", "tournament", "official-rosters.ts");
  fs.writeFileSync(rostersPath, rosterFile, "utf8");

  const announced = entries.filter(([, s]) => s.state === "announced").length;
  const confirmed = entries.filter(([, s]) => s.state === "fifa_confirmed").length;
  const rosterCount = rosterEntries.length;
  const totalPlayers = rosterEntries.reduce((sum, [, ps]) => sum + ps.length, 0);
  console.log(`\n✓ Synced ${announced} announced, ${confirmed} FIFA-confirmed (${lastSync})`);
  console.log(`✓ Rostered ${totalPlayers} players across ${rosterCount} teams`);
  console.log(`  Wrote ${statusPath}`);
  console.log(`  Wrote ${rostersPath}`);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
