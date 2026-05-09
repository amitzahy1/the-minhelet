// =============================================================================
// build-xlsx-templates.ts
//
// Produces the two static .xlsx files committed under public/exports/:
//   1. wc2026-backup.xlsx   — read-only snapshot of every user's bets, layout
//                             optimised for hand-scoring if the site is dead.
//   2. wc2026-liveops.xlsx  — interactive workbook. Admin pastes per-match
//                             results into "01_results_input"; the leaderboard
//                             auto-recomputes for the group stage via Excel
//                             formulas. KO + special are space for manual
//                             scoring (full Excel-formula port of the scoring
//                             engine is a separate effort — this is the MVP).
//
// Modes:
//   - With NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env, the
//     script pulls live data from Supabase. The committed files in the repo
//     can then be regenerated post-lock.
//   - Without those env vars, the script produces an empty template that the
//     admin can populate by pasting from the CSV exports.
//
// Run:  npx tsx scripts/build-xlsx-templates.ts
// =============================================================================

import ExcelJS from "exceljs";
import path from "node:path";
import { mkdirSync, existsSync } from "node:fs";

import { GROUPS, GROUP_LETTERS, ALL_TEAMS } from "../src/lib/tournament/groups";

const OUT_DIR = path.resolve(__dirname, "../public/exports");
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function generateMatchups(codes: string[]): { h: string; a: string }[] {
  const [a, b, c, d] = codes;
  return [
    { h: a, a: b }, { h: c, a: d }, { h: a, a: c },
    { h: d, a: b }, { h: d, a: a }, { h: b, a: c },
  ];
}

const ROUND_KEYS_R32 = Array.from({ length: 16 }, (_, i) => `r32_${i}`);
const ROUND_KEYS_R16 = Array.from({ length: 8 }, (_, i) => `r16_${i}`);
const ROUND_KEYS_QF = Array.from({ length: 4 }, (_, i) => `qf_${i}`);
const ROUND_KEYS_SF = Array.from({ length: 2 }, (_, i) => `sf_${i}`);
const ROUND_KEYS_3RD = ["third"];
const ROUND_KEYS_FINAL = ["final"];
const ALL_KO_KEYS = [
  ...ROUND_KEYS_R32, ...ROUND_KEYS_R16, ...ROUND_KEYS_QF,
  ...ROUND_KEYS_SF, ...ROUND_KEYS_3RD, ...ROUND_KEYS_FINAL,
];

interface LoadedUser {
  email: string;
  display_name: string;
  bracket: {
    group_predictions?: Record<string, { scores?: { home: number | null; away: number | null }[] }>;
    knockout_tree?: Record<string, { winner?: string | null; score1?: number | null; score2?: number | null }>;
    champion?: string | null;
  } | null;
  special: Record<string, string | null> | null;
  advancement: {
    group_qualifiers?: Record<string, string[]>;
    advance_to_qf?: string[];
    advance_to_sf?: string[];
    advance_to_final?: string[];
    winner?: string | null;
  } | null;
}

// -----------------------------------------------------------------------------
// Demo data — used when --demo is passed or Supabase env is missing AND the
// script is invoked with --demo. 8 sample users with realistic Hebrew names,
// fully-filled group bets, partially-filled knockout, and a mix of specials so
// the produced workbooks demonstrate every column shape.
// -----------------------------------------------------------------------------

