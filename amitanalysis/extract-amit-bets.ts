// ============================================================================
// amitanalysis — Extract Amit's full bet slip into a verifiable, resolved form.
//
// Pulls Amit's predictions from LIVE Supabase (source of truth) and resolves
// every team code / order-index / knockout slot into real teams + fixtures
// using the project's OWN authoritative libs (the same ones the live scorer
// uses), so the export can't disagree with what the app would score.
//
// Falls back to the newest local backup JSON if the network/RLS is unavailable,
// and cross-checks live-vs-backup so any drift is visible.
//
// Outputs (in this folder):
//   • amit-bets.json      — structured, resolved, machine-readable (for the sim)
//   • amit-bets.txt       — human-readable slip (for eyeballing / verification)
//   • amit-bets.raw.json  — the exact stored rows, untouched (audit trail)
//
//   npx tsx amitanalysis/extract-amit-bets.ts
// ============================================================================
import { readFileSync, writeFileSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

import { GROUPS, GROUP_LETTERS, ALL_TEAMS, getTeamByCode } from "../src/lib/tournament/groups";
import { calculateStandings } from "../src/lib/tournament/standings";
import { deriveUserR32Matchups, type UserGroupState } from "../src/lib/tournament/user-bracket-derivation";
import { resolveGroupSlot, LATER_FEEDERS } from "../src/lib/tournament/knockout-derivation";
import { getSquadPlayers } from "../src/lib/tournament/squad-players";
import { MATCHUPS, parseMatchupPick } from "../src/lib/matchups";
import { SCORING } from "../src/types";
import type { GroupMatchPrediction } from "../src/types";

// Player → squad team code (same map the special-bets UI builds). Lets us
// resolve a picked player's real nation and flag stale scorer/assists team tags.
const PLAYER_TO_TEAM: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const t of ALL_TEAMS) for (const p of getSquadPlayers(t.code)) if (p && !(p in map)) map[p] = t.code;
  return map;
})();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT = __dirname;
const PLAYER_NAME = "עמית";

// ---- env ----
const env: Record<string, string> = {};
for (const l of readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
}

// ---- knockout slot → stage + display order ----
const KO_ORDER = [
  "r32l_0", "r32l_1", "r32l_2", "r32l_3", "r32l_4", "r32l_5", "r32l_6", "r32l_7",
  "r32r_0", "r32r_1", "r32r_2", "r32r_3", "r32r_4", "r32r_5", "r32r_6", "r32r_7",
  "r16l_0", "r16l_1", "r16l_2", "r16l_3", "r16r_0", "r16r_1", "r16r_2", "r16r_3",
  "qfl_0", "qfl_1", "qfr_0", "qfr_1", "sfl_0", "sfr_0", "final",
];
function koStage(key: string): "R32" | "R16" | "QF" | "SF" | "FINAL" {
  if (key.startsWith("r32")) return "R32";
  if (key.startsWith("r16")) return "R16";
  if (key.startsWith("qf")) return "QF";
  if (key.startsWith("sf")) return "SF";
  return "FINAL";
}
const STAGE_HE: Record<string, string> = {
  R32: "שלב 32", R16: "שמינית גמר", QF: "רבע גמר", SF: "חצי גמר", FINAL: "גמר",
};

// 6 within-group fixtures, in the canonical scores[] order (generateMatchups).
function groupFixtures(codes: string[]): { h: string; a: string }[] {
  const [a, b, c, d] = codes;
  return [
    { h: a, a: b }, { h: c, a: d }, { h: a, a: c },
    { h: d, a: b }, { h: d, a: a }, { h: b, a: c },
  ];
}

