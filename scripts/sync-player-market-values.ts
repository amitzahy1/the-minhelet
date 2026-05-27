/**
 * Player market-value sync — hybrid API-Football → Transfermarkt fallback.
 *
 * Phase 1: scan src/lib/tournament/squads-api.json (data we already have
 *          locally from api-sports.io). If the upstream feed ever exposes
 *          a marketValue-like field, use it. Today the free tier doesn't,
 *          so phase 1 mostly yields nothing.
 *
 * Phase 2: for every announced-roster player still missing a value, scrape
 *          Transfermarkt's public player search. Throttle to 1 req / 2 s
 *          to stay polite. Cache hits in scripts/transfermarkt-cache.json
 *          so re-runs after a roster refresh only fetch the new names.
 *
 * Output: rewrites src/lib/tournament/market-values.ts between the
 *         <generated-start> / <generated-end> sentinels. Hand-written
 *         helpers and curated values outside the sentinels are preserved.
 *
 * Run: `npx tsx scripts/sync-player-market-values.ts`
 *
 * Network notes: Transfermarkt is sometimes blocked by corporate firewalls
 * (Cato Networks intercepts the "Sports" category and returns a notice
 * page). Run from a non-corp network if every player resolves to "no value".
 * Only successful lookups are cached so a re-run will retry the blocked ones.
 */

import * as fs from "fs";
import * as path from "path";

interface OfficialPlayer { nameEn: string; club?: string; pos?: string }

const ROOT = path.resolve(__dirname, "..");
const MARKET_VALUES_PATH = path.join(ROOT, "src/lib/tournament/market-values.ts");
const ROSTERS_PATH = path.join(ROOT, "src/lib/tournament/official-rosters.ts");
const API_PATH = path.join(ROOT, "src/lib/tournament/squads-api.json");
const CACHE_PATH = path.join(ROOT, "scripts/transfermarkt-cache.json");

const SENTINEL_START = "// <generated-start>";
const SENTINEL_END = "// <generated-end>";

interface CachedHit { value: number | null; fetchedAt: string; sourceUrl?: string }
type Cache = Record<string, CachedHit>;

function loadCache(): Cache {
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as Cache;
  } catch {
    return {};
  }
}

function saveCache(cache: Cache): void {
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
}

async function loadRosters(): Promise<Record<string, OfficialPlayer[]>> {
  // Use a dynamic import via the TS source. Vercel deploys won't run this
  // script, so importing from src/ is OK.
  const mod = await import(ROSTERS_PATH);
  return mod.OFFICIAL_ROSTERS as Record<string, OfficialPlayer[]>;
}

function parseExistingValues(content: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = /"([^"]+)":\s*(\d+(?:\.\d+)?)\s*,/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content))) {
    out[m[1]] = Number(m[2]);
  }
  return out;
}

function lookupApiFootballValue(): number | null {
  // Reserved for future api-sports.io player.market_value field. Today the
  // free tier doesn't expose it, so this returns null and we fall through to
  // the Transfermarkt scrape. Kept as a hook so a paid-tier upgrade flips on
  // a no-cost local data path.
  return null;
}

interface TmHit { value: number | null; url?: string }

const MILLION = 1_000_000;

function parseValueText(text: string): number | null {
  // Transfermarkt formats values like "€85.00m" or "€450k". Normalize.
  const t = text.trim().replace(/\s+/g, "").toLowerCase();
  const m = t.match(/([€$£]?)([\d.,]+)([mk])?/);
  if (!m) return null;
  const raw = m[2].replace(/,/g, ".");
  const num = Number.parseFloat(raw);
  if (Number.isNaN(num)) return null;
  const suffix = m[3];
  if (suffix === "m") return Math.round(num);
  if (suffix === "k") return Math.round((num * 1000) / MILLION * 10) / 10;
  // No suffix — probably a raw euro amount; convert to millions.
  return Math.round((num / MILLION) * 10) / 10;
}

