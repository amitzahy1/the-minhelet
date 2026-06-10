// =============================================================================
// build-recovery-workbook.ts
//
// Produces ONE self-contained disaster-recovery workbook:
//   local-backups/wc2026-recovery.xlsx   (gitignored — contains real bets)
//
// If the site is down, the admin enters REAL results into the yellow input
// sheets (with dropdowns / data validation) and every bettor's score recomputes
// automatically via Excel formulas:
//   • 01_results     — group-stage match scores        → group toto/exact
//   • 02_advancers   — actual group order + who reached each KO round + champion
//                      → advancement scoring (qualifier ladder, R16/QF/SF/Final, winner)
//   • 03_specials    — actual special outcomes          → special-bets scoring
//   • 04_ko_results  — actual knockout match scores      → KO match toto/exact
//   • Leaderboard    — groups + KO + advancement + specials, ranked
//
// Scoring values come LIVE from scoring_config (admin "ניקוד" tab) with a
// per-field fallback to the code constants.
//
// LIVE BETTING — where it enters the file:
//   • Group score edits (allowed until each match-day locks) and the knockout
//     "real-data tree" (knockout_tree_live, filled DURING the tournament) are
//     captured by RE-RUNNING this script: it always pulls the latest data, so a
//     fresh workbook reflects every live change. Pre-kickoff the live KO tree is
//     empty, so Knockout_live scores 0 until you regenerate mid-tournament.
//
// Run:  npx tsx scripts/build-recovery-workbook.ts
// =============================================================================

import ExcelJS from "exceljs";
import path from "node:path";
import * as fs from "node:fs";
import { GROUPS, GROUP_LETTERS, ALL_TEAMS, getTeamByCode } from "../src/lib/tournament/groups";

function loadEnv(): void {
  const envPath = path.resolve(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}
loadEnv();

const OUT = path.resolve(__dirname, "..", "local-backups", "wc2026-recovery.xlsx");

const matchups = (codes: string[]) => {
  const [a, b, c, d] = codes;
  return [{ h: a, a: b }, { h: c, a: d }, { h: a, a: c }, { h: d, a: b }, { h: d, a: a }, { h: b, a: c }];
};
const MATCHUP_LABELS = ["Messi vs Ronaldo", "Raphinha vs Vinícius", "Mbappé vs Kane"];
const GROUP_LIST = `"${GROUP_LETTERS.join(",")}"`;

// Canonical knockout slot order + stage of each (matches knockout_tree_live keys).
const KO_SLOTS: string[] = [
  ...Array.from({ length: 8 }, (_, i) => `r32l_${i}`), ...Array.from({ length: 8 }, (_, i) => `r32r_${i}`),
  ...Array.from({ length: 4 }, (_, i) => `r16l_${i}`), ...Array.from({ length: 4 }, (_, i) => `r16r_${i}`),
  "qfl_0", "qfl_1", "qfr_0", "qfr_1", "sfl_0", "sfr_0", "final", "third_place",
];
const stageOf = (k: string) =>
  k === "final" ? "final" : k === "third_place" ? "third" :
  k.startsWith("r32") ? "r32" : k.startsWith("r16") ? "r16" : k.startsWith("qf") ? "qf" : "sf";
const STAGE_HE: Record<string, string> = { r32: "1/16", r16: "1/8", qf: "רבע", sf: "חצי", final: "גמר", third: "מקום 3" };

function colLetter(idx: number): string {
  let s = "", i = idx;
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

// Count how many of a bettor's pick cells appear in a named actual-set, as an
// explicit per-cell sum. COUNTIF with a single-cell criterion is supported
// everywhere (Excel/Sheets/Numbers) — unlike array-criterion COUNTIF.
const tierSum = (start: number, count: number, named: string, xr: number) =>
  Array.from({ length: count }, (_, i) => { const c = `${colLetter(start + i)}${xr}`; return `(${c}<>"")*(COUNTIF(${named},${c})>0)`; }).join("+");

const YELLOW = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } } as ExcelJS.FillPattern;
const BLUE = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } } as ExcelJS.FillPattern;
const GREEN = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } } as ExcelJS.FillPattern;
const PURPLE = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E8FF" } } as ExcelJS.FillPattern;
const rtl = { horizontal: "right" } as ExcelJS.Alignment;

// data-validation helpers
const listDV = (src: string): ExcelJS.DataValidation =>
  ({ type: "list", allowBlank: true, formulae: [src], showErrorMessage: true, errorStyle: "warning",
     error: "ערך לא ברשימה — אפשר להמשיך אם בכוונה.", errorTitle: "בחירה מהרשימה" });
const wholeDV = (min: number, max: number): ExcelJS.DataValidation =>
  ({ type: "whole", operator: "between", allowBlank: true, formulae: [min, max],
     showErrorMessage: true, errorStyle: "warning", error: `מספר שלם ${min}–${max}.`, errorTitle: "מספר שערים" });