type TeamRef = { code: string; name: string; name_he: string; fifa_ranking: number | null };
function tc(code: string | null | undefined): TeamRef | null {
  if (!code) return null;
  const t = getTeamByCode(code);
  if (!t) return { code, name: code, name_he: code, fifa_ranking: null };
  return { code: t.code, name: t.name, name_he: t.name_he, fifa_ranking: t.fifa_ranking ?? null };
}
function label(ref: TeamRef | null): string {
  if (!ref) return "—";
  return `${ref.name_he} / ${ref.name} (${ref.code})`;
}
function toto(home: number | null, away: number | null): "1" | "X" | "2" | null {
  if (home == null || away == null) return null;
  return home > away ? "1" : home < away ? "2" : "X";
}

// ---- stored-row shapes ----
type StoredBracket = {
  group_predictions: Record<string, UserGroupState>;
  knockout_tree: Record<string, { score1: number | null; score2: number | null; winner: string | null }>;
  third_place_qualifiers: string[] | null;
  champion: string | null;
};
type StoredSpecial = Record<string, string | null>;
type StoredAdvancement = {
  group_qualifiers: Record<string, string[]>;
  advance_to_r16?: string[];
  advance_to_qf: string[];
  advance_to_sf: string[];
  advance_to_final: string[];
  winner: string;
};

type Rows = {
  source: string;
  userId: string;
  leagueId: string | null;
  bracket: StoredBracket;
  special: StoredSpecial;
  advancement: StoredAdvancement;
};

// ---- load from LIVE supabase ----
async function loadLive(): Promise<Rows | null> {
  try {
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { data: profs, error: pe } = await sb.from("profiles").select("id, display_name");
    if (pe || !profs) return null;
    const me = profs.find((p: { display_name: string }) => p.display_name === PLAYER_NAME);
    if (!me) return null;
    const uid = me.id;
    const [{ data: br }, { data: sp }, { data: ad }] = await Promise.all([
      sb.from("user_brackets").select("*").eq("user_id", uid).maybeSingle(),
      sb.from("special_bets").select("*").eq("user_id", uid).maybeSingle(),
      sb.from("advancement_picks").select("*").eq("user_id", uid).maybeSingle(),
    ]);
    if (!br || !sp || !ad) return null;
    return {
      source: "live:" + url,
      userId: uid,
      leagueId: br.league_id ?? null,
      bracket: br as StoredBracket,
      special: sp as StoredSpecial,
      advancement: ad as StoredAdvancement,
    };
  } catch (e) {
    console.warn("⚠ live load failed:", (e as Error).message);
    return null;
  }
}

// ---- load from newest local backup JSON ----
function loadBackup(): Rows {
  const dir = path.join(ROOT, "local-backups");
  const files = readdirSync(dir).filter((f) => /^wc2026-bets-raw-.*\.json$/.test(f)).sort();
  const file = files[files.length - 1];
  const d = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  const prof = d.tables.profiles.find((p: { display_name: string }) => p.display_name === PLAYER_NAME);
  const uid = prof.id;
  const find = (t: string) => d.tables[t].find((r: { user_id: string }) => r.user_id === uid);
  const br = find("user_brackets");
  return {
    source: "backup:" + file,
    userId: uid,
    leagueId: br.league_id ?? null,
    bracket: br as StoredBracket,
    special: find("special_bets") as StoredSpecial,
    advancement: find("advancement_picks") as StoredAdvancement,
  };
}

