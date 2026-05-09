import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdmin } from "../verify-admin";
import { isLocked, formatLockDeadline } from "@/lib/constants";
import { GROUPS, GROUP_LETTERS } from "@/lib/tournament/groups";

// /api/admin/export-bets
//   Admin-only export of all user bets in a per-user wide format that can be
//   used to score the tournament manually if the site is down.
//
//   Query params:
//     ?type=groups       (default: legacy long format if no ?type)
//     ?type=knockout
//     ?type=special
//     ?type=advancement
//     ?type=all          (concatenates all four into a multi-section single CSV)
//
//   Pre-lock the route refuses (403) — exporting half-finished bets would only
//   create confusion if the recovery workbook gets used.

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

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

function generateMatchups(codes: string[]): { h: string; a: string }[] {
  const [a, b, c, d] = codes;
  return [{ h: a, a: b }, { h: c, a: d }, { h: a, a: c }, { h: d, a: b }, { h: d, a: a }, { h: b, a: c }];
}

type GroupBet = { scores?: { home: number | null; away: number | null }[] };
type GroupPredictions = Record<string, GroupBet | undefined>;
type KnockoutBet = { winner?: string | null; score1?: number | null; score2?: number | null };
type KnockoutTree = Record<string, KnockoutBet | undefined>;

interface UserPayload {
  email: string;
  display_name: string;
  bracket: { group_predictions?: GroupPredictions; knockout_tree?: KnockoutTree; champion?: string | null } | null;
  special: Record<string, string | null> | null;
  advancement: { group_qualifiers?: Record<string, string[]>; advance_to_qf?: string[]; advance_to_sf?: string[]; advance_to_final?: string[]; winner?: string | null } | null;
}

function buildGroupsCSV(users: UserPayload[]): string {
  // Header: email, display_name, then for every group letter L and every match
  // 1..6 inside that group: L<n>_home_team, L<n>_away_team, L<n>_predicted_home,
  // L<n>_predicted_away. The team columns are constant per row — this is by
  // design so the file is fully self-explanatory if Excel is the only tool
  // available during a disaster recovery.
  const headers: string[] = ["email", "display_name"];
  for (const letter of GROUP_LETTERS) {
    const codes = (GROUPS[letter] || []).map(t => t.code);
    const matchups = generateMatchups(codes);
    matchups.forEach((mu, i) => {
      const n = i + 1;
      headers.push(`${letter}${n}_home`, `${letter}${n}_away`, `${letter}${n}_pred_h`, `${letter}${n}_pred_a`);
    });
  }
  const lines: string[] = [headers.join(",")];
  for (const u of users) {
    const cells: unknown[] = [u.email, u.display_name];
    const gp = u.bracket?.group_predictions ?? {};
    for (const letter of GROUP_LETTERS) {
      const codes = (GROUPS[letter] || []).map(t => t.code);
      const matchups = generateMatchups(codes);
      const userScores = gp[letter]?.scores ?? [];
      matchups.forEach((mu, i) => {
        const s = userScores[i] ?? { home: null, away: null };
        cells.push(mu.h, mu.a, s.home ?? "", s.away ?? "");
      });
    }
    lines.push(csvRow(cells));
  }
  return lines.join("\n");
}

function buildKnockoutCSV(users: UserPayload[]): string {
  const headers = ["email", "display_name"];
  for (const k of ALL_KO_KEYS) {
    headers.push(`${k}_winner`, `${k}_home_score`, `${k}_away_score`);
  }
  const lines: string[] = [headers.join(",")];
  for (const u of users) {
    const cells: unknown[] = [u.email, u.display_name];
    const ko = u.bracket?.knockout_tree ?? {};
    for (const k of ALL_KO_KEYS) {
      const m = ko[k] ?? {};
      cells.push(m.winner ?? "", m.score1 ?? "", m.score2 ?? "");
    }
    lines.push(csvRow(cells));
  }
  return lines.join("\n");
}

function buildSpecialCSV(users: UserPayload[]): string {
  const cols = [
    "top_scorer_player",
    "top_assists_player",
    "best_attack_team",
    "most_prolific_group",
    "driest_group",
    "dirtiest_team",
    "matchup_1",
    "matchup_2",
    "matchup_3",
    "penalties_over_under",
  ];
  const lines: string[] = [["email", "display_name", ...cols].join(",")];
  for (const u of users) {
    const sb = u.special ?? {};
    const matchups = (typeof sb.matchup_pick === "string" ? sb.matchup_pick : "").split(",");
    const row: unknown[] = [
      u.email,
      u.display_name,
      sb.top_scorer_player ?? "",
      sb.top_assists_player ?? "",
      sb.best_attack_team ?? "",
      sb.most_prolific_group ?? "",
      sb.driest_group ?? "",
      sb.dirtiest_team ?? "",
      matchups[0] ?? "",
      matchups[1] ?? "",
      matchups[2] ?? "",
      sb.penalties_over_under ?? "",
    ];
    lines.push(csvRow(row));
  }
  return lines.join("\n");
}