const FALLBACK: Record<string, number> = {
  toto_group: 2, exact_group: 1,
  toto_r32: 3, exact_r32: 1, toto_r16: 3, exact_r16: 1, toto_qf: 3, exact_qf: 1,
  toto_sf: 3, exact_sf: 2, toto_third: 3, exact_third: 1, toto_final: 4, exact_final: 2,
  group_advance_exact: 3, group_advance_partial: 1, group_advance_as_3rd: 0,
  advance_r16: 2, advance_qf: 3, advance_sf: 6, advance_final: 10, advance_winner: 16,
  top_scorer_exact: 12, top_scorer_relative: 7, top_assists_exact: 9, top_assists_relative: 5,
  best_attack: 8, prolific_group: 6, driest_group: 6, dirtiest_team: 6, matchup: 5, penalties_over_under: 6,
  top_scorer_min_goals: 3, top_assists_min: 2,
};

interface LoadedUser {
  email: string; name: string;
  groups: Record<string, ({ home: number | null; away: number | null })[]>;
  adv: { group_qualifiers: Record<string, string[]>; advance_to_r16: string[]; advance_to_qf: string[]; advance_to_sf: string[]; advance_to_final: string[]; winner: string | null };
  special: Record<string, string | null>;
  koLive: Record<string, { winner?: string | null; score1?: number | null; score2?: number | null }>;
}

async function load(): Promise<{ users: LoadedUser[]; pts: Record<string, number> }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const [{ data: profiles }, { data: brackets }, { data: specials }, { data: advs }, { data: cfg }, { data: auth }] =
    await Promise.all([
      sb.from("profiles").select("id, display_name"),
      sb.from("user_brackets").select("user_id, group_predictions, knockout_tree_live"),
      sb.from("special_bets").select("user_id, top_scorer_player, top_assists_player, best_attack_team, most_prolific_group, driest_group, dirtiest_team, matchup_pick, penalties_over_under"),
      sb.from("advancement_picks").select("user_id, group_qualifiers, advance_to_r16, advance_to_qf, advance_to_sf, advance_to_final, winner"),
      sb.from("scoring_config").select("*").limit(1).maybeSingle(),
      sb.auth.admin.listUsers(),
    ]);

  const emailById: Record<string, string> = {};
  for (const u of auth?.users || []) emailById[u.id] = u.email || "";

  const pts: Record<string, number> = {};
  for (const k of Object.keys(FALLBACK)) {
    const v = (cfg as Record<string, unknown> | null)?.[k];
    pts[k] = typeof v === "number" && Number.isFinite(v) ? v : FALLBACK[k];
  }

  const byUser = <T extends { user_id: string }>(rows: T[] | null) => {
    const m: Record<string, T> = {}; for (const r of rows || []) m[r.user_id] = r; return m;
  };
  const br = byUser(brackets as { user_id: string; group_predictions?: Record<string, { scores?: { home: number | null; away: number | null }[] }>; knockout_tree_live?: Record<string, { winner?: string | null; score1?: number | null; score2?: number | null }> }[]);
  const sp = byUser(specials as { user_id: string; [k: string]: unknown }[]);
  const ad = byUser(advs as { user_id: string; [k: string]: unknown }[]);

  const users: LoadedUser[] = (profiles || [])
    .map((p: { id: string; display_name: string | null }) => {
      const b = br[p.id]; const s = sp[p.id]; const a = ad[p.id];
      const groups: Record<string, ({ home: number | null; away: number | null })[]> = {};
      for (const L of GROUP_LETTERS) groups[L] = (b?.group_predictions?.[L]?.scores ?? []) as { home: number | null; away: number | null }[];
      return {
        email: emailById[p.id] || "", name: p.display_name || "ללא שם", groups,
        adv: {
          group_qualifiers: (a?.group_qualifiers as Record<string, string[]>) ?? {},
          advance_to_r16: (a?.advance_to_r16 as string[]) ?? [], advance_to_qf: (a?.advance_to_qf as string[]) ?? [],
          advance_to_sf: (a?.advance_to_sf as string[]) ?? [], advance_to_final: (a?.advance_to_final as string[]) ?? [],
          winner: (a?.winner as string) ?? null,
        },
        special: {
          top_scorer_player: (s?.top_scorer_player as string) ?? "", top_assists_player: (s?.top_assists_player as string) ?? "",
          best_attack_team: (s?.best_attack_team as string) ?? "", most_prolific_group: (s?.most_prolific_group as string) ?? "",
          driest_group: (s?.driest_group as string) ?? "", dirtiest_team: (s?.dirtiest_team as string) ?? "",
          matchup_pick: (s?.matchup_pick as string) ?? "", penalties_over_under: (s?.penalties_over_under as string) ?? "",
        },
        koLive: (b?.knockout_tree_live as Record<string, { winner?: string | null; score1?: number | null; score2?: number | null }>) ?? {},
      };
    })
    .sort((x: LoadedUser, y: LoadedUser) => x.name.localeCompare(y.name, "he"));

  return { users, pts };
}

