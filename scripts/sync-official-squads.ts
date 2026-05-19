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
  const skipped: string[] = [];

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

  const targetPath = path.resolve(__dirname, "..", "src", "lib", "tournament", "official-squads.ts");
  const existing = fs.readFileSync(targetPath, "utf8");
  const startMarker = "// <generated-start>";
  const endMarker = "// <generated-end>";
  const startIdx = existing.indexOf(startMarker);
  const endIdx = existing.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    console.error(`Could not find generated sentinels in ${targetPath} — refusing to overwrite`);
    process.exit(2);
  }
  const before = existing.slice(0, startIdx + startMarker.length);
  const after = existing.slice(endIdx);
  const next = `${before} — do not edit between these sentinels; regenerated by the scraper.\n${block}\n${after}`;
  fs.writeFileSync(targetPath, next, "utf8");

  const announced = entries.filter(([, s]) => s.state === "announced").length;
  const confirmed = entries.filter(([, s]) => s.state === "fifa_confirmed").length;
  console.log(`\n✓ Synced ${announced} announced, ${confirmed} FIFA-confirmed (${lastSync})`);
  console.log(`  Wrote ${targetPath}`);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
