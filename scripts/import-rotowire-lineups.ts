// ============================================================================
// Import RotoWire predicted starting XIs (all 48 teams) from twitter/a into
// src/lib/tournament/predicted-lineups.ts.
//
// twitter/a structure (per match):
//   June DD  TIME ET
//   Tickets
//   <HOME> <HOME> <AWAY> <AWAY>     (3-letter codes, each doubled)
//   <home name> <away name>
//   Predicted Lineup   → 11 "<POS> <name>" lines → Injuries
//   Predicted Lineup   → 11 "<POS> <name>" lines → Injuries
// Home lineup always precedes away. " QUES" suffix = injury doubt.
//
// Position codes → our GK|DEF|MID|FW. Formation is derived from the def/mid/fw
// split (matches our pitch rows). RotoWire code CUW → our CUR.
//
// Run: npx tsx scripts/import-rotowire-lineups.ts
// ============================================================================

import * as fs from "fs";
import * as path from "path";

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "twitter/a");
const OUT = path.join(ROOT, "src/lib/tournament/predicted-lineups.ts");

const CODE_MAP: Record<string, string> = { CUW: "CUR" }; // RotoWire → our codes

type Pos = "GK" | "DEF" | "MID" | "FW";
function toPos(code: string): Pos {
  const p = code.toUpperCase();
  if (p === "GK") return "GK";
  if (/^(D[LCR]|CB|[LR]B|W?B[LR]?|[LR]WB)$/.test(p)) return "DEF"; // DL/DC/DR, fullbacks
  if (/^(F|ST|SS|[LR]W)/.test(p)) return "FW"; // FW/FWL/FWR/F, strikers, wingers W
  return "MID"; // DM*, M*, ML/MR/MC, AM* (attacking mids/wingers all sit in the MID row)
}

interface Starter { name: string; pos: Pos; doubtful?: boolean }

const lines = fs.readFileSync(SRC, "utf8").split(/\r?\n/);

// 1) Ordered team codes: home, away, home, away, ... (one pair per "Tickets").
const codes: string[] = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() !== "Tickets") continue;
  const run: string[] = [];
  for (let j = i + 1; j < lines.length && run.length < 4; j++) {
    const t = lines[j].trim();
    if (t) run.push(t);
  }
  if (run.length >= 4) {
    const map = (c: string) => CODE_MAP[c] || c;
    codes.push(map(run[0]), map(run[2])); // home, away
  }
}

// 2) Ordered XI blocks (each "Predicted Lineup" → lines until "Injuries").
const blocks: Starter[][] = [];
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() !== "Predicted Lineup") continue;
  const xi: Starter[] = [];
  for (let j = i + 1; j < lines.length; j++) {
    const t = lines[j].trim();
    if (!t) continue;
    if (t === "Injuries" || t === "Predicted Lineup") break;
    const sp = t.indexOf(" ");
    if (sp < 1) continue;
    const posCode = t.slice(0, sp);
    let name = t.slice(sp + 1).trim();
    let doubtful = false;
    if (/\s(QUES|OUT)$/.test(name)) { doubtful = /QUES$/.test(name); name = name.replace(/\s+(QUES|OUT)$/, "").trim(); }
    xi.push({ name, pos: toPos(posCode), ...(doubtful ? { doubtful: true } : {}) });
  }
  blocks.push(xi.slice(0, 11));
}

if (codes.length !== blocks.length) {
  console.warn(`⚠️  codes (${codes.length}) != lineup blocks (${blocks.length}) — check parsing`);
}

const out: Record<string, { formation: string; starters: Starter[] }> = {};
const issues: string[] = [];
for (let k = 0; k < Math.min(codes.length, blocks.length); k++) {
  const code = codes[k];
  const xi = blocks[k];
  if (xi.length !== 11) issues.push(`${code}: ${xi.length} starters`);
  const def = xi.filter((p) => p.pos === "DEF").length;
  const mid = xi.filter((p) => p.pos === "MID").length;
  const fw = xi.filter((p) => p.pos === "FW").length;
  out[code] = { formation: `${def}-${mid}-${fw}`, starters: xi };
}

const header = `// ============================================================================
// WC2026 — RotoWire predicted starting XIs (auto-generated).
// Source: twitter/a (RotoWire "Predicted & Confirmed Starting XI for Every Match").
// Regenerate: npx tsx scripts/import-rotowire-lineups.ts
// LAST_SYNC: ${new Date().toISOString()}
// ============================================================================

export type PredictedPos = "GK" | "DEF" | "MID" | "FW";
export interface PredictedStarter { name: string; pos: PredictedPos; doubtful?: boolean }
export interface PredictedLineup { formation: string; starters: PredictedStarter[] }

export const PREDICTED_LINEUPS: Record<string, PredictedLineup> = ${JSON.stringify(out, null, 2)};
`;

fs.writeFileSync(OUT, header);
console.log(`✓ Wrote ${Object.keys(out).length} predicted lineups → ${path.relative(ROOT, OUT)}`);
if (issues.length) console.warn("⚠️  lineups not exactly 11:", issues.join(", "));
else console.log("✓ Every team has exactly 11 starters");
console.log("  codes:", Object.keys(out).sort().join(" "));