async function main() {
  const { users, pts } = await load();
  const N = users.length;
  const wb = new ExcelJS.Workbook();
  wb.creator = "WC2026 The Minhelet — recovery";
  wb.created = new Date();
  const rd = wb.addWorksheet("00_README", { views: [{ rightToLeft: true }] }); // leftmost tab

  // ---- 09_rules -------------------------------------------------------------
  const rules = wb.addWorksheet("09_rules", { views: [{ rightToLeft: true }] });
  rules.columns = [{ width: 26 }, { width: 8 }, { width: 56 }];
  rules.addRow(["שם", "ניקוד", "תיאור"]).font = { bold: true };
  const ruleDefs: [string, number, string][] = [
    ["pts_group_toto", pts.toto_group, "בתים — כיוון נכון (טוטו)"],
    ["pts_group_exact_bonus", pts.exact_group, "בתים — בונוס תוצאה מדויקת"],
    ["toto_r32", pts.toto_r32, "נוקאאוט 1/16 — טוטו"], ["exact_r32", pts.exact_r32, "נוקאאוט 1/16 — בונוס מדויק"],
    ["toto_r16", pts.toto_r16, "שמינית — טוטו"], ["exact_r16", pts.exact_r16, "שמינית — בונוס מדויק"],
    ["toto_qf", pts.toto_qf, "רבע — טוטו"], ["exact_qf", pts.exact_qf, "רבע — בונוס מדויק"],
    ["toto_sf", pts.toto_sf, "חצי — טוטו"], ["exact_sf", pts.exact_sf, "חצי — בונוס מדויק"],
    ["toto_third", pts.toto_third, "מקום 3 — טוטו"], ["exact_third", pts.exact_third, "מקום 3 — בונוס מדויק"],
    ["toto_final", pts.toto_final, "גמר — טוטו"], ["exact_final", pts.exact_final, "גמר — בונוס מדויק"],
    ["pts_adv_group_exact", pts.group_advance_exact, "עולה מבית — מיקום מדויק"],
    ["pts_adv_group_partial", pts.group_advance_partial, "עולה מבית — לא מדויק (1↔2)"],
    ["pts_adv_group_as3rd", pts.group_advance_as_3rd, "עולה מבית — ממקום שלישי"],
    ["pts_r16", pts.advance_r16, "עולה לשמינית (כל נבחרת)"], ["pts_qf", pts.advance_qf, "עולה לרבע"],
    ["pts_sf", pts.advance_sf, "עולה לחצי"], ["pts_final", pts.advance_final, "עולה לגמר"], ["pts_winner", pts.advance_winner, "אלוף הטורניר"],
    ["pts_top_scorer", pts.top_scorer_exact, "מלך שערים — מדויק"], ["pts_top_scorer_rel", pts.top_scorer_relative, "מלך שערים — יחסי (ידני)"],
    ["pts_top_assists", pts.top_assists_exact, "מלך בישולים — מדויק"], ["pts_top_assists_rel", pts.top_assists_relative, "מלך בישולים — יחסי (ידני)"],
    ["pts_best_attack", pts.best_attack, "התקפה הכי טובה"], ["pts_prolific", pts.prolific_group, "בית פורה"],
    ["pts_driest", pts.driest_group, "בית יבש"], ["pts_dirtiest", pts.dirtiest_team, "נבחרת כסחנית"],
    ["pts_matchup", pts.matchup, "מאצ׳אפ נכון (כל אחד)"], ["pts_penalties", pts.penalties_over_under, "פנדלים אובר/אנדר"],
    ["min_scorer_goals", pts.top_scorer_min_goals, "מינ׳ שערים לזכאות יחסית"], ["min_assists", pts.top_assists_min, "מינ׳ בישולים לזכאות יחסית"],
  ];
  ruleDefs.forEach(([name, val, desc], i) => {
    const r = i + 2;
    rules.getCell(`A${r}`).value = name; rules.getCell(`A${r}`).font = { bold: true };
    rules.getCell(`B${r}`).value = val; rules.getCell(`B${r}`).fill = YELLOW;
    rules.getCell(`C${r}`).value = desc; rules.getCell(`C${r}`).alignment = rtl;
    wb.definedNames.add(`'09_rules'!$B$${r}`, name);
  });

  // ---- 01_results -----------------------------------------------------------
  const res = wb.addWorksheet("01_results", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  res.columns = [{ header: "match_id", width: 9 }, { header: "בית", width: 6 }, { header: "בית (TLA)", width: 9 }, { header: "חוץ (TLA)", width: 9 }, { header: "שערי בית", width: 10 }, { header: "שערי חוץ", width: 10 }];
  res.getRow(1).font = { bold: true }; res.getRow(1).fill = BLUE;
  GROUP_LETTERS.forEach((L, gi) => {
    matchups((GROUPS[L] || []).map(t => t.code)).forEach((mu, i) => {
      const r = 2 + gi * 6 + i;
      res.getCell(`A${r}`).value = `${L}${i + 1}`; res.getCell(`B${r}`).value = L;
      res.getCell(`C${r}`).value = mu.h; res.getCell(`D${r}`).value = mu.a;
      res.getCell(`E${r}`).fill = YELLOW; res.getCell(`E${r}`).dataValidation = wholeDV(0, 30);
      res.getCell(`F${r}`).fill = YELLOW; res.getCell(`F${r}`).dataValidation = wholeDV(0, 30);
    });
  });
  const resRow = (gi: number, n: number) => 2 + gi * 6 + (n - 1);

  // ---- 02_advancers ---------------------------------------------------------
  const advIn = wb.addWorksheet("02_advancers", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  advIn.columns = [
    { header: "בית", width: 6 }, { header: "1", width: 8 }, { header: "2", width: 8 }, { header: "3", width: 8 }, { header: "4", width: 8 }, { header: "3' עלתה?", width: 10 },
    { header: "", width: 3 }, { header: "עלו לשמינית (16)", width: 16 }, { header: "עלו לרבע (8)", width: 14 }, { header: "עלו לחצי (4)", width: 13 }, { header: "עלו לגמר (2)", width: 13 }, { header: "אלופה", width: 10 },
  ];
  advIn.getRow(1).font = { bold: true }; advIn.getRow(1).fill = GREEN;
  GROUP_LETTERS.forEach((L, gi) => {
    const r = 2 + gi; const codes = (GROUPS[L] || []).map(t => t.code);
    advIn.getCell(`A${r}`).value = L;
    ["B", "C", "D", "E"].forEach(c => { const cell = advIn.getCell(`${c}${r}`); cell.fill = YELLOW; cell.dataValidation = listDV(`"${codes.join(",")}"`); });
    advIn.getCell(`F${r}`).value = "לא"; advIn.getCell(`F${r}`).fill = YELLOW; advIn.getCell(`F${r}`).dataValidation = listDV(`"כן,לא"`);
  });
  const advBlock = (col: string, from: number, to: number) => { for (let i = from; i <= to; i++) { const c = advIn.getCell(`${col}${i}`); c.fill = YELLOW; c.dataValidation = listDV("tla_list"); } };
  advBlock("H", 2, 17); advBlock("I", 2, 9); advBlock("J", 2, 5); advBlock("K", 2, 3); advBlock("L", 2, 2);
  wb.definedNames.add("'02_advancers'!$H$2:$H$17", "actual_r16");
  wb.definedNames.add("'02_advancers'!$I$2:$I$9", "actual_qf");
  wb.definedNames.add("'02_advancers'!$J$2:$J$5", "actual_sf");
  wb.definedNames.add("'02_advancers'!$K$2:$K$3", "actual_final");
  wb.definedNames.add("'02_advancers'!$L$2", "act_champion");
  const advRow = (gi: number) => 2 + gi;

  // ---- 03_specials ----------------------------------------------------------
  const spIn = wb.addWorksheet("03_specials", { views: [{ rightToLeft: true }] });
  spIn.columns = [{ header: "הימור", width: 30 }, { header: "תוצאה בפועל", width: 22 }];
  spIn.getRow(1).font = { bold: true }; spIn.getRow(1).fill = GREEN;
  const specActuals: [string, string, ExcelJS.DataValidation | null][] = [
    ["act_top_scorer", "מלך שערים (שם שחקן)", null],
    ["act_top_assists", "מלך בישולים (שם שחקן)", null],
    ["act_best_attack", "התקפה הכי טובה (TLA)", listDV("tla_list")],
    ["act_prolific", "בית פורה (אות בית)", listDV(GROUP_LIST)],
    ["act_driest", "בית יבש (אות בית)", listDV(GROUP_LIST)],
    ["act_dirtiest", "נבחרת כסחנית (TLA)", listDV("tla_list")],
    ["act_mu1", `מאצ׳אפ 1 — ${MATCHUP_LABELS[0]}`, listDV(`"1,X,2"`)],
    ["act_mu2", `מאצ׳אפ 2 — ${MATCHUP_LABELS[1]}`, listDV(`"1,X,2"`)],
    ["act_mu3", `מאצ׳אפ 3 — ${MATCHUP_LABELS[2]}`, listDV(`"1,X,2"`)],
    ["act_penalties", "פנדלים (OVER/UNDER)", listDV(`"OVER,UNDER"`)],
  ];
  specActuals.forEach(([name, label, dv], i) => {
    const r = i + 2;
    spIn.getCell(`A${r}`).value = label; spIn.getCell(`A${r}`).alignment = rtl;
    const b = spIn.getCell(`B${r}`); b.fill = YELLOW; if (dv) b.dataValidation = dv;
    wb.definedNames.add(`'03_specials'!$B$${r}`, name);
  });

  // ---- 04_ko_results --------------------------------------------------------
  const koRes = wb.addWorksheet("04_ko_results", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  koRes.columns = [{ header: "slot", width: 11 }, { header: "שלב", width: 10 }, { header: "שערי בית", width: 10 }, { header: "שערי חוץ", width: 10 }, { header: "מנצח פנדלים (אם תיקו)", width: 20 }];
  koRes.getRow(1).font = { bold: true }; koRes.getRow(1).fill = BLUE;
  KO_SLOTS.forEach((k, si) => {
    const r = 2 + si;
    koRes.getCell(`A${r}`).value = k; koRes.getCell(`B${r}`).value = STAGE_HE[stageOf(k)];
    koRes.getCell(`C${r}`).fill = YELLOW; koRes.getCell(`C${r}`).dataValidation = wholeDV(0, 30);
    koRes.getCell(`D${r}`).fill = YELLOW; koRes.getCell(`D${r}`).dataValidation = wholeDV(0, 30);
    koRes.getCell(`E${r}`).fill = YELLOW; koRes.getCell(`E${r}`).dataValidation = listDV("tla_list");
  });
  const koResRow = (si: number) => 2 + si;

  // ---- Groups (bets + auto pts) ---------------------------------------------
  const g = wb.addWorksheet("Groups", { views: [{ rightToLeft: true, state: "frozen", xSplit: 2, ySplit: 1 }] });
  const gHdr: string[] = ["email", "שם"];
  GROUP_LETTERS.forEach(L => { for (let n = 1; n <= 6; n++) gHdr.push(`${L}${n}_ב`, `${L}${n}_ח`, `${L}${n}_נק`); });
  gHdr.push("סה״כ בתים");
  g.addRow(gHdr); g.getRow(1).font = { bold: true }; g.getRow(1).fill = BLUE; g.getColumn(1).width = 26; g.getColumn(2).width = 14;
  const gTotalCol = 2 + 72 * 3 + 1;
  users.forEach((u, ui) => {
    const xr = ui + 2; const row = g.getRow(xr);
    row.getCell(1).value = u.email; row.getCell(2).value = u.name;
    GROUP_LETTERS.forEach((L, gi) => {
      for (let n = 1; n <= 6; n++) {
        const m = gi * 6 + (n - 1), cH = 3 + m * 3, cA = 4 + m * 3, cP = 5 + m * 3;
        const s = u.groups[L]?.[n - 1];
        row.getCell(cH).value = s?.home ?? null; row.getCell(cA).value = s?.away ?? null;
        const pH = `${colLetter(cH)}${xr}`, pA = `${colLetter(cA)}${xr}`, rr = resRow(gi, n);
        const aH = `'01_results'!E${rr}`, aA = `'01_results'!F${rr}`;
        const dir = `OR(AND(${pH}>${pA},${aH}>${aA}),AND(${pH}<${pA},${aH}<${aA}),AND(${pH}=${pA},${aH}=${aA}))`;
        row.getCell(cP).value = { formula: `IF(OR(${pH}="",${pA}="",${aH}="",${aA}=""),"",IF(AND(${pH}=${aH},${pA}=${aA}),pts_group_toto+pts_group_exact_bonus,IF(${dir},pts_group_toto,0)))` };
      }
    });
    row.getCell(gTotalCol).value = { formula: `SUM(${colLetter(5)}${xr}:${colLetter(2 + 72 * 3)}${xr})` };
    row.getCell(gTotalCol).font = { bold: true };
  });
  g.getCell(1, gTotalCol).value = "סה״כ בתים"; g.getCell(1, gTotalCol).font = { bold: true };

  // ---- Advancement ----------------------------------------------------------
  const a = wb.addWorksheet("Advancement", { views: [{ rightToLeft: true, state: "frozen", xSplit: 2, ySplit: 1 }] });
  const AC = { r16: 39, r16pts: 55, qf: 56, qfpts: 64, sf: 65, sfpts: 69, fin: 70, finpts: 72, win: 73, winpts: 74, gtot: 75, atot: 76 };
  const aHdr: string[] = ["email", "שם"];
  GROUP_LETTERS.forEach(L => aHdr.push(`${L}_1`, `${L}_2`, `${L}_נק`));
  for (let i = 1; i <= 16; i++) aHdr.push(`R16_${i}`); aHdr.push("נק_שמינית");
  for (let i = 1; i <= 8; i++) aHdr.push(`QF_${i}`); aHdr.push("נק_רבע");
  for (let i = 1; i <= 4; i++) aHdr.push(`SF_${i}`); aHdr.push("נק_חצי");
  for (let i = 1; i <= 2; i++) aHdr.push(`F_${i}`); aHdr.push("נק_גמר");
  aHdr.push("אלופה", "נק_אלופה", "סה״כ עולות מבית", "סה״כ עולות");
  a.addRow(aHdr); a.getRow(1).font = { bold: true }; a.getRow(1).fill = GREEN; a.getColumn(1).width = 26; a.getColumn(2).width = 14;
  users.forEach((u, ui) => {
    const xr = ui + 2; const row = a.getRow(xr);
    row.getCell(1).value = u.email; row.getCell(2).value = u.name;
    GROUP_LETTERS.forEach((L, gi) => {
      const q1c = 3 + gi * 3, q2c = 4 + gi * 3, gpc = 5 + gi * 3, picks = u.adv.group_qualifiers[L] || [];
      row.getCell(q1c).value = picks[0] ?? ""; row.getCell(q2c).value = picks[1] ?? "";
      const q1 = `${colLetter(q1c)}${xr}`, q2 = `${colLetter(q2c)}${xr}`, ar = advRow(gi);
      const a1 = `'02_advancers'!$B$${ar}`, a2 = `'02_advancers'!$C$${ar}`, a3 = `'02_advancers'!$D$${ar}`, tq = `'02_advancers'!$F$${ar}`;
      const q1p = `IF(${q1}="",0,IF(${q1}=${a1},pts_adv_group_exact,IF(${q1}=${a2},pts_adv_group_partial,IF(AND(${tq}="כן",${q1}=${a3}),pts_adv_group_as3rd,0))))`;
      const q2p = `IF(OR(${q2}="",${q2}=${q1}),0,IF(${q2}=${a2},pts_adv_group_exact,IF(${q2}=${a1},pts_adv_group_partial,IF(AND(${tq}="כן",${q2}=${a3}),pts_adv_group_as3rd,0))))`;
      row.getCell(gpc).value = { formula: `${q1p}+${q2p}` };
    });
    const fill = (start: number, count: number, arr: string[]) => { for (let i = 0; i < count; i++) row.getCell(start + i).value = arr[i] ?? ""; };
    fill(AC.r16, 16, u.adv.advance_to_r16); fill(AC.qf, 8, u.adv.advance_to_qf); fill(AC.sf, 4, u.adv.advance_to_sf); fill(AC.fin, 2, u.adv.advance_to_final);
    row.getCell(AC.win).value = u.adv.winner ?? "";
    row.getCell(AC.r16pts).value = { formula: `pts_r16*(${tierSum(AC.r16, 16, "actual_r16", xr)})` };
    row.getCell(AC.qfpts).value = { formula: `pts_qf*(${tierSum(AC.qf, 8, "actual_qf", xr)})` };
    row.getCell(AC.sfpts).value = { formula: `pts_sf*(${tierSum(AC.sf, 4, "actual_sf", xr)})` };
    row.getCell(AC.finpts).value = { formula: `pts_final*(${tierSum(AC.fin, 2, "actual_final", xr)})` };
    const win = `${colLetter(AC.win)}${xr}`;
    row.getCell(AC.winpts).value = { formula: `IF(AND(${win}<>"",${win}=act_champion),pts_winner,0)` };
    const gptsCells = GROUP_LETTERS.map((_, gi) => `${colLetter(5 + gi * 3)}${xr}`).join(",");
    row.getCell(AC.gtot).value = { formula: `SUM(${gptsCells})` };
    row.getCell(AC.atot).value = { formula: `${colLetter(AC.gtot)}${xr}+${colLetter(AC.r16pts)}${xr}+${colLetter(AC.qfpts)}${xr}+${colLetter(AC.sfpts)}${xr}+${colLetter(AC.finpts)}${xr}+${colLetter(AC.winpts)}${xr}` };
    row.getCell(AC.atot).font = { bold: true };
  });

  // ---- Specials -------------------------------------------------------------
  const s = wb.addWorksheet("Specials", { views: [{ rightToLeft: true, state: "frozen", xSplit: 2, ySplit: 1 }] });
  s.addRow(["email", "שם", "מלך שערים", "מלך בישולים", "התקפה", "בית פורה", "בית יבש", "כסחנית", "מאצ׳1", "מאצ׳2", "מאצ׳3", "פנדלים",
    "נק_שערים", "נק_בישול", "נק_התקפה", "נק_פורה", "נק_יבש", "נק_כסחנית", "נק_מאצ׳", "נק_פנדל", "בונוס_יחסי(ידני)", "סה״כ מיוחדים"]);
  s.getRow(1).font = { bold: true }; s.getRow(1).fill = PURPLE; s.getColumn(1).width = 26; s.getColumn(2).width = 14;
  const sTotalCol = 22;
  users.forEach((u, ui) => {
    const xr = ui + 2; const row = s.getRow(xr); const mu = (u.special.matchup_pick || "").split(",");
    row.getCell(1).value = u.email; row.getCell(2).value = u.name;
    row.getCell(3).value = u.special.top_scorer_player ?? ""; row.getCell(4).value = u.special.top_assists_player ?? "";
    row.getCell(5).value = u.special.best_attack_team ?? ""; row.getCell(6).value = u.special.most_prolific_group ?? "";
    row.getCell(7).value = u.special.driest_group ?? ""; row.getCell(8).value = u.special.dirtiest_team ?? "";
    row.getCell(9).value = mu[0] ?? ""; row.getCell(10).value = mu[1] ?? ""; row.getCell(11).value = mu[2] ?? "";
    row.getCell(12).value = u.special.penalties_over_under ?? "";
    const ref = (c: number) => `${colLetter(c)}${xr}`;
    row.getCell(13).value = { formula: `IF(AND(${ref(3)}<>"",${ref(3)}=act_top_scorer),pts_top_scorer,0)` };
    row.getCell(14).value = { formula: `IF(AND(${ref(4)}<>"",${ref(4)}=act_top_assists),pts_top_assists,0)` };
    row.getCell(15).value = { formula: `IF(AND(${ref(5)}<>"",${ref(5)}=act_best_attack),pts_best_attack,0)` };
    row.getCell(16).value = { formula: `IF(AND(${ref(6)}<>"",${ref(6)}=act_prolific),pts_prolific,0)` };
    row.getCell(17).value = { formula: `IF(AND(${ref(7)}<>"",${ref(7)}=act_driest),pts_driest,0)` };
    row.getCell(18).value = { formula: `IF(AND(${ref(8)}<>"",${ref(8)}=act_dirtiest),pts_dirtiest,0)` };
    row.getCell(19).value = { formula: `IF(AND(${ref(9)}<>"",${ref(9)}=act_mu1),pts_matchup,0)+IF(AND(${ref(10)}<>"",${ref(10)}=act_mu2),pts_matchup,0)+IF(AND(${ref(11)}<>"",${ref(11)}=act_mu3),pts_matchup,0)` };
    row.getCell(20).value = { formula: `IF(AND(${ref(12)}<>"",${ref(12)}=act_penalties),pts_penalties,0)` };
    row.getCell(21).fill = YELLOW;
    row.getCell(sTotalCol).value = { formula: `SUM(${ref(13)}:${ref(21)})` };
    row.getCell(sTotalCol).font = { bold: true };
  });

  // ---- Knockout_live (real-data tree — scored) ------------------------------
  const kl = wb.addWorksheet("Knockout_live", { views: [{ rightToLeft: true, state: "frozen", xSplit: 2, ySplit: 1 }] });
  const klHdr: string[] = ["email", "שם"];
  for (const k of KO_SLOTS) klHdr.push(`${k}_ב`, `${k}_ח`, `${k}_מנצח`, `${k}_נק`);
  const klTotalCol = 3 + KO_SLOTS.length * 4;
  klHdr.push("סה״כ נוקאאוט");
  kl.addRow(klHdr); kl.getRow(1).font = { bold: true }; kl.getRow(1).fill = YELLOW; kl.getColumn(1).width = 26; kl.getColumn(2).width = 14;
  kl.getCell("A1").note = "עץ נתוני-האמת — ההימורים שממולאים בלייב במהלך הטורניר. ריק לפני הפתיחה; מתמלא בהרצה מחדש של הסקריפט.";
  users.forEach((u, ui) => {
    const xr = ui + 2; const row = kl.getRow(xr);
    row.getCell(1).value = u.email; row.getCell(2).value = u.name;
    KO_SLOTS.forEach((k, si) => {
      const base = 3 + si * 4, m = u.koLive[k] || {};
      row.getCell(base).value = m.score1 ?? null; row.getCell(base + 1).value = m.score2 ?? null; row.getCell(base + 2).value = m.winner ?? "";
      const pH = `${colLetter(base)}${xr}`, pA = `${colLetter(base + 1)}${xr}`, pW = `${colLetter(base + 2)}${xr}`;
      const sr = koResRow(si), aH = `'04_ko_results'!$C$${sr}`, aA = `'04_ko_results'!$D$${sr}`, pw = `'04_ko_results'!$E$${sr}`;
      const st = stageOf(k), tn = `toto_${st}`, en = `exact_${st}`;
      const toto = `IF(OR(${pH}="",${pA}="",${aH}="",${aA}=""),0,IF(AND(${aH}<>${aA},SIGN(${pH}-${pA})=SIGN(${aH}-${aA})),${tn},IF(AND(${aH}=${aA},${pH}=${pA},${pW}<>"",${pW}=${pw}),${tn},0)))`;
      const exact = `IF(AND(${pH}<>"",${aH}<>"",${pH}=${aH},${pA}=${aA}),${en},0)`;
      row.getCell(base + 3).value = { formula: `${toto}+${exact}` };
    });
    const ptsCells = KO_SLOTS.map((_, si) => `${colLetter(6 + si * 4)}${xr}`).join(",");
    row.getCell(klTotalCol).value = { formula: `SUM(${ptsCells})` };
    row.getCell(klTotalCol).font = { bold: true };
  });
  kl.getCell(1, klTotalCol).value = "סה״כ נוקאאוט"; kl.getCell(1, klTotalCol).font = { bold: true };

  // ---- Teams (reference + dropdown source) ----------------------------------
  const teams = wb.addWorksheet("Teams", { views: [{ rightToLeft: true }] });
  teams.columns = [{ header: "TLA", width: 6 }, { header: "שם", width: 18 }, { header: "בית", width: 6 }];
  teams.getRow(1).font = { bold: true };
  for (const t of ALL_TEAMS) {
    const grp = GROUP_LETTERS.find(l => GROUPS[l]?.some(x => x.code === t.code)) || "";
    teams.addRow([t.code, getTeamByCode(t.code)?.name_he || t.name, grp]);
  }
  wb.definedNames.add(`Teams!$A$2:$A$${1 + ALL_TEAMS.length}`, "tla_list");

  // ---- Leaderboard ----------------------------------------------------------
  const lb = wb.addWorksheet("Leaderboard", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  lb.columns = [
    { header: "דירוג", width: 7 }, { header: "שם", width: 16 }, { header: "email", width: 26 },
    { header: "בתים", width: 9 }, { header: "נוקאאוט", width: 10 }, { header: "עולות", width: 9 }, { header: "מיוחדים", width: 10 }, { header: "סה״כ", width: 9 },
  ];
  lb.getRow(1).font = { bold: true }; lb.getRow(1).fill = BLUE;
  const gTL = colLetter(gTotalCol), klTL = colLetter(klTotalCol), aTL = colLetter(AC.atot), sTL = colLetter(sTotalCol), last = 1 + N;
  // Every sheet is built from the SAME sorted user list, so Leaderboard row r maps
  // 1:1 to row r on each sheet. Direct cross-sheet refs beat VLOOKUP for robustness
  // (no key matching, no wide-range limits) — works in Excel / Sheets / Numbers.
  users.forEach((u, ui) => {
    const r = ui + 2;
    lb.getCell(`A${r}`).value = { formula: `COUNTIF($H$2:$H$${last},">"&H${r})+1` };
    lb.getCell(`B${r}`).value = u.name; lb.getCell(`C${r}`).value = u.email;
    lb.getCell(`D${r}`).value = { formula: `Groups!${gTL}${r}` };
    lb.getCell(`E${r}`).value = { formula: `Knockout_live!${klTL}${r}` };
    lb.getCell(`F${r}`).value = { formula: `Advancement!${aTL}${r}` };
    lb.getCell(`G${r}`).value = { formula: `Specials!${sTL}${r}` };
    lb.getCell(`H${r}`).value = { formula: `SUM(D${r}:G${r})` }; lb.getCell(`H${r}`).font = { bold: true };
  });

  // ---- 00_README ------------------------------------------------------------
  rd.columns = [{ width: 112 }];
  const put = (i: number, t: string, bold = false, size = 11) => { const c = rd.getCell(`A${i}`); c.value = t; c.alignment = rtl; c.font = { bold, size }; };
  put(1, "wc2026-recovery.xlsx — חוברת חירום לחישוב הניקוד", true, 14);
  [
    "",
    "אם האתר נופל — מזינים את התוצאות האמיתיות בתאים הצהובים (עם רשימות נפתחות) והניקוד של כולם מחושב לבד.",
    "",
    "גיליונות קלט (צהוב = להקליד; יש Dropdown ואימות נתונים):",
    "• 01_results — שערי בית/חוץ ל-72 משחקי הבתים → ניקוד טוטו/מדויק.",
    "• 02_advancers — לכל בית: מי סיים 1/2/3/4 (מתוך נבחרות הבית) והאם השלישית עלתה; ובהמשך רשימות מי עלה לשמינית/רבע/חצי/גמר + אלופה → ניקוד עולות.",
    "• 03_specials — תוצאות ההימורים המיוחדים בפועל (מלך שערים, התקפה, מאצ׳אפים 1/X/2, פנדלים OVER/UNDER וכו').",
    "• 04_ko_results — לכל משחק נוקאאוט (לפי slot): שערי בית/חוץ של 90 הדקות; אם הסתיים בתיקו והוכרע בפנדלים — להזין גם 'מנצח פנדלים' → ניקוד תוצאות הנוקאאוט.",
    "",
    "גיליונות חישוב (לא לגעת): Groups · Advancement · Specials · Knockout_live · Leaderboard.",
    "Leaderboard = בתים + נוקאאוט + עולות + מיוחדים, ממוין לפי דירוג.",
    "09_rules — ערכי הניקוד (נמשכו מהאתר). שינוי כאן מעדכן את כל החישובים. Teams — מקור הרשימות הנפתחות.",
    "",
    "הימורים בלייב — איפה זה נכנס:",
    "• עריכת תוצאות בתים (מותרת עד נעילת אותו יום-משחקים) ועץ נתוני-האמת של הנוקאאוט (Knockout_live) שממולא במהלך הטורניר —",
    "  נקלטים ע״י הרצה מחדש של הסקריפט: הוא תמיד מושך את המצב העדכני. לפני הפתיחה עץ הנוקאאוט ריק (0 נק׳),",
    "  ולכן צריך להריץ מחדש את הסקריפט במהלך הטורניר כדי לכלול את הימורי הנוקאאוט החיים.",
    "",
    "קודי נבחרת = TLA (גיליון Teams) · בית = A..L · מאצ׳אפ = 1/X/2 · פנדלים = OVER/UNDER.",
    `נוצר: ${new Date().toISOString().slice(0, 10)} · ${N} מהמרים · ערכי ניקוד מהאתר (live).`,
  ].forEach((t, i) => put(i + 2, t));

  await wb.xlsx.writeFile(OUT);
  console.log(`✓ ${path.relative(path.resolve(__dirname, ".."), OUT)}  (${N} bettors, dropdowns + live-KO ready)`);
  console.log(`  group ${pts.toto_group}+${pts.exact_group} · KO toto r32/r16/qf/sf/final/3rd ${pts.toto_r32}/${pts.toto_r16}/${pts.toto_qf}/${pts.toto_sf}/${pts.toto_final}/${pts.toto_third} · adv ${pts.group_advance_exact}/${pts.group_advance_partial}/${pts.group_advance_as_3rd} r16 ${pts.advance_r16} qf ${pts.advance_qf} sf ${pts.advance_sf} fin ${pts.advance_final} win ${pts.advance_winner}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