// ---- build the resolved view ----
function build(rows: Rows) {
  const groupsState = rows.bracket.group_predictions;

  // Per-group resolution: predicted table (from his order), all 6 fixtures.
  const groups: Record<string, unknown> = {};
  for (const L of GROUP_LETTERS) {
    const teams = GROUPS[L];
    const g = groupsState[L];
    const codes = teams.map((t) => t.code);
    const order = g?.order ?? [0, 1, 2, 3];

    const fixtures = groupFixtures(codes).map((m, i) => {
      const s = g?.scores?.[i] ?? { home: null, away: null };
      return {
        matchNo: i + 1,
        home: tc(m.h),
        away: tc(m.a),
        homeGoals: s.home,
        awayGoals: s.away,
        toto: toto(s.home, s.away),
      };
    });

    // his chosen finishing order, resolved
    const predictedTable = order.map((idx, pos) => ({
      rank: pos + 1,
      ...tc(codes[idx])!,
    }));

    // computed standings from his scores (sanity cross-check vs his order)
    const preds: GroupMatchPrediction[] = groupFixtures(codes).map((m, i) => ({
      match_id: i,
      home_team_code: m.h,
      away_team_code: m.a,
      home_goals: g?.scores?.[i]?.home ?? 0,
      away_goals: g?.scores?.[i]?.away ?? 0,
    }));
    const computed = calculateStandings(teams.map((t) => ({ id: t.id, code: t.code })), preds)
      .map((r, i) => ({ rank: i + 1, code: r.team_code, points: r.points, gf: r.goals_for, gd: r.goal_difference }));

    groups[L] = {
      teams: teams.map((t) => tc(t.code)),
      predictedOrder: predictedTable,        // authoritative (drives KO slots)
      qualifiers: { first: tc(codes[order[0]]), second: tc(codes[order[1]]) },
      thirdPlace: tc(codes[order[2]]),
      computedStandings: computed,            // cross-check from raw scores
      fixtures,
    };
  }

  // Resolve the knockout bracket using HIS derived R32 matchups (his thirds).
  const der = deriveUserR32Matchups(groupsState);
  const ko = rows.bracket.knockout_tree ?? {};
  const knockout: Record<string, unknown> = {};
  for (const key of KO_ORDER) {
    let t1: string | null = null;
    let t2: string | null = null;
    if (key in der.matchups) {
      t1 = resolveGroupSlot(der.matchups[key].h, groupsState);
      t2 = resolveGroupSlot(der.matchups[key].a, groupsState);
    } else if (key in LATER_FEEDERS) {
      const [f1, f2] = LATER_FEEDERS[key];
      t1 = ko[f1]?.winner ?? null;
      t2 = ko[f2]?.winner ?? null;
    }
    const node = ko[key] ?? { score1: null, score2: null, winner: null };
    knockout[key] = {
      stage: koStage(key),
      slot: key,
      team1: tc(t1),
      team2: tc(t2),
      winner: tc(node.winner),
      score1: node.score1,
      score2: node.score2,
      slotNotation: der.matchups[key] ?? (LATER_FEEDERS[key] ? { from: LATER_FEEDERS[key] } : null),
    };
  }

  // Special bets, resolved + labeled.
  const sp = rows.special;
  const duelPicks = parseMatchupPick(sp.matchup_pick);
  const matchups = MATCHUPS.map((m, i) => {
    const pick = duelPicks[i] || "";
    const picked = pick === "1" ? m.name1 : pick === "2" ? m.name2 : pick === "X" ? "תיקו" : null;
    return { duel: `${m.name1} vs ${m.name2}`, pick, pickedLabel: picked };
  });

  const ad = rows.advancement;
  // NOTE: top_scorer_team / top_assists_team are UI *filters* used to narrow the
  // player list — the live scorer scores by PLAYER NAME only, never the team tag.
  const scorerPlayer = sp.top_scorer_player ?? null;
  const assistsPlayer = sp.top_assists_player ?? null;
  const special = {
    topScorerPlayer: scorerPlayer,
    topScorerTeamTag: tc(sp.top_scorer_team ?? null),       // stored, NOT scored
    topScorerPlayerNation: tc(scorerPlayer ? PLAYER_TO_TEAM[scorerPlayer] ?? null : null),
    topAssistsPlayer: assistsPlayer,
    topAssistsTeamTag: tc(sp.top_assists_team ?? null),     // stored, NOT scored
    topAssistsPlayerNation: tc(assistsPlayer ? PLAYER_TO_TEAM[assistsPlayer] ?? null : null),
    bestAttackTeam: tc(sp.best_attack_team ?? null),
    mostProlificGroup: sp.most_prolific_group ?? null,
    driestGroup: sp.driest_group ?? null,
    dirtiestTeam: tc(sp.dirtiest_team ?? null),
    penaltiesOverUnder: sp.penalties_over_under ?? null,
    matchups,
  };

  // ---- data-quality notes (faithful extraction surfaces inconsistencies) ----
  const notes: string[] = [];
  const scorerNation = scorerPlayer ? PLAYER_TO_TEAM[scorerPlayer] ?? null : null;
  if (scorerPlayer && sp.top_scorer_team && scorerNation && sp.top_scorer_team !== scorerNation) {
    notes.push(
      `top_scorer_team="${sp.top_scorer_team}" does not match the picked player's nation ` +
      `(${scorerPlayer} → ${scorerNation}). The team tag is a UI filter and is NOT scored; ` +
      `only the player (${scorerPlayer}) is scored. Looks like a stale leftover.`
    );
  }
  const assistsNation = assistsPlayer ? PLAYER_TO_TEAM[assistsPlayer] ?? null : null;
  if (assistsPlayer && sp.top_assists_team && assistsNation && sp.top_assists_team !== assistsNation) {
    notes.push(
      `top_assists_team="${sp.top_assists_team}" does not match ${assistsPlayer} → ${assistsNation}. ` +
      `Team tag is not scored (UI filter only).`
    );
  }
  const tpq = rows.bracket.third_place_qualifiers;
  if (Array.isArray(tpq) && tpq.some((x) => typeof x === "string" && x.length <= 1)) {
    notes.push(
      `third_place_qualifiers is stored as single letters ${JSON.stringify(tpq)} (legacy format). ` +
      `This column is NOT read by the live scorer — 3rd places are derived from the predicted ` +
      `standings via Annex C. Shown here only for completeness.`
    );
  }

  const advancement = {
    groupQualifiers: Object.fromEntries(
      Object.entries(ad.group_qualifiers || {}).map(([L, arr]) => [L, (arr || []).map((c) => tc(c))])
    ),
    advanceToR16: (ad.advance_to_r16 || []).map((c) => tc(c)),
    advanceToQF: (ad.advance_to_qf || []).map((c) => tc(c)),
    advanceToSF: (ad.advance_to_sf || []).map((c) => tc(c)),
    advanceToFinal: (ad.advance_to_final || []).map((c) => tc(c)),
    winner: tc(ad.winner),
  };

  return {
    groups,
    knockout,
    special,
    advancement,
    champion: tc(rows.bracket.champion),
    thirdsResolved: der.thirdsReady,
    thirdsOfficial: der.isOfficial,
    qualifiedThirdGroups: der.qualifiedGroups,
    notes,
  };
}