const DEMO_NAMES = [
  { name: "דני", email: "danny@example.com", style: "favorite" as const },
  { name: "יוני", email: "yoni@example.com", style: "favorite" as const },
  { name: "אמית", email: "amit@example.com", style: "favorite" as const },
  { name: "דור דסא", email: "dor@example.com", style: "balanced" as const },
  { name: "רון ב", email: "ron.b@example.com", style: "upset" as const },
  { name: "רון ג", email: "ron.g@example.com", style: "upset" as const },
  { name: "רועי", email: "roi@example.com", style: "balanced" as const },
  { name: "אורי", email: "uri@example.com", style: "underdog" as const },
];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildDemoUsers(): LoadedUser[] {
  return DEMO_NAMES.map((d, idx) => {
    const rand = seededRandom(idx + 1);

    // Fill all 12 groups with realistic-ish scores (0-3 goals each side)
    const group_predictions: Record<string, { scores: { home: number | null; away: number | null }[] }> = {};
    for (const letter of GROUP_LETTERS) {
      const codes = (GROUPS[letter] || []).map(t => t.code);
      const matchups = generateMatchups(codes);
      group_predictions[letter] = {
        scores: matchups.map(() => ({
          home: Math.floor(rand() * 4),
          away: Math.floor(rand() * 3),
        })),
      };
    }

    // Knockout: fill R32 winners using top-2 from each group, mostly the
    // alphabetical first team (favourite-style users) or the second team
    // (upset-style users). Score predictions are usually 1-0 or 2-1.
    const knockout_tree: Record<string, { winner: string; score1: number; score2: number }> = {};
    const r32WinnerForUser = (matchIdx: number): string => {
      const groupIdx = matchIdx % 12;
      const letter = GROUP_LETTERS[groupIdx];
      const teams = (GROUPS[letter] || []).map(t => t.code);
      if (d.style === "favorite") return teams[0];
      if (d.style === "upset") return teams[1];
      if (d.style === "underdog") return teams[Math.floor(rand() * teams.length)];
      return teams[matchIdx % 2];
    };
    for (let i = 0; i < 16; i++) {
      const winner = r32WinnerForUser(i);
      knockout_tree[`r32_${i}`] = { winner, score1: 2, score2: 1 };
    }
    // Fill a few R16 picks for the favourites only — leaves blank cells in
    // the workbook so users can see how the format treats missing data.
    if (d.style === "favorite") {
      for (let i = 0; i < 4; i++) {
        knockout_tree[`r16_${i}`] = { winner: r32WinnerForUser(i * 2), score1: 1, score2: 0 };
      }
    }

    // Champion picked from the user's R32 first winner
    const champion = knockout_tree["r32_0"].winner;

    // Special bets — vary by style
    const topScorers = ["Mbappé", "Haaland", "Vinicius", "Lautaro", "Kane"];
    const topAssists = ["De Bruyne", "Modric", "Bruno Fernandes", "Kimmich"];
    const special: Record<string, string | null> = {
      top_scorer_player: topScorers[idx % topScorers.length],
      top_assists_player: topAssists[idx % topAssists.length],
      best_attack_team: ["BRA", "ARG", "FRA", "ESP"][idx % 4],
      most_prolific_group: ["A", "C", "E", "G"][idx % 4],
      driest_group: ["B", "D", "F", "H"][idx % 4],
      dirtiest_team: ["MEX", "URU", "POR", "GER"][idx % 4],
      matchup_pick: `home,away,${idx % 2 === 0 ? "draw" : "home"}`,
      penalties_over_under: idx % 2 === 0 ? "over" : "under",
    };

    // Advancement: top 2 of each group + knockout progression picks
    const group_qualifiers: Record<string, string[]> = {};
    for (const letter of GROUP_LETTERS) {
      const teams = (GROUPS[letter] || []).map(t => t.code);
      group_qualifiers[letter] = d.style === "upset" ? [teams[1], teams[2]] : [teams[0], teams[1]];
    }
    const allFavourites = GROUP_LETTERS.flatMap(l => {
      const t = (GROUPS[l] || []).map(x => x.code);
      return d.style === "upset" ? [t[1]] : [t[0]];
    });
    const advancement = {
      group_qualifiers,
      advance_to_qf: allFavourites.slice(0, 8),
      advance_to_sf: allFavourites.slice(0, 4),
      advance_to_final: allFavourites.slice(0, 2),
      winner: champion,
    };

    return {
      email: d.email,
      display_name: d.name,
      bracket: { group_predictions, knockout_tree, champion },
      special,
      advancement,
    };
  });
}

async function loadUsersFromSupabase(): Promise<LoadedUser[]> {
  const useDemo = process.argv.includes("--demo");
  if (useDemo) {
    console.log("ℹ️  --demo flag set — producing workbooks with sample data.");
    return buildDemoUsers();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("ℹ️  No Supabase env vars detected — producing empty template. (Pass --demo for sample data.)");
    return [];
  }
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key);

  const [
    { data: profiles },
    { data: brackets },
    { data: specials },
    { data: advancements },
    { data: authData },
  ] = await Promise.all([
    supabase.from("profiles").select("id, display_name"),
    supabase.from("user_brackets").select("user_id, group_predictions, knockout_tree, champion"),
    supabase.from("special_bets").select("user_id, top_scorer_player, top_assists_player, best_attack_team, most_prolific_group, driest_group, dirtiest_team, matchup_pick, penalties_over_under"),
    supabase.from("advancement_picks").select("user_id, group_qualifiers, advance_to_qf, advance_to_sf, advance_to_final, winner"),
    supabase.auth.admin.listUsers(),
  ]);

  const emailMap: Record<string, string> = {};
  for (const u of authData?.users || []) emailMap[u.id] = u.email || "";

  return (profiles || []).map((p: { id: string; display_name: string | null }) => ({
    email: emailMap[p.id] || "",
    display_name: p.display_name || "ללא שם",
    bracket: brackets?.find((b: { user_id: string }) => b.user_id === p.id) ?? null,
    special: specials?.find((s: { user_id: string }) => s.user_id === p.id) ?? null,
    advancement: advancements?.find((a: { user_id: string }) => a.user_id === p.id) ?? null,
  })).sort((a: LoadedUser, b: LoadedUser) => a.display_name.localeCompare(b.display_name, "he"));
}