function buildAdvancementCSV(users: UserPayload[]): string {
  // Group qualifiers: 12 groups × 2 qualifiers + champion + advance lists
  const headers: string[] = ["email", "display_name"];
  for (const letter of GROUP_LETTERS) {
    headers.push(`${letter}_q1`, `${letter}_q2`);
  }
  headers.push(
    "advance_to_qf", "advance_to_sf", "advance_to_final", "winner",
  );
  const lines: string[] = [headers.join(",")];
  for (const u of users) {
    const adv = u.advancement ?? {};
    const cells: unknown[] = [u.email, u.display_name];
    const gq = adv.group_qualifiers ?? {};
    for (const letter of GROUP_LETTERS) {
      const arr = gq[letter] ?? [];
      cells.push(arr[0] ?? "", arr[1] ?? "");
    }
    cells.push(
      (adv.advance_to_qf ?? []).join(" | "),
      (adv.advance_to_sf ?? []).join(" | "),
      (adv.advance_to_final ?? []).join(" | "),
      adv.winner ?? u.bracket?.champion ?? "",
    );
    lines.push(csvRow(cells));
  }
  return lines.join("\n");
}

export async function GET(request: Request) {
  const adminEmail = await verifyAdmin();
  if (!adminEmail) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  if (!isLocked()) {
    return NextResponse.json(
      { error: `Bets not locked yet. Export will open after ${formatLockDeadline()}.` },
      { status: 403 },
    );
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Missing config" }, { status: 500 });

  const supabase = createClient(url, serviceKey);

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

  const users: UserPayload[] = (profiles || []).map(p => ({
    email: emailMap[p.id] || "",
    display_name: p.display_name || "ללא שם",
    bracket: brackets?.find(b => b.user_id === p.id) ?? null,
    special: specials?.find(s => s.user_id === p.id) ?? null,
    advancement: advancements?.find(a => a.user_id === p.id) ?? null,
  })).sort((a, b) => a.display_name.localeCompare(b.display_name, "he"));

  const reqUrl = new URL(request.url);
  const type = (reqUrl.searchParams.get("type") || "").toLowerCase();
  const date = new Date().toISOString().split("T")[0];

  let csvBody: string;
  let filename: string;
  if (type === "groups") { csvBody = buildGroupsCSV(users); filename = `wc2026-groups-${date}.csv`; }
  else if (type === "knockout") { csvBody = buildKnockoutCSV(users); filename = `wc2026-knockout-${date}.csv`; }
  else if (type === "special") { csvBody = buildSpecialCSV(users); filename = `wc2026-special-${date}.csv`; }
  else if (type === "advancement") { csvBody = buildAdvancementCSV(users); filename = `wc2026-advancement-${date}.csv`; }
  else if (type === "all") {
    csvBody = [
      "## GROUPS",
      buildGroupsCSV(users),
      "",
      "## KNOCKOUT",
      buildKnockoutCSV(users),
      "",
      "## SPECIAL",
      buildSpecialCSV(users),
      "",
      "## ADVANCEMENT",
      buildAdvancementCSV(users),
    ].join("\n");
    filename = `wc2026-all-bets-${date}.csv`;
  } else {
    // Legacy long-form fallback for backwards compatibility
    const legacy: string[] = ["user_name,email,category,item,value"];
    for (const u of users) {
      const name = u.display_name.replace(/,/g, " ");
      // groups
      const gp = u.bracket?.group_predictions ?? {};
      for (const letter of GROUP_LETTERS) {
        const arr = gp[letter]?.scores ?? [];
        arr.forEach((s, i) => {
          if (s.home !== null && s.away !== null) {
            legacy.push(`${name},${u.email},groups,group_${letter}_match_${i + 1},${s.home}-${s.away}`);
          }
        });
      }
      const ko = u.bracket?.knockout_tree ?? {};
      for (const [k, m] of Object.entries(ko)) {
        if (m?.winner) {
          const sc = (m.score1 != null && m.score2 != null) ? ` (${m.score1}-${m.score2})` : "";
          legacy.push(`${name},${u.email},knockout,${k},${m.winner}${sc}`);
        }
      }
      const sb = u.special ?? {};
      for (const [k, v] of Object.entries(sb)) {
        if (v) legacy.push(`${name},${u.email},special,${k},${v}`);
      }
      const adv = u.advancement ?? {};
      const gq = (adv.group_qualifiers ?? {}) as Record<string, string[]>;
      for (const [letter, teams] of Object.entries(gq)) {
        if (teams?.length) legacy.push(`${name},${u.email},advancement,group_${letter}_qualifiers,${teams.join(" > ")}`);
      }
      if (adv.winner) legacy.push(`${name},${u.email},advancement,winner,${adv.winner}`);
    }
    csvBody = legacy.join("\n");
    filename = `wc2026-bets-long-${date}.csv`;
  }

  const csv = "﻿" + csvBody; // BOM for Hebrew in Excel
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