// ---- text rendering ----
function renderText(rows: Rows, R: ReturnType<typeof build>): string {
  const out: string[] = [];
  const P = (s = "") => out.push(s);
  P("=".repeat(78));
  P(`  הימורים של ${PLAYER_NAME} — מונדיאל 2026 (גרסה מפוענחת ומלאה)`);
  P("=".repeat(78));
  P(`מקור נתונים: ${rows.source}`);
  P(`user_id: ${rows.userId}    league_id: ${rows.leagueId ?? "—"}`);
  P(`thirds resolved: ${R.thirdsResolved}  (official Annex C: ${R.thirdsOfficial})`);
  P("");

  // GROUPS
  P("█".repeat(78));
  P("  שלב הבתים — דירוג חזוי + כל 6 המשחקים בכל בית");
  P("█".repeat(78));
  for (const L of GROUP_LETTERS) {
    const g = R.groups[L] as any;
    P("");
    P(`── בית ${L} ─────────────────────────────────────────────────────────────`);
    P("  דירוג חזוי (לפי הסדר שעמית קבע):");
    for (const row of g.predictedOrder) {
      const tag = row.rank === 1 ? "🥇 עולה" : row.rank === 2 ? "🥈 עולה" : row.rank === 3 ? "🥉 שלישית" : "  ";
      P(`    ${row.rank}. ${row.name_he} / ${row.name} (${row.code})   ${tag}`);
    }
    P("  משחקים (התוצאה שעמית ניבא):");
    for (const f of g.fixtures) {
      const sc = f.homeGoals == null || f.awayGoals == null ? "— : —" : `${f.homeGoals} : ${f.awayGoals}`;
      const t = f.toto ? `[${f.toto}]` : "[--]";
      P(`    ${f.matchNo}. ${f.home.name_he} ${sc} ${f.away.name_he}   ${t}`);
    }
  }

  // KNOCKOUT
  P("");
  P("█".repeat(78));
  P("  עץ הנוקאאוט (לפי תחזיות עמית — היריבות נגזרות מהדירוג שלו)");
  P("█".repeat(78));
  let lastStage = "";
  for (const key of KO_ORDER) {
    const m = (R.knockout as any)[key];
    if (m.stage !== lastStage) {
      P("");
      P(`── ${STAGE_HE[m.stage]} (${m.stage}) ──────────────────────────────────────`);
      lastStage = m.stage;
    }
    const t1 = m.team1 ? m.team1.name_he : "?";
    const t2 = m.team2 ? m.team2.name_he : "?";
    const sc = m.score1 == null || m.score2 == null ? "" : `  (${m.score1}:${m.score2})`;
    const w = m.winner ? `→ ${m.winner.name_he}` : "→ (לא נבחר)";
    P(`    ${t1}  vs  ${t2}   ${w}${sc}`);
  }

  // ADVANCEMENT
  const ad = R.advancement;
  P("");
  P("█".repeat(78));
  P("  הימורי העפלה (advancement) — נקודות לפי כל קבוצה שמגיעה לשלב");
  P("█".repeat(78));
  P("  מעפילות מהבית (1 ו-2 בכל בית):");
  for (const L of GROUP_LETTERS) {
    const q = (ad.groupQualifiers as any)[L] || [];
    P(`    ${L}: ${q.map((x: TeamRef) => x.name_he).join(", ")}`);
  }
  const list = (arr: (TeamRef | null)[]) => arr.map((x) => x?.name_he ?? "?").join(", ");
  P(`  עולות לשמינית (R16, 16): ${list(ad.advanceToR16)}`);
  P(`  עולות לרבע (QF, 8):       ${list(ad.advanceToQF)}`);
  P(`  עולות לחצי (SF, 4):       ${list(ad.advanceToSF)}`);
  P(`  עולות לגמר (2):           ${list(ad.advanceToFinal)}`);
  P(`  אלופה:                    ${ad.winner?.name_he ?? "?"} (${ad.winner?.code ?? "?"})`);

  // SPECIALS
  const s = R.special;
  P("");
  P("█".repeat(78));
  P("  הימורים מיוחדים (specials)");
  P("█".repeat(78));
  P(`  מלך שערים:        ${s.topScorerPlayer ?? "—"} (${s.topScorerPlayerNation?.name_he ?? "?"})   [exact ${SCORING.specials.top_scorer_exact} / relative ${SCORING.specials.top_scorer_relative}]`);
  P(`     • תגית נבחרת שמורה (לא נספרת): ${s.topScorerTeamTag?.code ?? "—"}`);
  P(`  מלך בישולים:      ${s.topAssistsPlayer ?? "—"} (${s.topAssistsPlayerNation?.name_he ?? "?"})   [exact ${SCORING.specials.top_assists_exact} / relative ${SCORING.specials.top_assists_relative}]`);
  P(`     • תגית נבחרת שמורה (לא נספרת): ${s.topAssistsTeamTag?.code ?? "—"}`);
  P(`  התקפה הכי טובה:   ${label(s.bestAttackTeam)}   [${SCORING.specials.best_attack}]`);
  P(`  בית הכי פורה:     ${s.mostProlificGroup ?? "—"}   [${SCORING.specials.prolific_group}]`);
  P(`  בית הכי יבש:      ${s.driestGroup ?? "—"}   [${SCORING.specials.driest_group}]`);
  P(`  קבוצה מלוכלכת:    ${label(s.dirtiestTeam)}   [${SCORING.specials.dirtiest_team}]`);
  P(`  פנדלים O/U:       ${s.penaltiesOverUnder ?? "—"}   [${SCORING.specials.penalties_over_under}]`);
  P(`  דו-קרבות שחקנים (${SCORING.specials.matchup} לכל אחד):`);
  for (const m of s.matchups) {
    P(`     • ${m.duel}  →  ${m.pickedLabel ?? "(לא נבחר)"}`);
  }

  // DATA-QUALITY NOTES
  if (R.notes.length) {
    P("");
    P("█".repeat(78));
    P("  הערות איכות-נתונים (לאימות — לא משפיע בהכרח על הניקוד)");
    P("█".repeat(78));
    for (const n of R.notes) P(`  ⚠ ${n}`);
  }
  P("");
  P("=".repeat(78));
  return out.join("\n");
}