// -----------------------------------------------------------------------------
// Sheet: groups (wide format)
// -----------------------------------------------------------------------------

function addGroupsSheet(wb: ExcelJS.Workbook, users: LoadedUser[], name = "Groups") {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  const cols: Partial<ExcelJS.Column>[] = [
    { header: "email", key: "email", width: 28 },
    { header: "display_name", key: "name", width: 18 },
  ];
  for (const letter of GROUP_LETTERS) {
    const codes = (GROUPS[letter] || []).map(t => t.code);
    const matchups = generateMatchups(codes);
    matchups.forEach((mu, i) => {
      const n = i + 1;
      cols.push({ header: `${letter}${n}_home`, key: `${letter}${n}_home`, width: 5 });
      cols.push({ header: `${letter}${n}_away`, key: `${letter}${n}_away`, width: 5 });
      cols.push({ header: `${letter}${n}_pred_h`, key: `${letter}${n}_pred_h`, width: 7 });
      cols.push({ header: `${letter}${n}_pred_a`, key: `${letter}${n}_pred_a`, width: 7 });
    });
  }
  ws.columns = cols;
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } } as ExcelJS.FillPattern;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  for (const u of users) {
    const row: Record<string, unknown> = { email: u.email, name: u.display_name };
    const gp = u.bracket?.group_predictions ?? {};
    for (const letter of GROUP_LETTERS) {
      const codes = (GROUPS[letter] || []).map(t => t.code);
      const matchups = generateMatchups(codes);
      const userScores = gp[letter]?.scores ?? [];
      matchups.forEach((mu, i) => {
        const n = i + 1;
        row[`${letter}${n}_home`] = mu.h;
        row[`${letter}${n}_away`] = mu.a;
        row[`${letter}${n}_pred_h`] = userScores[i]?.home ?? null;
        row[`${letter}${n}_pred_a`] = userScores[i]?.away ?? null;
      });
    }
    ws.addRow(row);
  }
  return ws;
}

// -----------------------------------------------------------------------------
// Sheet: knockout (wide format)
// -----------------------------------------------------------------------------

function addKnockoutSheet(wb: ExcelJS.Workbook, users: LoadedUser[], name = "Knockout") {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  const cols: Partial<ExcelJS.Column>[] = [
    { header: "email", key: "email", width: 28 },
    { header: "display_name", key: "name", width: 18 },
  ];
  for (const k of ALL_KO_KEYS) {
    cols.push({ header: `${k}_winner`, key: `${k}_winner`, width: 8 });
    cols.push({ header: `${k}_h_score`, key: `${k}_h_score`, width: 6 });
    cols.push({ header: `${k}_a_score`, key: `${k}_a_score`, width: 6 });
  }
  ws.columns = cols;
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } } as ExcelJS.FillPattern;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  for (const u of users) {
    const row: Record<string, unknown> = { email: u.email, name: u.display_name };
    const ko = u.bracket?.knockout_tree ?? {};
    for (const k of ALL_KO_KEYS) {
      const m = ko[k] ?? {};
      row[`${k}_winner`] = m.winner ?? "";
      row[`${k}_h_score`] = m.score1 ?? null;
      row[`${k}_a_score`] = m.score2 ?? null;
    }
    ws.addRow(row);
  }
  return ws;
}

// -----------------------------------------------------------------------------
// Sheet: special bets
// -----------------------------------------------------------------------------

