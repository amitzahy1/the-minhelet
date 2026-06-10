// =============================================================================
// build-recovery-workbook.ts
//
// Produces ONE self-contained disaster-recovery workbook:
//   local-backups/wc2026-recovery.xlsx   (gitignored — contains real bets)
//
// If the site is down, the admin enters REAL results into the input sheets and
// every bettor's score recomputes automatically via Excel formulas:
//   • 01_results    — group-stage match scores  → group toto/exact scoring
//   • 02_advancers  — actual group order + who reached each KO round + champion
//                     → advancement scoring (qualifiers ladder, R16/QF/SF/Final, winner)
//   • 03_specials   — actual special outcomes → special-bets scoring
//   • Leaderboard   — sums groups + advancement + specials, ranked
//
// Scoring values are pulled LIVE from scoring_config (the admin "ניקוד" tab is
// the source of truth) with a per-field fallback to the code constants.
//
// NOTE on knockout MATCH scoring: KO result points come from the "real-data
// tree" players fill DURING the tournament (knockout_tree_live). Those picks do
// not exist before kickoff, so they are not scored here. Re-run this script
// during the tournament to fold them in. The pre-tournament simulation tree is
// included on a reference sheet only (it feeds advancement, already scored).
//
// Run:  npx tsx scripts/build-recovery-workbook.ts
// =============================================================================

import ExcelJS from "exceljs";
import path from "node:path";
import * as fs from "node:fs";
import { GROUPS, GROUP_LETTERS, ALL_TEAMS, getTeamByCode } from "../src/lib/tournament/groups";

// ---- env ----
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

// 6 round-robin matchups per group, same order the betting UI uses.
const matchups = (codes: string[]) => {
  const [a, b, c, d] = codes;
  return [{ h: a, a: b }, { h: c, a: d }, { h: a, a: c }, { h: d, a: b }, { h: d, a: a }, { h: b, a: c }];
};
const MATCHUP_LABELS = ["Messi vs Ronaldo", "Raphinha vs Vinícius", "Mbappé vs Kane"];

function colLetter(idx: number): string {
  let s = "", i = idx;
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

const YELLOW = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } } as ExcelJS.FillPattern;
const BLUE = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E7FF" } } as ExcelJS.FillPattern;
const GREEN = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } } as ExcelJS.FillPattern;
const rtl = { horizontal: "right" } as ExcelJS.Alignment;

// =============================================================================
// Scoring values — live scoring_config with fallback to current code constants.
// =============================================================================
const FALLBACK: Record<string, number> = {
  toto_group: 2, exact_group: 1,
  group_advance_exact: 3, group_advance_partial: 1, group_advance_as_3rd: 0,
  advance_r16: 2, advance_qf: 3, advance_sf: 6, advance_final: 10, advance_winner: 16,
  top_scorer_exact: 12, top_scorer_relative: 7, top_assists_exact: 9, top_assists_relative: 5,
  best_attack: 8, prolific_group: 6, driest_group: 6, dirtiest_team: 6, matchup: 5, penalties_over_under: 6,
  top_scorer_min_goals: 3, top_assists_min: 2,
};

interface LoadedUser {
  email: string;
  name: string;
  groups: Record<string, ({ home: number | null; away: number | null })[]>;
  adv: {
    group_qualifiers: Record<string, string[]>;
    advance_to_r16: string[]; advance_to_qf: string[]; advance_to_sf: string[];
    advance_to_final: string[]; winner: string | null;
  };
  special: Record<string, string | null>;
  ko: Record<string, { winner?: string | null; score1?: number | null; score2?: number | null }>;
}