async function fetchTransfermarktValue(name: string): Promise<TmHit> {
  // Transfermarkt's quick-search endpoint returns an HTML result list that
  // includes per-player rows with a `data-mw` (market value) cell. We parse
  // the first row that looks like a player profile.
  const url = `https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(name)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; wc2026-readonly)",
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.7",
      },
    });
    if (!res.ok) return { value: null };
    const html = await res.text();
    // Look for the first market-value cell in the players table. TM marks
    // it with class="rechts hauptlink".
    const match =
      html.match(/<td[^>]*class="rechts hauptlink"[^>]*>\s*([^<]+?)\s*<\/td>/i) ||
      html.match(/<td[^>]*class="(?:rechts |)hauptlink rechts"[^>]*>\s*([^<]+?)\s*<\/td>/i);
    if (!match) return { value: null };
    return { value: parseValueText(match[1]), url };
  } catch {
    return { value: null };
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const rosters = await loadRosters();
  const existingText = fs.readFileSync(MARKET_VALUES_PATH, "utf8");
  const existing = parseExistingValues(existingText);
  const cache = loadCache();

  const allPlayers = new Set<string>();
  for (const roster of Object.values(rosters)) {
    for (const p of roster) allPlayers.add(p.nameEn);
  }

  const missing: { name: string; club?: string }[] = [];
  for (const roster of Object.values(rosters)) {
    for (const p of roster) {
      const lastToken = p.nameEn.split(/\s+/).pop() || "";
      // If either the full name or just the last token already exists, skip.
      if (existing[p.nameEn] != null || existing[lastToken] != null) continue;
      const cached = cache[p.nameEn];
      if (cached?.value != null) continue;
      missing.push({ name: p.nameEn, club: p.club });
    }
  }

  console.log(`Players in announced rosters: ${allPlayers.size}`);
  console.log(`Curated already:              ${Object.keys(existing).length}`);
  console.log(`Missing (will fetch):         ${missing.length}`);
  console.log("");

  const resolved: Record<string, number> = {};
  let fetched = 0;
  let skippedApi = 0;
  for (const p of missing) {
    const apiValue = lookupApiFootballValue();
    if (apiValue != null) {
      resolved[p.name] = apiValue;
      cache[p.name] = { value: apiValue, fetchedAt: new Date().toISOString(), sourceUrl: "api-football" };
      skippedApi++;
      continue;
    }
    const hit = await fetchTransfermarktValue(p.name);
    if (hit.value != null) {
      resolved[p.name] = hit.value;
      // Only cache successful lookups — failed fetches are usually transient
      // (rate limit, firewall block, DNS hiccup), so we want a re-run from
      // a friendlier network to retry them, not skip them.
      cache[p.name] = { value: hit.value, fetchedAt: new Date().toISOString(), sourceUrl: hit.url };
      fetched++;
      console.log(`  [${fetched + skippedApi}/${missing.length}] ${p.name.padEnd(28)} €${hit.value}M`);
    } else {
      console.log(`  [${fetched + skippedApi}/${missing.length}] ${p.name.padEnd(28)} (no value)`);
    }
    // Persist cache every 25 rows so a crash doesn't wipe progress.
    if ((fetched + skippedApi) % 25 === 0) saveCache(cache);
    await sleep(2000);
  }
  saveCache(cache);

  // Rewrite the generated block, preserving everything outside the sentinels.
  const lines: string[] = [];
  lines.push("");
  lines.push(`// Sync run: ${new Date().toISOString()}`);
  lines.push(`// Total resolved this run: ${Object.keys(resolved).length} (api-football=${skippedApi}, transfermarkt=${fetched})`);
  lines.push("export const MARKET_VALUES_GENERATED: Record<string, number> = {");
  for (const [name, value] of Object.entries(resolved).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  ${JSON.stringify(name)}: ${value},`);
  }
  lines.push("};");
  lines.push("");
  const generated = lines.join("\n");

  const sentinelStart = existingText.indexOf(SENTINEL_START);
  const sentinelEnd = existingText.indexOf(SENTINEL_END);
  let nextText: string;
  if (sentinelStart >= 0 && sentinelEnd > sentinelStart) {
    nextText =
      existingText.slice(0, sentinelStart + SENTINEL_START.length) +
      "\n" +
      generated +
      existingText.slice(sentinelEnd);
  } else {
    // Append the generated block at the end of the file.
    nextText = existingText.trimEnd() +
      "\n\n" + SENTINEL_START + "\n" + generated + SENTINEL_END + "\n";
  }
  fs.writeFileSync(MARKET_VALUES_PATH, nextText);

  console.log(`\n✓ Wrote ${MARKET_VALUES_PATH}`);
  console.log(`✓ Cache updated at ${CACHE_PATH}`);
}

void API_PATH; // reserved for future api-sports.io tier upgrade
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