const SPECIAL_COLS: { key: string; header: string }[] = [
  { key: "top_scorer_player", header: "מלך שערים" },
  { key: "top_assists_player", header: "מלך בישולים" },
  { key: "best_attack_team", header: "התקפה" },
  { key: "most_prolific_group", header: "בית פורה" },
  { key: "driest_group", header: "בית יבש" },
  { key: "dirtiest_team", header: "כסחנית" },
  { key: "matchup_1", header: "מאצ׳אפ 1" },
  { key: "matchup_2", header: "מאצ׳אפ 2" },
  { key: "matchup_3", header: "מאצ׳אפ 3" },
  { key: "penalties_over_under", header: "פנדלים O/U" },
];

function addSpecialSheet(wb: ExcelJS.Workbook, users: LoadedUser[], name = "Special") {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  const cols: Partial<ExcelJS.Column>[] = [
    { header: "email", key: "email", width: 28 },
    { header: "display_name", key: "name", width: 18 },
    ...SPECIAL_COLS.map(c => ({ header: c.header, key: c.key, width: 14 })),
  ];
  ws.columns = cols;
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E8FF" } } as ExcelJS.FillPattern;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  for (const u of users) {
    const row: Record<string, unknown> = { email: u.email, name: u.display_name };
    const sb = u.special ?? {};
    const matchups = (typeof sb.matchup_pick === "string" ? sb.matchup_pick : "").split(",");
    row["top_scorer_player"] = sb.top_scorer_player ?? "";
    row["top_assists_player"] = sb.top_assists_player ?? "";
    row["best_attack_team"] = sb.best_attack_team ?? "";
    row["most_prolific_group"] = sb.most_prolific_group ?? "";
    row["driest_group"] = sb.driest_group ?? "";
    row["dirtiest_team"] = sb.dirtiest_team ?? "";
    row["matchup_1"] = matchups[0] ?? "";
    row["matchup_2"] = matchups[1] ?? "";
    row["matchup_3"] = matchups[2] ?? "";
    row["penalties_over_under"] = sb.penalties_over_under ?? "";
    ws.addRow(row);
  }
  return ws;
}

// -----------------------------------------------------------------------------
// Sheet: advancement
// -----------------------------------------------------------------------------

function addAdvancementSheet(wb: ExcelJS.Workbook, users: LoadedUser[], name = "Advancement") {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", xSplit: 2, ySplit: 1 }] });
  const cols: Partial<ExcelJS.Column>[] = [
    { header: "email", key: "email", width: 28 },
    { header: "display_name", key: "name", width: 18 },
  ];
  for (const letter of GROUP_LETTERS) {
    cols.push({ header: `${letter}_q1`, key: `${letter}_q1`, width: 5 });
    cols.push({ header: `${letter}_q2`, key: `${letter}_q2`, width: 5 });
  }
  cols.push(
    { header: "advance_to_qf", key: "qf", width: 28 },
    { header: "advance_to_sf", key: "sf", width: 24 },
    { header: "advance_to_final", key: "final", width: 16 },
    { header: "winner", key: "winner", width: 10 },
  );
  ws.columns = cols;
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } } as ExcelJS.FillPattern;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  for (const u of users) {
    const row: Record<string, unknown> = { email: u.email, name: u.display_name };
    const adv = u.advancement ?? {};
    const gq = adv.group_qualifiers ?? {};
    for (const letter of GROUP_LETTERS) {
      const arr = gq[letter] ?? [];
      row[`${letter}_q1`] = arr[0] ?? "";
      row[`${letter}_q2`] = arr[1] ?? "";
    }
    row["qf"] = (adv.advance_to_qf ?? []).join(" | ");
    row["sf"] = (adv.advance_to_sf ?? []).join(" | ");
    row["final"] = (adv.advance_to_final ?? []).join(" | ");
    row["winner"] = adv.winner ?? u.bracket?.champion ?? "";
    ws.addRow(row);
  }
  return ws;
}

// -----------------------------------------------------------------------------
// Sheet: reference data (teams)
// -----------------------------------------------------------------------------