async function load(): Promise<{ users: LoadedUser[]; pts: Record<string, number> }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
  const { createClient } = await import("@supabase/supabase-js");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const [{ data: profiles }, { data: brackets }, { data: specials }, { data: advs }, { data: cfg }, { data: auth }] =
    await Promise.all([
      sb.from("profiles").select("id, display_name"),
      sb.from("user_brackets").select("user_id, group_predictions, knockout_tree"),
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
  const br = byUser(brackets as { user_id: string; group_predictions?: Record<string, { scores?: { home: number | null; away: number | null }[] }>; knockout_tree?: Record<string, { winner?: string | null; score1?: number | null; score2?: number | null }> }[]);
  const sp = byUser(specials as { user_id: string; [k: string]: unknown }[]);
  const ad = byUser(advs as { user_id: string; [k: string]: unknown }[]);

  const users: LoadedUser[] = (profiles || [])
    .map((p: { id: string; display_name: string | null }) => {
      const b = br[p.id]; const s = sp[p.id]; const a = ad[p.id];
      const groups: Record<string, ({ home: number | null; away: number | null })[]> = {};
      for (const L of GROUP_LETTERS) groups[L] = (b?.group_predictions?.[L]?.scores ?? []) as { home: number | null; away: number | null }[];
      return {
        email: emailById[p.id] || "",
        name: p.display_name || "ללא שם",
        groups,
        adv: {
          group_qualifiers: (a?.group_qualifiers as Record<string, string[]>) ?? {},
          advance_to_r16: (a?.advance_to_r16 as string[]) ?? [],
          advance_to_qf: (a?.advance_to_qf as string[]) ?? [],
          advance_to_sf: (a?.advance_to_sf as string[]) ?? [],
          advance_to_final: (a?.advance_to_final as string[]) ?? [],
          winner: (a?.winner as string) ?? null,
        },
        special: {
          top_scorer_player: (s?.top_scorer_player as string) ?? "",
          top_assists_player: (s?.top_assists_player as string) ?? "",
          best_attack_team: (s?.best_attack_team as string) ?? "",
          most_prolific_group: (s?.most_prolific_group as string) ?? "",
          driest_group: (s?.driest_group as string) ?? "",
          dirtiest_team: (s?.dirtiest_team as string) ?? "",
          matchup_pick: (s?.matchup_pick as string) ?? "",
          penalties_over_under: (s?.penalties_over_under as string) ?? "",
        },
        ko: (b?.knockout_tree as Record<string, { winner?: string | null; score1?: number | null; score2?: number | null }>) ?? {},
      };
    })
    .sort((x: LoadedUser, y: LoadedUser) => x.name.localeCompare(y.name, "he"));

  return { users, pts };
}

// =============================================================================
// Build
// =============================================================================
async function main() {
  const { users, pts } = await load();
  const N = users.length;
  const wb = new ExcelJS.Workbook();
  wb.creator = "WC2026 The Minhelet — recovery";
  wb.created = new Date();

  // Created first so it's the leftmost tab; populated near the end (needs N).
  const rd = wb.addWorksheet("00_README", { views: [{ rightToLeft: true }] });

  // ---- 09_rules (named point cells) -----------------------------------------
  const rules = wb.addWorksheet("09_rules", { views: [{ rightToLeft: true }] });
  rules.columns = [{ width: 26 }, { width: 8 }, { width: 56 }];
  rules.addRow(["שם", "ניקוד", "תיאור"]).font = { bold: true };
  const ruleDefs: [string, number, string][] = [
    ["pts_group_toto", pts.toto_group, "בתים — כיוון נכון (טוטו)"],
    ["pts_group_exact_bonus", pts.exact_group, "בתים — בונוס תוצאה מדויקת (מעל הטוטו)"],
    ["pts_adv_group_exact", pts.group_advance_exact, "עולה מבית — מיקום מדויק"],
    ["pts_adv_group_partial", pts.group_advance_partial, "עולה מבית — לא מדויק (1↔2)"],
    ["pts_adv_group_as3rd", pts.group_advance_as_3rd, "עולה מבית — עלתה ממקום שלישי"],
    ["pts_r16", pts.advance_r16, "עולה לשמינית (כל נבחרת)"],
    ["pts_qf", pts.advance_qf, "עולה לרבע (כל נבחרת)"],
    ["pts_sf", pts.advance_sf, "עולה לחצי (כל נבחרת)"],
    ["pts_final", pts.advance_final, "עולה לגמר (כל נבחרת)"],
    ["pts_winner", pts.advance_winner, "אלוף הטורניר"],
    ["pts_top_scorer", pts.top_scorer_exact, "מלך שערים — מדויק"],
    ["pts_top_scorer_rel", pts.top_scorer_relative, "מלך שערים — יחסי (ידני)"],
    ["pts_top_assists", pts.top_assists_exact, "מלך בישולים — מדויק"],
    ["pts_top_assists_rel", pts.top_assists_relative, "מלך בישולים — יחסי (ידני)"],
    ["pts_best_attack", pts.best_attack, "התקפה הכי טובה"],
    ["pts_prolific", pts.prolific_group, "בית פורה"],
    ["pts_driest", pts.driest_group, "בית יבש"],
    ["pts_dirtiest", pts.dirtiest_team, "נבחרת כסחנית"],
    ["pts_matchup", pts.matchup, "מאצ׳אפ נכון (כל אחד)"],
    ["pts_penalties", pts.penalties_over_under, "פנדלים אובר/אנדר"],
    ["min_scorer_goals", pts.top_scorer_min_goals, "מינימום שערים לזכאות יחסית"],
    ["min_assists", pts.top_assists_min, "מינימום בישולים לזכאות יחסית"],
  ];
  ruleDefs.forEach(([name, val, desc], i) => {
    const r = i + 2;
    rules.getCell(`A${r}`).value = name; rules.getCell(`A${r}`).font = { bold: true };
    rules.getCell(`B${r}`).value = val; rules.getCell(`B${r}`).fill = YELLOW;
    rules.getCell(`C${r}`).value = desc; rules.getCell(`C${r}`).alignment = rtl;
    wb.definedNames.add(`'09_rules'!$B$${r}`, name);
  });

  // ---- 01_results (group match results input) -------------------------------
  const res = wb.addWorksheet("01_results", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  res.columns = [
    { header: "match_id", width: 9 }, { header: "בית", width: 6 },
    { header: "בית (TLA)", width: 9 }, { header: "חוץ (TLA)", width: 9 },
    { header: "שערי בית", width: 10 }, { header: "שערי חוץ", width: 10 },
  ];
  res.getRow(1).font = { bold: true }; res.getRow(1).fill = BLUE;
  // match_id Ln at row 2 + gi*6 + (n-1)
  GROUP_LETTERS.forEach((L, gi) => {
    matchups((GROUPS[L] || []).map(t => t.code)).forEach((mu, i) => {
      const r = 2 + gi * 6 + i;
      res.getCell(`A${r}`).value = `${L}${i + 1}`;
      res.getCell(`B${r}`).value = L;
      res.getCell(`C${r}`).value = mu.h;
      res.getCell(`D${r}`).value = mu.a;
      res.getCell(`E${r}`).fill = YELLOW;
      res.getCell(`F${r}`).fill = YELLOW;
    });
  });
  const resRow = (gi: number, n: number) => 2 + gi * 6 + (n - 1);

  // ---- 02_advancers (actual KO outcomes input) ------------------------------
  const advIn = wb.addWorksheet("02_advancers", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  advIn.columns = [
    { header: "בית", width: 6 }, { header: "1", width: 8 }, { header: "2", width: 8 },
    { header: "3", width: 8 }, { header: "4", width: 8 }, { header: "3' עלתה?", width: 10 },
    { header: "", width: 3 },
    { header: "עלו לשמינית (16)", width: 16 }, { header: "עלו לרבע (8)", width: 14 },
    { header: "עלו לחצי (4)", width: 13 }, { header: "עלו לגמר (2)", width: 13 }, { header: "אלופה", width: 10 },
  ];
  advIn.getRow(1).font = { bold: true }; advIn.getRow(1).fill = GREEN;
  GROUP_LETTERS.forEach((L, gi) => {
    const r = 2 + gi;
    advIn.getCell(`A${r}`).value = L;
    ["B", "C", "D", "E"].forEach(c => { advIn.getCell(`${c}${r}`).fill = YELLOW; });
    advIn.getCell(`F${r}`).value = false; advIn.getCell(`F${r}`).fill = YELLOW; // 3rd qualified flag
  });
  for (let i = 2; i <= 17; i++) advIn.getCell(`H${i}`).fill = YELLOW;   // R16 (16)
  for (let i = 2; i <= 9; i++) advIn.getCell(`I${i}`).fill = YELLOW;    // QF (8)
  for (let i = 2; i <= 5; i++) advIn.getCell(`J${i}`).fill = YELLOW;    // SF (4)
  for (let i = 2; i <= 3; i++) advIn.getCell(`K${i}`).fill = YELLOW;    // Final (2)
  advIn.getCell("L2").fill = YELLOW;                                    // champion
  wb.definedNames.add("'02_advancers'!$H$2:$H$17", "actual_r16");
  wb.definedNames.add("'02_advancers'!$I$2:$I$9", "actual_qf");
  wb.definedNames.add("'02_advancers'!$J$2:$J$5", "actual_sf");
  wb.definedNames.add("'02_advancers'!$K$2:$K$3", "actual_final");
  wb.definedNames.add("'02_advancers'!$L$2", "act_champion");
  const advRow = (gi: number) => 2 + gi; // group order row

  // ---- 03_specials (actual special outcomes input) --------------------------
  const spIn = wb.addWorksheet("03_specials", { views: [{ rightToLeft: true }] });
  spIn.columns = [{ header: "הימור", width: 24 }, { header: "תוצאה בפועל", width: 24 }];
  spIn.getRow(1).font = { bold: true }; spIn.getRow(1).fill = GREEN;
  const specActuals: [string, string][] = [
    ["act_top_scorer", "מלך שערים (שם שחקן)"],
    ["act_top_assists", "מלך בישולים (שם שחקן)"],
    ["act_best_attack", "התקפה הכי טובה (TLA)"],
    ["act_prolific", "בית פורה (אות בית)"],
    ["act_driest", "בית יבש (אות בית)"],
    ["act_dirtiest", "נבחרת כסחנית (TLA)"],
    ["act_mu1", `מאצ׳אפ 1 — ${MATCHUP_LABELS[0]} (1/X/2)`],
    ["act_mu2", `מאצ׳אפ 2 — ${MATCHUP_LABELS[1]} (1/X/2)`],
    ["act_mu3", `מאצ׳אפ 3 — ${MATCHUP_LABELS[2]} (1/X/2)`],
    ["act_penalties", "פנדלים (OVER/UNDER)"],
  ];
  specActuals.forEach(([name, label], i) => {
    const r = i + 2;
    spIn.getCell(`A${r}`).value = label; spIn.getCell(`A${r}`).alignment = rtl;
    spIn.getCell(`B${r}`).fill = YELLOW;
    wb.definedNames.add(`'03_specials'!$B$${r}`, name);
  });

  // ---- Groups (bets + auto pts) ---------------------------------------------
  const g = wb.addWorksheet("Groups", { views: [{ rightToLeft: true, state: "frozen", xSplit: 2, ySplit: 1 }] });
  const gHdr: string[] = ["email", "שם"];
  GROUP_LETTERS.forEach(L => { for (let n = 1; n <= 6; n++) gHdr.push(`${L}${n}_ב`, `${L}${n}_ח`, `${L}${n}_נק`); });
  gHdr.push("סה״כ בתים");
  g.addRow(gHdr); g.getRow(1).font = { bold: true }; g.getRow(1).fill = BLUE;
  g.getColumn(1).width = 26; g.getColumn(2).width = 14;
  const gTotalCol = 2 + 72 * 3 + 1;
  users.forEach((u, ui) => {
    const xr = ui + 2;
    const row = g.getRow(xr);
    row.getCell(1).value = u.email; row.getCell(2).value = u.name;
    GROUP_LETTERS.forEach((L, gi) => {
      for (let n = 1; n <= 6; n++) {
        const m = gi * 6 + (n - 1);
        const cH = 3 + m * 3, cA = 4 + m * 3, cP = 5 + m * 3;
        const s = u.groups[L]?.[n - 1];
        row.getCell(cH).value = s?.home ?? null;
        row.getCell(cA).value = s?.away ?? null;
        const pH = `${colLetter(cH)}${xr}`, pA = `${colLetter(cA)}${xr}`;
        const rr = resRow(gi, n);
        const aH = `'01_results'!E${rr}`, aA = `'01_results'!F${rr}`;
        const dir = `OR(AND(${pH}>${pA},${aH}>${aA}),AND(${pH}<${pA},${aH}<${aA}),AND(${pH}=${pA},${aH}=${aA}))`;
        const exact = `AND(${pH}=${aH},${pA}=${aA})`;
        row.getCell(cP).value = { formula: `IF(OR(${pH}="",${pA}="",${aH}="",${aA}=""),"",IF(${exact},pts_group_toto+pts_group_exact_bonus,IF(${dir},pts_group_toto,0)))` };
      }
    });
    const first = colLetter(5), last = colLetter(2 + 72 * 3); // first pts col .. last pts col
    row.getCell(gTotalCol).value = { formula: `SUM(${first}${xr}:${last}${xr})` };
    row.getCell(gTotalCol).font = { bold: true };
  });
  g.getCell(1, gTotalCol).value = "סה״כ בתים"; g.getCell(1, gTotalCol).font = { bold: true };

  // ---- Advancement (bets + auto pts) ----------------------------------------
  const a = wb.addWorksheet("Advancement", { views: [{ rightToLeft: true, state: "frozen", xSplit: 2, ySplit: 1 }] });
  // layout: A email, B name; per group gi: q1=3+gi*3, q2=4+gi*3, gpts=5+gi*3 (ends 38)
  // r16 39..54, r16pts 55; qf 56..63, qfpts 64; sf 65..68, sfpts 69; final 70..71, finalpts 72;
  // winner 73, winnerpts 74; group_total 75, adv_total 76
  const C = {
    r16: 39, r16pts: 55, qf: 56, qfpts: 64, sf: 65, sfpts: 69, fin: 70, finpts: 72,
    win: 73, winpts: 74, gtot: 75, atot: 76,
  };
  const aHdr: string[] = ["email", "שם"];
  GROUP_LETTERS.forEach(L => aHdr.push(`${L}_1`, `${L}_2`, `${L}_נק`));
  for (let i = 1; i <= 16; i++) aHdr.push(`R16_${i}`); aHdr.push("נק_שמינית");
  for (let i = 1; i <= 8; i++) aHdr.push(`QF_${i}`); aHdr.push("נק_רבע");
  for (let i = 1; i <= 4; i++) aHdr.push(`SF_${i}`); aHdr.push("נק_חצי");
  for (let i = 1; i <= 2; i++) aHdr.push(`F_${i}`); aHdr.push("נק_גמר");
  aHdr.push("אלופה", "נק_אלופה", "סה״כ עולות מבית", "סה״כ עולות");
  a.addRow(aHdr); a.getRow(1).font = { bold: true }; a.getRow(1).fill = GREEN;
  a.getColumn(1).width = 26; a.getColumn(2).width = 14;

  users.forEach((u, ui) => {
    const xr = ui + 2; const row = a.getRow(xr);
    row.getCell(1).value = u.email; row.getCell(2).value = u.name;
    // group qualifiers
    GROUP_LETTERS.forEach((L, gi) => {
      const q1c = 3 + gi * 3, q2c = 4 + gi * 3, gpc = 5 + gi * 3;
      const picks = u.adv.group_qualifiers[L] || [];
      row.getCell(q1c).value = picks[0] ?? "";
      row.getCell(q2c).value = picks[1] ?? "";
      const q1 = `${colLetter(q1c)}${xr}`, q2 = `${colLetter(q2c)}${xr}`;
      const ar = advRow(gi);
      const a1 = `'02_advancers'!$B$${ar}`, a2 = `'02_advancers'!$C$${ar}`, a3 = `'02_advancers'!$D$${ar}`, tq = `'02_advancers'!$F$${ar}`;
      const q1pts = `IF(${q1}="",0,IF(${q1}=${a1},pts_adv_group_exact,IF(${q1}=${a2},pts_adv_group_partial,IF(AND(${tq}=TRUE,${q1}=${a3}),pts_adv_group_as3rd,0))))`;
      const q2pts = `IF(OR(${q2}="",${q2}=${q1}),0,IF(${q2}=${a2},pts_adv_group_exact,IF(${q2}=${a1},pts_adv_group_partial,IF(AND(${tq}=TRUE,${q2}=${a3}),pts_adv_group_as3rd,0))))`;
      row.getCell(gpc).value = { formula: `${q1pts}+${q2pts}` };
    });
    // tier pick lists
    const fillList = (start: number, count: number, arr: string[]) => {
      for (let i = 0; i < count; i++) row.getCell(start + i).value = arr[i] ?? "";
    };
    fillList(C.r16, 16, u.adv.advance_to_r16);
    fillList(C.qf, 8, u.adv.advance_to_qf);
    fillList(C.sf, 4, u.adv.advance_to_sf);
    fillList(C.fin, 2, u.adv.advance_to_final);
    row.getCell(C.win).value = u.adv.winner ?? "";
    const rng = (s: number, e: number) => `${colLetter(s)}${xr}:${colLetter(e)}${xr}`;
    row.getCell(C.r16pts).value = { formula: `pts_r16*SUMPRODUCT((${rng(C.r16, C.r16 + 15)}<>"")*COUNTIF(actual_r16,${rng(C.r16, C.r16 + 15)}))` };
    row.getCell(C.qfpts).value = { formula: `pts_qf*SUMPRODUCT((${rng(C.qf, C.qf + 7)}<>"")*COUNTIF(actual_qf,${rng(C.qf, C.qf + 7)}))` };
    row.getCell(C.sfpts).value = { formula: `pts_sf*SUMPRODUCT((${rng(C.sf, C.sf + 3)}<>"")*COUNTIF(actual_sf,${rng(C.sf, C.sf + 3)}))` };
    row.getCell(C.finpts).value = { formula: `pts_final*SUMPRODUCT((${rng(C.fin, C.fin + 1)}<>"")*COUNTIF(actual_final,${rng(C.fin, C.fin + 1)}))` };
    const win = `${colLetter(C.win)}${xr}`;
    row.getCell(C.winpts).value = { formula: `IF(AND(${win}<>"",${win}=act_champion),pts_winner,0)` };
    // group qualifier total = sum of the 12 gpts cells (cols 5,8,11,...,38)
    const gptsCells = GROUP_LETTERS.map((_, gi) => `${colLetter(5 + gi * 3)}${xr}`).join(",");
    row.getCell(C.gtot).value = { formula: `SUM(${gptsCells})` };
    row.getCell(C.atot).value = {
      formula: `${colLetter(C.gtot)}${xr}+${colLetter(C.r16pts)}${xr}+${colLetter(C.qfpts)}${xr}+${colLetter(C.sfpts)}${xr}+${colLetter(C.finpts)}${xr}+${colLetter(C.winpts)}${xr}`,
    };
    row.getCell(C.atot).font = { bold: true };
  });

  // ---- Specials (bets + auto pts) -------------------------------------------
  const s = wb.addWorksheet("Specials", { views: [{ rightToLeft: true, state: "frozen", xSplit: 2, ySplit: 1 }] });
  s.addRow(["email", "שם", "מלך שערים", "מלך בישולים", "התקפה", "בית פורה", "בית יבש", "כסחנית", "מאצ׳1", "מאצ׳2", "מאצ׳3", "פנדלים",
    "נק_שערים", "נק_בישול", "נק_התקפה", "נק_פורה", "נק_יבש", "נק_כסחנית", "נק_מאצ׳", "נק_פנדל", "בונוס_יחסי(ידני)", "סה״כ מיוחדים"]);
  s.getRow(1).font = { bold: true }; s.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E8FF" } } as ExcelJS.FillPattern;
  s.getColumn(1).width = 26; s.getColumn(2).width = 14;
  const sTotalCol = 22;
  users.forEach((u, ui) => {
    const xr = ui + 2; const row = s.getRow(xr);
    const mu = (u.special.matchup_pick || "").split(",");
    row.getCell(1).value = u.email; row.getCell(2).value = u.name;
    row.getCell(3).value = u.special.top_scorer_player ?? "";
    row.getCell(4).value = u.special.top_assists_player ?? "";
    row.getCell(5).value = u.special.best_attack_team ?? "";
    row.getCell(6).value = u.special.most_prolific_group ?? "";
    row.getCell(7).value = u.special.driest_group ?? "";
    row.getCell(8).value = u.special.dirtiest_team ?? "";
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
    row.getCell(21).fill = YELLOW; // manual relative bonus
    row.getCell(sTotalCol).value = { formula: `SUM(${ref(13)}:${ref(21)})` };
    row.getCell(sTotalCol).font = { bold: true };
  });

  // ---- KO_sim_ref (reference only — feeds advancement, not match-scored here)-
  const koKeys = (() => {
    const set = new Set<string>();
    for (const u of users) for (const k of Object.keys(u.ko)) set.add(k);
    const rank = (k: string) => k === "final" ? 9 : /third/.test(k) ? 8 :
      k.startsWith("r32") ? 0 : k.startsWith("r16") ? 1 : k.startsWith("qf") ? 2 : k.startsWith("sf") ? 3 : 7;
    return [...set].sort((x, y) => rank(x) - rank(y) || x.localeCompare(y));
  })();
  const ko = wb.addWorksheet("KO_sim_ref", { views: [{ rightToLeft: true, state: "frozen", xSplit: 2, ySplit: 1 }] });
  const koHdr = ["email", "שם"]; for (const k of koKeys) koHdr.push(`${k}_מנצח`, `${k}_ב`, `${k}_ח`);
  ko.addRow(koHdr); ko.getRow(1).font = { bold: true }; ko.getRow(1).fill = YELLOW;
  ko.getColumn(1).width = 26; ko.getColumn(2).width = 14;
  ko.getCell("A1").note = "עץ הסימולציה — לעיון בלבד. ניקוד תוצאות הנוקאאוט מגיע מעץ נתוני-האמת שממולא במהלך הטורניר.";
  users.forEach((u, ui) => {
    const xr = ui + 2; const row = ko.getRow(xr);
    row.getCell(1).value = u.email; row.getCell(2).value = u.name;
    koKeys.forEach((k, ki) => {
      const m = u.ko[k] || {};
      row.getCell(3 + ki * 3).value = m.winner ?? "";
      row.getCell(4 + ki * 3).value = m.score1 ?? null;
      row.getCell(5 + ki * 3).value = m.score2 ?? null;
    });
  });

  // ---- Teams (reference) ----------------------------------------------------
  const teams = wb.addWorksheet("Teams", { views: [{ rightToLeft: true }] });
  teams.columns = [{ header: "TLA", width: 6 }, { header: "שם", width: 18 }, { header: "בית", width: 6 }];
  teams.getRow(1).font = { bold: true };
  for (const t of ALL_TEAMS) {
    const grp = GROUP_LETTERS.find(l => GROUPS[l]?.some(x => x.code === t.code)) || "";
    teams.addRow([t.code, getTeamByCode(t.code)?.name_he || t.name, grp]);
  }

  // ---- Leaderboard ----------------------------------------------------------
  const lb = wb.addWorksheet("Leaderboard", { views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }] });
  lb.columns = [
    { header: "דירוג", width: 7 }, { header: "שם", width: 16 }, { header: "email", width: 26 },
    { header: "בתים", width: 9 }, { header: "עולות", width: 9 }, { header: "מיוחדים", width: 10 }, { header: "סה״כ", width: 9 },
  ];
  lb.getRow(1).font = { bold: true }; lb.getRow(1).fill = BLUE;
  const gTL = colLetter(gTotalCol), aTL = colLetter(C.atot), sTL = colLetter(sTotalCol);
  users.forEach((u, ui) => {
    const r = ui + 2;
    lb.getCell(`A${r}`).value = { formula: `RANK(G${r},$G$2:$G$${1 + N})` };
    lb.getCell(`B${r}`).value = u.name;
    lb.getCell(`C${r}`).value = u.email;
    lb.getCell(`D${r}`).value = { formula: `IFERROR(VLOOKUP(C${r},Groups!$A:$${gTL},${gTotalCol},FALSE),0)` };
    lb.getCell(`E${r}`).value = { formula: `IFERROR(VLOOKUP(C${r},Advancement!$A:$${aTL},${C.atot},FALSE),0)` };
    lb.getCell(`F${r}`).value = { formula: `IFERROR(VLOOKUP(C${r},Specials!$A:$${sTL},${sTotalCol},FALSE),0)` };
    lb.getCell(`G${r}`).value = { formula: `SUM(D${r}:F${r})` };
    lb.getCell(`G${r}`).font = { bold: true };
  });

  // ---- 00_README (populate the sheet created first) -------------------------
  rd.columns = [{ width: 110 }];
  const put = (i: number, t: string, bold = false, size = 11) => {
    const c = rd.getCell(`A${i}`); c.value = t; c.alignment = rtl; c.font = { bold, size };
  };
  put(1, "wc2026-recovery.xlsx — חוברת חירום לחישוב הניקוד", true, 14);
  [
    "",
    "אם האתר נופל — מזינים את התוצאות האמיתיות בגיליונות הצהובים והניקוד של כולם מחושב אוטומטית.",
    "",
    "גיליונות קלט (התאים הצהובים בלבד):",
    "• 01_results — תוצאות 72 משחקי הבתים: מזינים שערי בית + שערי חוץ. מחשב ניקוד טוטו/מדויק.",
    "• 02_advancers — לכל בית: מי סיים 1/2/3/4 והאם השלישית עלתה; ובהמשך רשימת הנבחרות שעלו לשמינית/רבע/חצי/גמר + האלופה. מחשב ניקוד עולות.",
    "• 03_specials — התוצאות בפועל של ההימורים המיוחדים (מלך שערים, התקפה, מאצ׳אפים, פנדלים וכו').",
    "",
    "גיליונות חישוב (לא לגעת):",
    "• Groups / Advancement / Specials — ההימורים של כל מהמר + עמודות ניקוד אוטומטיות.",
    "• Leaderboard — טבלת הדירוג: בתים + עולות + מיוחדים = סה״כ, ממוין לפי דירוג.",
    "• 09_rules — ערכי הניקוד (נמשכו מהאתר). שינוי ערך כאן מעדכן את כל החישובים.",
    "• Teams — מיפוי TLA → שם נבחרת + בית (לעזר/רשימות).",
    "• KO_sim_ref — עץ הסימולציה לעיון בלבד.",
    "",
    "חשוב — ניקוד תוצאות הנוקאאוט (טוטו/מדויק על משחקי הגביע):",
    "ניקוד זה מגיע מ\"עץ נתוני האמת\" שכל מהמר ממלא במהלך הטורניר (אחרי שלב הבתים), ולכן אינו קיים לפני",
    "הפתיחה ואינו מחושב בחוברת זו. כדי לכלול אותו — מריצים מחדש את הסקריפט במהלך הטורניר.",
    "",
    "להזנת תוצאות יש להשתמש בקודי TLA (ראו גיליון Teams), אותיות בית באנגלית (A..L),",
    "מאצ׳אפים כ-1/X/2, ופנדלים כ-OVER/UNDER — בדיוק כפי שמופיע בתאי ההימורים.",
    `נוצר: ${new Date().toISOString().slice(0, 10)} · ${N} מהמרים · ערכי ניקוד מהאתר (live).`,
  ].forEach((t, i) => put(i + 2, t));

  await wb.xlsx.writeFile(OUT);
  console.log(`✓ ${path.relative(path.resolve(__dirname, ".."), OUT)}  (${N} bettors, scoring from live config)`);
  console.log(`  point values used: group ${pts.toto_group}+${pts.exact_group} · adv ${pts.group_advance_exact}/${pts.group_advance_partial}/${pts.group_advance_as_3rd} · r16 ${pts.advance_r16} qf ${pts.advance_qf} sf ${pts.advance_sf} final ${pts.advance_final} winner ${pts.advance_winner}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