// ---- main ----
(async () => {
  const live = await loadLive();
  const backup = loadBackup();
  const rows = live ?? backup;
  console.log(`✓ using ${rows.source}`);

  // cross-check live vs backup — compare only real PICK fields, and only those
  // the backup actually captured (it stores a column subset, so absent ≠ drift).
  if (live) {
    const drift: string[] = [];
    if (live.bracket.champion !== backup.bracket.champion)
      drift.push(`champion: live=${live.bracket.champion} backup=${backup.bracket.champion}`);
    if (live.advancement.winner !== backup.advancement.winner)
      drift.push(`winner: live=${live.advancement.winner} backup=${backup.advancement.winner}`);
    const PICK_FIELDS = [
      "top_scorer_player", "top_scorer_team", "top_assists_player", "top_assists_team",
      "best_attack_team", "most_prolific_group", "driest_group", "dirtiest_team",
      "matchup_pick", "penalties_over_under",
    ];
    for (const f of PICK_FIELDS) {
      if (!(f in backup.special)) continue; // backup didn't capture this column
      if (live.special[f] !== backup.special[f])
        drift.push(`special.${f}: live=${live.special[f]} backup=${backup.special[f]}`);
    }
    if (JSON.stringify(live.bracket.group_predictions) !== JSON.stringify(backup.bracket.group_predictions))
      drift.push("group_predictions differ");
    if (JSON.stringify(live.bracket.knockout_tree) !== JSON.stringify(backup.bracket.knockout_tree))
      drift.push("knockout_tree differs");
    if (drift.length) console.log("⚠ live vs backup drift (real picks):\n  " + drift.join("\n  "));
    else console.log("✓ live picks identical to today's backup (no drift)");
  } else {
    console.log("ℹ live unavailable — used local backup");
  }

  const resolved = build(rows);

  const json = {
    meta: {
      player: PLAYER_NAME,
      userId: rows.userId,
      leagueId: rows.leagueId,
      source: rows.source,
      lockDeadline: "2026-06-10T14:00:00Z (17:00 Israel)",
      scoring: SCORING,
    },
    ...resolved,
  };

  writeFileSync(path.join(OUT, "amit-bets.json"), JSON.stringify(json, null, 2), "utf8");
  writeFileSync(path.join(OUT, "amit-bets.raw.json"), JSON.stringify({
    source: rows.source, userId: rows.userId, leagueId: rows.leagueId,
    user_brackets: rows.bracket, special_bets: rows.special, advancement_picks: rows.advancement,
  }, null, 2), "utf8");
  writeFileSync(path.join(OUT, "amit-bets.txt"), renderText(rows, resolved), "utf8");

  console.log(`✓ wrote amit-bets.json, amit-bets.raw.json, amit-bets.txt to ${OUT}`);
})();