function addTeamsSheet(wb: ExcelJS.Workbook) {
  const ws = wb.addWorksheet("Teams (reference)");
  ws.columns = [
    { header: "tla", key: "tla", width: 6 },
    { header: "name_he", key: "name_he", width: 18 },
    { header: "name_en", key: "name_en", width: 18 },
    { header: "group", key: "group", width: 7 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const t of ALL_TEAMS) {
    const group = GROUP_LETTERS.find(l => GROUPS[l]?.some(x => x.code === t.code)) || "";
    ws.addRow({ tla: t.code, name_he: t.name_he, name_en: t.name, group });
  }
}

// -----------------------------------------------------------------------------
// BACKUP workbook
// -----------------------------------------------------------------------------

async function buildBackup(users: LoadedUser[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "WC2026 The Minhelet";
  wb.created = new Date();

  // README
  const readme = wb.addWorksheet("00_README");
  readme.columns = [{ width: 100 }];
  readme.getCell("A1").value = "wc2026-backup.xlsx — תמונת מצב של כל ההימורים";
  readme.getCell("A1").font = { bold: true, size: 14 };
  readme.getCell("A3").value = "מבנה הקובץ:";
  readme.getCell("A3").font = { bold: true };
  ([
    "• Groups — הימורי תוצאות על 144 משחקי הבתים. שורה לכל מהמר, 4 עמודות לכל משחק (קבוצה בית, קבוצה חוץ, חיזוי בית, חיזוי חוץ).",
    "• Knockout — הימורי 31 משחקי הנוקאאוט (R32 עד הגמר). שורה לכל מהמר, 3 עמודות לכל משחק (מנצח, חיזוי בית, חיזוי חוץ).",
    "• Special — הימורים מיוחדים (מלך שערים, התקפה, מאצ'אפים וכו').",
    "• Advancement — עולות מבית, רבע, חצי, גמר ואלוף לכל מהמר.",
    "• Teams (reference) — מיפוי TLA → שם בעברית + בית.",
    "",
    "אם האתר נופל — אפשר לדפדף בקובץ ידנית או להעתיק לגיליון אחר ולחשב ניקוד.",
    "להזנת תוצאות חיות עם חישוב אוטומטי — השתמשו ב-wc2026-liveops.xlsx.",
  ] as string[]).forEach((line, i) => {
    readme.getCell(`A${4 + i}`).value = line;
    readme.getCell(`A${4 + i}`).alignment = { horizontal: "right" } as ExcelJS.Alignment;
  });

  addGroupsSheet(wb, users);
  addKnockoutSheet(wb, users);
  addSpecialSheet(wb, users);
  addAdvancementSheet(wb, users);
  addTeamsSheet(wb);

  const out = path.join(OUT_DIR, "wc2026-backup.xlsx");
  await wb.xlsx.writeFile(out);
  console.log(`✓ ${out} (${users.length} users)`);
}

// -----------------------------------------------------------------------------
// LIVEOPS workbook
// -----------------------------------------------------------------------------

async function buildLiveops(users: LoadedUser[]) {
  const useDemo = process.argv.includes("--demo");

  const wb = new ExcelJS.Workbook();
  wb.creator = "WC2026 The Minhelet";
  wb.created = new Date();

  // 00_README
  const readme = wb.addWorksheet("00_README");
  readme.columns = [{ width: 100 }];
  readme.getCell("A1").value = "wc2026-liveops.xlsx — חוברת ניהול חיה לחירום";
  readme.getCell("A1").font = { bold: true, size: 14 };
  ([
    "",
    "השתמשו בחוברת זו אם האתר אינו זמין. הזנת התוצאות מתבצעת בגיליון 01_results_input,",
    "וגיליון 99_leaderboard מתעדכן עם נוסחאות עבור שלב הבתים. נוקאאוט והימורים מיוחדים",
    "מצריכים הזנה ידנית של ניקוד בעמודות הייעודיות (גרסה זו לא כוללת חישוב אוטומטי לכל המסלולים).",
    "",
    "תהליך עבודה:",
    "1. פתחו את גיליון 01_results_input והזינו את תוצאת המשחק תחת home_goals + away_goals.",
    "2. הניקוד עבור שלב הבתים מתעדכן בעמודות _pts בגיליון Groups.",
    "3. עבור נוקאאוט: בגיליון Knockout, הזינו ב-עמודות _pts את הניקוד עבור כל מהמר.",
    "4. עבור הימורים מיוחדים: בגיליון Special, הזינו ב-עמודות _pts את הניקוד.",
    "5. גיליון 99_leaderboard מסכם את כל הניקודים לפי משתמש.",
    "",
    "כללי ניקוד (ראו גם גיליון 03_scoring_rules):",
    "• בתים — תוצאה מדויקת = 3 נק׳, כיוון נכון (טוטו) = 2 נק׳, אחרת = 0",
    "• נוקאאוט — תוצאה מדויקת = 3 נק׳, כיוון נכון = 2 נק׳",
    "• זוכה הטורניר = 12 נק׳, גמר = 8, חצי = 6, רבע = 4",
    "• מלך שערים מדויק = 9 נק׳, מלך בישולים = 7, התקפה = 6, בית פורה/יבש = 5",
  ] as string[]).forEach((line, i) => {
    readme.getCell(`A${2 + i}`).value = line;
    readme.getCell(`A${2 + i}`).alignment = { horizontal: "right" } as ExcelJS.Alignment;
  });

  // 01_results_input — admin paste area for actual results
  const resultsSheet = wb.addWorksheet("01_results_input");
  resultsSheet.columns = [
    { header: "match_id", key: "id", width: 10 },
    { header: "stage", key: "stage", width: 10 },
    { header: "group", key: "group", width: 7 },
    { header: "home_tla", key: "home", width: 8 },
    { header: "away_tla", key: "away", width: 8 },
    { header: "home_goals", key: "home_goals", width: 11 },
    { header: "away_goals", key: "away_goals", width: 11 },
  ];
  resultsSheet.getRow(1).font = { bold: true };
  resultsSheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } } as ExcelJS.FillPattern;

  // Pre-fill the 72 group-stage matchups
  let resultRowIdx = 2;
  for (const letter of GROUP_LETTERS) {
    const codes = (GROUPS[letter] || []).map(t => t.code);
    const matchups = generateMatchups(codes);
    matchups.forEach((mu, i) => {
      resultsSheet.getCell(`A${resultRowIdx}`).value = `${letter}${i + 1}`;
      resultsSheet.getCell(`B${resultRowIdx}`).value = "GROUP";
      resultsSheet.getCell(`C${resultRowIdx}`).value = letter;
      resultsSheet.getCell(`D${resultRowIdx}`).value = mu.h;
      resultsSheet.getCell(`E${resultRowIdx}`).value = mu.a;
      // home_goals + away_goals: in --demo mode, pre-fill the first 3 groups
      // (18 matches) with sample results so the leaderboard shows real
      // numbers on open. Otherwise leave blank for admin entry.
      if (useDemo && GROUP_LETTERS.indexOf(letter) < 3) {
        const r = seededRandom(GROUP_LETTERS.indexOf(letter) * 100 + i);
        resultsSheet.getCell(`F${resultRowIdx}`).value = Math.floor(r() * 4);
        resultsSheet.getCell(`G${resultRowIdx}`).value = Math.floor(r() * 3);
      }
      resultRowIdx++;
    });
  }

  // 03_scoring_rules — admin can tweak point values via named cells
  const rules = wb.addWorksheet("03_scoring_rules");
  rules.columns = [
    { header: "name", width: 28 },
    { header: "value", width: 10 },
    { header: "description", width: 60 },
  ];
  rules.getRow(1).font = { bold: true };
  const ruleRows: [string, number, string][] = [
    ["pts_group_toto", 2, "כיוון נכון בשלב הבתים"],
    ["pts_group_exact_bonus", 1, "בונוס תוצאה מדויקת בשלב הבתים (סה״כ 3)"],
    ["pts_ko_toto", 2, "כיוון נכון בנוקאאוט"],
    ["pts_ko_exact_bonus", 1, "בונוס תוצאה מדויקת בנוקאאוט"],
    ["pts_winner", 12, "ניקוד אלוף הטורניר"],
    ["pts_finalist", 8, "ניקוד עולה לגמר"],
    ["pts_semifinalist", 6, "ניקוד עולה לחצי גמר"],
    ["pts_quarterfinalist", 4, "ניקוד עולה לרבע גמר"],
    ["pts_top_scorer", 9, "מלך שערים מדויק"],
    ["pts_top_assists", 7, "מלך בישולים מדויק"],
    ["pts_best_attack", 6, "התקפה הכי טובה"],
    ["pts_prolific_group", 5, "בית פורה"],
    ["pts_driest_group", 5, "בית יבש"],
    ["pts_dirtiest_team", 5, "נבחרת כסחנית"],
    ["pts_matchup", 5, "מאצ'אפ נכון (כל אחד)"],
    ["pts_penalties_ou", 5, "פנדלים אובר/אנדר"],
  ];
  ruleRows.forEach(([name, value, desc], i) => {
    const row = i + 2;
    rules.getCell(`A${row}`).value = name;
    rules.getCell(`A${row}`).font = { bold: true };
    rules.getCell(`B${row}`).value = value;
    rules.getCell(`B${row}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } } as ExcelJS.FillPattern;
    rules.getCell(`C${row}`).value = desc;
    rules.getCell(`C${row}`).alignment = { horizontal: "right" } as ExcelJS.Alignment;
    // Define a workbook-scoped named range pointing at column B
    wb.definedNames.add(`'03_scoring_rules'!$B$${row}`, name);
  });

  // Groups sheet — bets data + pts column per match using IF formula
  const groupsWs = addGroupsSheet(wb, users, "Groups");
  // Append per-match pts columns. For each (letter, n), compute points by
  // looking up actual goals in 01_results_input via INDEX/MATCH on match_id.
  const lastBetCol = groupsWs.actualColumnCount; // before pts cols
  const ptsCols: { letter: string; n: number; col: number }[] = [];
  let extraColIdx = lastBetCol + 1;
  for (const letter of GROUP_LETTERS) {
    for (let n = 1; n <= 6; n++) {
      const ptsHeader = `${letter}${n}_pts`;
      groupsWs.getCell(1, extraColIdx).value = ptsHeader;
      groupsWs.getCell(1, extraColIdx).font = { bold: true };
      groupsWs.getColumn(extraColIdx).width = 6;
      ptsCols.push({ letter, n, col: extraColIdx });
      extraColIdx++;
    }
  }
  // Total pts column for the user
  const totalCol = extraColIdx;
  groupsWs.getCell(1, totalCol).value = "groups_total_pts";
  groupsWs.getCell(1, totalCol).font = { bold: true };
  groupsWs.getColumn(totalCol).width = 14;

  // Build column letter helper
  function colLetter(idx: number): string {
    let s = "";
    let i = idx;
    while (i > 0) {
      const r = (i - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      i = Math.floor((i - 1) / 26);
    }
    return s;
  }

  // For each user row (rows 2..2+users.length-1), write pts formulas
  if (users.length > 0) {
    // Map of pred_h / pred_a column letters per (letter, n)
    const predCols: Record<string, { h: string; a: string }> = {};
    for (const letter of GROUP_LETTERS) {
      for (let n = 1; n <= 6; n++) {
        // header pattern from addGroupsSheet: each match takes 4 cols starting at col 3
        // First match (A1) → cols 3..6 (home, away, pred_h, pred_a)
        const groupIdx = GROUP_LETTERS.indexOf(letter as typeof GROUP_LETTERS[number]);
        const matchPos = groupIdx * 6 + (n - 1);
        const baseCol = 2 + matchPos * 4 + 1; // 3 = first match home column
        const predHCol = baseCol + 2;
        const predACol = baseCol + 3;
        predCols[`${letter}${n}`] = { h: colLetter(predHCol), a: colLetter(predACol) };
      }
    }

    // Map match_id (`A1` etc.) → row in 01_results_input
    // The input rows are written in the same letter/match order, starting at row 2.
    // Match `A1` is row 2, `A2` row 3 ... `A6` row 7, `B1` row 8, etc.
    function resultRow(letter: string, n: number): number {
      const groupIdx = GROUP_LETTERS.indexOf(letter as typeof GROUP_LETTERS[number]);
      return 2 + groupIdx * 6 + (n - 1);
    }

    for (let r = 0; r < users.length; r++) {
      const xlRow = r + 2;
      for (const { letter, n, col } of ptsCols) {
        const { h: predH, a: predA } = predCols[`${letter}${n}`];
        const resRow = resultRow(letter, n);
        // Points formula:
        //   IF either pred or actual is blank → ""
        //   else if pred matches actual exactly → pts_group_toto + pts_group_exact_bonus
        //   else if direction matches (HOME/AWAY/DRAW) → pts_group_toto
        //   else 0
        const actualH = `'01_results_input'!F${resRow}`;
        const actualA = `'01_results_input'!G${resRow}`;
        const predHRef = `${predH}${xlRow}`;
        const predARef = `${predA}${xlRow}`;
        const directionMatch =
          `OR(AND(${predHRef}>${predARef},${actualH}>${actualA}),AND(${predHRef}<${predARef},${actualH}<${actualA}),AND(${predHRef}=${predARef},${actualH}=${actualA}))`;
        const exactMatch = `AND(${predHRef}=${actualH},${predARef}=${actualA})`;
        const formula = `IF(OR(ISBLANK(${predHRef}),ISBLANK(${predARef}),ISBLANK(${actualH}),ISBLANK(${actualA})),"",IF(${exactMatch},pts_group_toto+pts_group_exact_bonus,IF(${directionMatch},pts_group_toto,0)))`;
        groupsWs.getCell(xlRow, col).value = { formula };
      }
      // Total pts: SUM of all pts columns (skipping non-numeric "" via SUMIF)
      const startLetter = colLetter(ptsCols[0].col);
      const endLetter = colLetter(ptsCols[ptsCols.length - 1].col);
      groupsWs.getCell(xlRow, totalCol).value = {
        formula: `SUM(${startLetter}${xlRow}:${endLetter}${xlRow})`,
      };
    }
  }

  // Knockout — keep flat, add manual pts column per round
  const koWs = addKnockoutSheet(wb, users, "Knockout");
  const koTotalCol = koWs.actualColumnCount + 1;
  koWs.getCell(1, koTotalCol).value = "knockout_total_pts";
  koWs.getCell(1, koTotalCol).font = { bold: true };
  koWs.getCell(1, koTotalCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } } as ExcelJS.FillPattern;
  koWs.getColumn(koTotalCol).width = 18;

  // Special — manual pts column
  const specWs = addSpecialSheet(wb, users, "Special");
  const specTotalCol = specWs.actualColumnCount + 1;
  specWs.getCell(1, specTotalCol).value = "special_total_pts";
  specWs.getCell(1, specTotalCol).font = { bold: true };
  specWs.getCell(1, specTotalCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } } as ExcelJS.FillPattern;
  specWs.getColumn(specTotalCol).width = 16;

  // Advancement — manual pts column
  const advWs = addAdvancementSheet(wb, users, "Advancement");
  const advTotalCol = advWs.actualColumnCount + 1;
  advWs.getCell(1, advTotalCol).value = "advancement_total_pts";
  advWs.getCell(1, advTotalCol).font = { bold: true };
  advWs.getCell(1, advTotalCol).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } } as ExcelJS.FillPattern;
  advWs.getColumn(advTotalCol).width = 18;

  addTeamsSheet(wb);

  // 99_leaderboard — pulls from each scoring sheet via VLOOKUP
  const lb = wb.addWorksheet("99_leaderboard");
  lb.columns = [
    { header: "rank", width: 6 },
    { header: "display_name", width: 18 },
    { header: "email", width: 28 },
    { header: "groups_pts", width: 12 },
    { header: "knockout_pts", width: 14 },
    { header: "special_pts", width: 12 },
    { header: "advancement_pts", width: 16 },
    { header: "total", width: 10 },
  ];
  lb.getRow(1).font = { bold: true };
  lb.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } } as ExcelJS.FillPattern;

  if (users.length > 0) {
    const groupsTotalLetter = colLetter(totalCol);
    const koTotalLetter = colLetter(koTotalCol);
    const specTotalLetter = colLetter(specTotalCol);
    const advTotalLetter = colLetter(advTotalCol);

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const row = i + 2;
      lb.getCell(`A${row}`).value = { formula: `RANK(H${row},$H$2:$H$${1 + users.length})` };
      lb.getCell(`B${row}`).value = u.display_name;
      lb.getCell(`C${row}`).value = u.email;
      // Pull groups total via VLOOKUP on email
      lb.getCell(`D${row}`).value = {
        formula: `IFERROR(VLOOKUP(C${row},Groups!$A:$${groupsTotalLetter},${totalCol},FALSE),0)`,
      };
      lb.getCell(`E${row}`).value = {
        formula: `IFERROR(VLOOKUP(C${row},Knockout!$A:$${koTotalLetter},${koTotalCol},FALSE),0)`,
      };
      lb.getCell(`F${row}`).value = {
        formula: `IFERROR(VLOOKUP(C${row},Special!$A:$${specTotalLetter},${specTotalCol},FALSE),0)`,
      };
      lb.getCell(`G${row}`).value = {
        formula: `IFERROR(VLOOKUP(C${row},Advancement!$A:$${advTotalLetter},${advTotalCol},FALSE),0)`,
      };
      lb.getCell(`H${row}`).value = { formula: `SUM(D${row}:G${row})` };
      lb.getCell(`H${row}`).font = { bold: true };
    }
  }

  const out = path.join(OUT_DIR, "wc2026-liveops.xlsx");
  await wb.xlsx.writeFile(out);
  console.log(`✓ ${out} (${users.length} users)`);
}

// -----------------------------------------------------------------------------
// Run
// -----------------------------------------------------------------------------

(async () => {
  const users = await loadUsersFromSupabase();
  await buildBackup(users);
  await buildLiveops(users);
  console.log("Done.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
