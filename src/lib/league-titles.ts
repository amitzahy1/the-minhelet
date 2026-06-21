// ============================================================================
// WC2026 — League title badges ("תארים")
//
// Pure computation: who currently holds each fun title. Display lives in
// src/components/shared/LeagueTitles.tsx; /titles-preview feeds this the same
// kind of mock data a test would, so the logic shown there IS the prod logic.
//
// AWARD RULES (set by the league owner, 2026-06-10):
//   - A title needs ONE clear holder — any tie for the top spot = no award
//     ("אל תיתן לאף אחד אם יש תיקו, רק אם מישהו בולט מעל כולם").
//   - Counting titles also need a minimum before they activate (e.g. הצלף
//     needs ≥3 exact hits) so nobody holds a title off one lucky guess.
//     Thresholds live in DEFAULT_TITLE_THRESHOLDS — tweak them there.
//
// Data notes:
//   - Reveal titles (consensus, lone wolf, kissers, disconnected, prophet)
//     read only NEVER-REDACTED bracket fields (champion, group order,
//     Tree-1 knockout winners) — safe to show from the global lock.
//   - Counting titles (sniper, almost, hater, draws, qualifiers, runner-up)
//     read predictions of FINISHED matches only. A finished match's day has
//     locked for everyone, so the redacted payload is symmetric across users
//     — nobody gets counted on picks others can't see yet.
// ============================================================================

import type { BettorBracket, BettorSpecialBets } from "@/lib/supabase/shared-data";
import { computeGroupHits, normalizeTla, type FinishedMatch } from "@/lib/results-hits";
import { calculateStandings } from "@/lib/tournament/standings";
import { GROUPS } from "@/lib/tournament/groups";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import type { GroupMatchPrediction } from "@/types";

export interface TitleAward {
  key: string;
  emoji: string;
  title: string;
  /** Display name(s) of the holder; null → no one qualifies (yet). */
  holder: string | null;
  /** One-liner under the holder (or why nobody holds it). */
  detail: string;
  kind: "reveal" | "performance";
}

export interface TitleThresholds {
  /** הצלף — minimum exact hits. */
  sniper: number;
  /** מלך הכמעט — minimum off-by-one misses. */
  almost: number;
  /** מלך העולות — minimum correct qualifiers (from fully-finished groups). */
  qualifiers: number;
  /** ההייטר — minimum 0-0 predictions among finished matches. */
  hater: number;
  /** מלך התיקו — minimum predicted draws among finished matches. */
  draws: number;
  /** נביא הבתים — minimum group winners nobody else picked. */
  prophet: number;
}

export const DEFAULT_TITLE_THRESHOLDS: TitleThresholds = {
  sniper: 3,
  almost: 3,
  qualifiers: 5,
  hater: 3,
  draws: 4,
  prophet: 2,
};

/** The single entry whose count strictly beats every other AND meets `min` — else null. */
function strictTop(
  counts: Map<string, number>,
  min: number,
): { id: string; count: number } | null {
  let best: { id: string; count: number } | null = null;
  let tied = false;
  for (const [id, count] of counts) {
    if (!best || count > best.count) {
      best = { id, count };
      tied = false;
    } else if (count === best.count) {
      tied = true;
    }
  }
  if (!best || tied || best.count < min) return null;
  return best;
}

/** Same, for the LOWEST value (המנותק). */
function strictBottom(values: Map<string, number>): { id: string; value: number } | null {
  let worst: { id: string; value: number } | null = null;
  let tied = false;
  for (const [id, value] of values) {
    if (!worst || value < worst.value) {
      worst = { id, value };
      tied = false;
    } else if (value === worst.value) {
      tied = true;
    }
  }
  if (!worst || tied) return null;
  return worst;
}

const nameOf = (b: BettorBracket) => b.displayName || "ללא שם";
const flagTeam = (code: string) => `${getFlag(code)} ${getTeamNameHe(code) || code}`;

/**
 * Pick-agreement between two bettors over never-redacted fields: group order
 * positions, Tree-1 knockout winners, champion. Returns null when there's too
 * little overlap to call it a percentage.
 * Exported for the compare-page agreement matrix (same metric as the
 * מתנשקים/המנותק titles, so the heatmap and the titles can't disagree).
 */
export function agreementPct(a: BettorBracket, b: BettorBracket): number | null {
  let same = 0;
  let total = 0;
  for (const letter of Object.keys(GROUPS)) {
    const oa = a.groupPredictions?.[letter]?.order;
    const ob = b.groupPredictions?.[letter]?.order;
    if (!Array.isArray(oa) || !Array.isArray(ob)) continue;
    for (let i = 0; i < 4; i++) {
      if (oa[i] === undefined || ob[i] === undefined) continue;
      total++;
      if (oa[i] === ob[i]) same++;
    }
  }
  const ta = a.knockoutTree || {};
  const tb = b.knockoutTree || {};
  for (const key of Object.keys(ta)) {
    const wa = ta[key]?.winner;
    const wb = tb[key]?.winner;
    if (!wa || !wb) continue;
    total++;
    if (wa === wb) same++;
  }
  if (a.champion && b.champion) {
    total++;
    if (a.champion === b.champion) same++;
  }
  if (total < 20) return null; // not enough shared picks to mean anything
  return (same / total) * 100;
}

/**
 * Score-prediction agreement: % of comparable group fixtures where both bettors
 * guessed the EXACT same scoreline. Only pairs where BOTH have a non-null score
 * count — which naturally scopes this to matches whose day has unlocked
 * (future-match scores arrive redacted as {home:null, away:null} from
 * /api/shared-bets, the same set of pairs for everyone, so it stays symmetric).
 * Both brackets key scores.[i] by the same GROUP_MATCH_PAIRS index, so a direct
 * index-to-index compare is the same fixture for both.
 * Exported for the compare-page "ניחושי תוצאות" matrix.
 */
export function scoreAgreementPct(a: BettorBracket, b: BettorBracket): number | null {
  let same = 0;
  let total = 0;
  for (const letter of Object.keys(GROUPS)) {
    const sa = a.groupPredictions?.[letter]?.scores;
    const sb = b.groupPredictions?.[letter]?.scores;
    if (!Array.isArray(sa) || !Array.isArray(sb)) continue;
    const n = Math.min(sa.length, sb.length);
    for (let i = 0; i < n; i++) {
      const pa = sa[i];
      const pb = sb[i];
      if (!pa || !pb) continue;
      if (pa.home === null || pa.away === null || pb.home === null || pb.away === null) continue;
      total++;
      if (pa.home === pb.home && pa.away === pb.away) same++;
    }
  }
  if (total < 8) return null; // too few shared revealed scores to mean anything
  return (same / total) * 100;
}

const SPECIAL_BET_FIELDS: (keyof BettorSpecialBets)[] = [
  "topScorerPlayer",
  "topAssistsPlayer",
  "bestAttackTeam",
  "dirtiestTeam",
  "prolificGroup",
  "driestGroup",
  "matchupPick",
  "penaltiesOverUnder",
];

/**
 * TOTAL pick-agreement across EVERY bet category: group order + group scores
 * (exact) + Tree-1 knockout winners + champion + special bets. A superset of
 * agreementPct (which the titles still use) — the compare-page "סה״כ" matrix
 * reads this. As with the scores metric, only items both bettors actually filled
 * count, so redacted future-match scores drop out symmetrically.
 */
export function totalAgreementPct(
  a: BettorBracket,
  b: BettorBracket,
  sbA?: BettorSpecialBets | null,
  sbB?: BettorSpecialBets | null,
): number | null {
  let same = 0;
  let total = 0;
  for (const letter of Object.keys(GROUPS)) {
    // group order
    const oa = a.groupPredictions?.[letter]?.order;
    const ob = b.groupPredictions?.[letter]?.order;
    if (Array.isArray(oa) && Array.isArray(ob)) {
      for (let i = 0; i < 4; i++) {
        if (oa[i] === undefined || ob[i] === undefined) continue;
        total++;
        if (oa[i] === ob[i]) same++;
      }
    }
    // group scores (exact scoreline)
    const sa = a.groupPredictions?.[letter]?.scores;
    const sb = b.groupPredictions?.[letter]?.scores;
    if (Array.isArray(sa) && Array.isArray(sb)) {
      const n = Math.min(sa.length, sb.length);
      for (let i = 0; i < n; i++) {
        const pa = sa[i];
        const pb = sb[i];
        if (!pa || !pb) continue;
        if (pa.home === null || pa.away === null || pb.home === null || pb.away === null) continue;
        total++;
        if (pa.home === pb.home && pa.away === pb.away) same++;
      }
    }
  }
  // knockout winners
  const ta = a.knockoutTree || {};
  const tb = b.knockoutTree || {};
  for (const key of Object.keys(ta)) {
    const wa = ta[key]?.winner;
    const wb = tb[key]?.winner;
    if (!wa || !wb) continue;
    total++;
    if (wa === wb) same++;
  }
  // champion
  if (a.champion && b.champion) {
    total++;
    if (a.champion === b.champion) same++;
  }
  // special bets
  if (sbA && sbB) {
    for (const f of SPECIAL_BET_FIELDS) {
      const va = sbA[f];
      const vb = sbB[f];
      if (!va || !vb) continue;
      total++;
      if (va === vb) same++;
    }
  }
  if (total < 20) return null; // not enough shared picks to mean anything
  return (same / total) * 100;
}

/** Group letters where every one of the 6 fixtures is finished. */
function finishedGroups(matches: FinishedMatch[]): Map<string, FinishedMatch[]> {
  const byGroup = new Map<string, FinishedMatch[]>();
  for (const m of matches) {
    const letter = (m.group || "").toUpperCase();
    if (!GROUPS[letter]) continue;
    if (!byGroup.has(letter)) byGroup.set(letter, []);
    byGroup.get(letter)!.push(m);
  }
  for (const [letter, ms] of byGroup) {
    if (ms.length < 6) byGroup.delete(letter);
  }
  return byGroup;
}

/** Real top-2 of a fully-finished group, FIFA tiebreakers included. */
function realQualifiers(letter: string, ms: FinishedMatch[]): string[] {
  const rows: GroupMatchPrediction[] = ms.map((m) => ({
    match_id: m.id,
    home_team_code: normalizeTla(m.homeTla),
    away_team_code: normalizeTla(m.awayTla),
    home_goals: m.homeGoals,
    away_goals: m.awayGoals,
  }));
  const table = calculateStandings(
    GROUPS[letter].map((t) => ({ id: t.id, code: t.code })),
    rows,
  );
  return table.slice(0, 2).map((e) => e.team_code);
}

/**
 * Compute every league title. Returns ALL titles, awarded or not, in display
 * order — the component renders pending ones greyed out.
 */
export function computeLeagueTitles(
  brackets: BettorBracket[],
  finished: FinishedMatch[],
  thresholds: TitleThresholds = DEFAULT_TITLE_THRESHOLDS,
): TitleAward[] {
  const awards: TitleAward[] = [];
  const bettors = brackets.filter((b) => b.userId);
  const names = new Map(bettors.map((b) => [b.userId, nameOf(b)]));

  // ---------- 🏆 הקונצנזוס — most-picked champion (a team, not a bettor) ----------
  {
    const counts = new Map<string, number>();
    for (const b of bettors) {
      if (b.champion) counts.set(b.champion, (counts.get(b.champion) || 0) + 1);
    }
    const top = strictTop(counts, 2);
    awards.push({
      key: "consensus",
      emoji: "🏆",
      title: "הקונצנזוס",
      kind: "reveal",
      holder: top ? flagTeam(top.id) : null,
      detail: top
        ? `${top.count} מתוך ${bettors.length} הימרו עליה כאלופה`
        : "אין אלופה מוסכמת — תיקו בצמרת",
    });
  }

  // ---------- 🐺 זאב בודד — the ONE bettor whose champion nobody else picked ----------
  {
    const counts = new Map<string, number>();
    for (const b of bettors) {
      if (b.champion) counts.set(b.champion, (counts.get(b.champion) || 0) + 1);
    }
    const wolves = bettors.filter((b) => b.champion && counts.get(b.champion) === 1);
    const wolf = wolves.length === 1 ? wolves[0] : null;
    awards.push({
      key: "lone-wolf",
      emoji: "🐺",
      title: "זאב בודד",
      kind: "reveal",
      holder: wolf ? nameOf(wolf) : null,
      detail: wolf
        ? `היחיד שהימר על ${flagTeam(wolf.champion!)} כאלופה`
        : wolves.length > 1
        ? `${wolves.length} זאבים בודדים — אין תואר`
        : "אין הימור אלופה ייחודי",
    });
  }

  // ---------- 💋 מתנשקים + 🏝️ המנותק — pick-agreement extremes ----------
  {
    let bestPair: { a: BettorBracket; b: BettorBracket; pct: number } | null = null;
    let bestTied = false;
    const sums = new Map<string, { sum: number; n: number }>();
    for (let i = 0; i < bettors.length; i++) {
      for (let j = i + 1; j < bettors.length; j++) {
        const pct = agreementPct(bettors[i], bettors[j]);
        if (pct === null) continue;
        for (const b of [bettors[i], bettors[j]]) {
          const s = sums.get(b.userId) || { sum: 0, n: 0 };
          s.sum += pct;
          s.n += 1;
          sums.set(b.userId, s);
        }
        if (!bestPair || pct > bestPair.pct) {
          bestPair = { a: bettors[i], b: bettors[j], pct };
          bestTied = false;
        } else if (pct === bestPair.pct) {
          bestTied = true;
        }
      }
    }
    awards.push({
      key: "kissers",
      emoji: "💋",
      title: "מתנשקים",
      kind: "reveal",
      holder: bestPair && !bestTied ? `${nameOf(bestPair.a)} + ${nameOf(bestPair.b)}` : null,
      detail:
        bestPair && !bestTied
          ? `${Math.round(bestPair.pct)}% מההימורים שלהם זהים`
          : "אין זוג בולט מספיק",
    });

    const means = new Map<string, number>();
    for (const [uid, s] of sums) if (s.n > 0) means.set(uid, s.sum / s.n);
    const loner = strictBottom(means);
    awards.push({
      key: "disconnected",
      emoji: "🏝️",
      title: "המנותק",
      kind: "reveal",
      holder: loner ? names.get(loner.id) || null : null,
      detail: loner
        ? `רק ${Math.round(loner.value)}% מההימורים שלו תואמים את השאר`
        : "אף אחד לא מנותק מספיק",
    });
  }

  // ---------- 🧠 המבין — didn't bet on France/Spain as champion ----------
  {
    const OBVIOUS = new Set(["FRA", "ESP"]);
    const wise = bettors.filter((b) => b.champion && !OBVIOUS.has(b.champion));
    // The joke needs a contrast: award only when SOME picked the obvious
    // favorites and some didn't.
    const awarded = wise.length > 0 && wise.length < bettors.length;
    awards.push({
      key: "connoisseur",
      emoji: "🧠",
      title: "המבין",
      kind: "reveal",
      holder: awarded ? wise.map(nameOf).join(" · ") : null,
      detail: awarded
        ? "לא הימרו על צרפת או ספרד כאלופה"
        : wise.length === 0
        ? "כולם הימרו על צרפת או ספרד"
        : "אף אחד לא הימר על צרפת או ספרד",
    });
  }

  // ---------- 🔮 נביא הבתים — group winners nobody else picked ----------
  {
    const counts = new Map<string, number>();
    const picksOf = new Map<string, string[]>();
    for (const b of bettors) counts.set(b.userId, 0);
    for (const letter of Object.keys(GROUPS)) {
      const winners = new Map<string, number[]>(); // winner idx → bettor list positions
      bettors.forEach((b, i) => {
        const w = b.groupPredictions?.[letter]?.order?.[0];
        if (w === undefined || w === null) return;
        if (!winners.has(String(w))) winners.set(String(w), []);
        winners.get(String(w))!.push(i);
      });
      for (const [idxStr, holders] of winners) {
        if (holders.length !== 1) continue;
        const b = bettors[holders[0]];
        counts.set(b.userId, (counts.get(b.userId) || 0) + 1);
        const code = GROUPS[letter][Number(idxStr)]?.code;
        if (code) {
          if (!picksOf.has(b.userId)) picksOf.set(b.userId, []);
          picksOf.get(b.userId)!.push(code);
        }
      }
    }
    const top = strictTop(counts, thresholds.prophet);
    const picks = top ? (picksOf.get(top.id) || []).slice(0, 3) : [];
    awards.push({
      key: "prophet",
      emoji: "🔮",
      title: "נביא הבתים",
      kind: "reveal",
      holder: top ? names.get(top.id) || null : null,
      detail: top
        ? `היחיד שהימר על ${picks.map((c) => getFlag(c)).join(" ")} כמנצחות בית`
        : `דרושות ≥${thresholds.prophet} מנצחות בתים שאף אחד אחר לא בחר`,
    });
  }

  // ---------- Counting titles over FINISHED matches ----------
  const exactCounts = new Map<string, number>();
  const almostCounts = new Map<string, number>();
  const nilNilCounts = new Map<string, number>();
  const drawCounts = new Map<string, number>();
  for (const b of bettors) {
    exactCounts.set(b.userId, 0);
    almostCounts.set(b.userId, 0);
    nilNilCounts.set(b.userId, 0);
    drawCounts.set(b.userId, 0);
  }
  const groupFinished = finished.filter(
    (m) => (m.stage || "").toUpperCase().includes("GROUP") && GROUPS[(m.group || "").toUpperCase()],
  );
  for (const m of groupFinished) {
    for (const h of computeGroupHits(m, bettors)) {
      if (h.pred.home === null || h.pred.away === null) continue;
      if (h.hit === "exact") exactCounts.set(h.userId, (exactCounts.get(h.userId) || 0) + 1);
      const off = Math.abs(h.pred.home - m.homeGoals) + Math.abs(h.pred.away - m.awayGoals);
      if (h.hit !== "exact" && off === 1)
        almostCounts.set(h.userId, (almostCounts.get(h.userId) || 0) + 1);
      if (h.pred.home === 0 && h.pred.away === 0)
        nilNilCounts.set(h.userId, (nilNilCounts.get(h.userId) || 0) + 1);
      if (h.pred.home === h.pred.away)
        drawCounts.set(h.userId, (drawCounts.get(h.userId) || 0) + 1);
    }
  }

  {
    const top = strictTop(exactCounts, thresholds.sniper);
    awards.push({
      key: "sniper",
      emoji: "🎯",
      title: "הצלף",
      kind: "performance",
      holder: top ? names.get(top.id) || null : null,
      detail: top
        ? `פגע ב-${top.count} תוצאות מדויקות`
        : `דרושות ≥${thresholds.sniper} תוצאות מדויקות`,
    });
  }
  {
    const top = strictTop(almostCounts, thresholds.almost);
    awards.push({
      key: "almost",
      emoji: "🪤",
      title: "מלך הכמעט",
      kind: "performance",
      holder: top ? names.get(top.id) || null : null,
      detail: top
        ? `${top.count} פעמים היה שער אחד ממדויק`
        : `דרושים ≥${thresholds.almost} פספוסים בשער אחד`,
    });
  }
  {
    const top = strictTop(nilNilCounts, thresholds.hater);
    awards.push({
      key: "hater",
      emoji: "😈",
      title: "ההייטר",
      kind: "performance",
      holder: top ? names.get(top.id) || null : null,
      detail: top
        ? `הימר 0-0 ב-${top.count} משחקים`
        : `דרושים ≥${thresholds.hater} הימורי 0-0`,
    });
  }
  {
    const top = strictTop(drawCounts, thresholds.draws);
    awards.push({
      key: "draw-king",
      emoji: "🤝",
      title: "מלך התיקו",
      kind: "performance",
      holder: top ? names.get(top.id) || null : null,
      detail: top
        ? `הימר תיקו ב-${top.count} משחקים`
        : `דרושים ≥${thresholds.draws} הימורי תיקו`,
    });
  }

  // ---------- 👑 מלך העולות — correct qualifiers from fully-finished groups ----------
  {
    const counts = new Map<string, number>();
    for (const b of bettors) counts.set(b.userId, 0);
    const done = finishedGroups(groupFinished);
    for (const [letter, ms] of done) {
      const real = new Set(realQualifiers(letter, ms));
      for (const b of bettors) {
        const order = b.groupPredictions?.[letter]?.order;
        if (!Array.isArray(order)) continue;
        const picked = order
          .slice(0, 2)
          .map((idx) => GROUPS[letter][idx]?.code)
          .filter(Boolean) as string[];
        const hits = picked.filter((c) => real.has(c)).length;
        counts.set(b.userId, (counts.get(b.userId) || 0) + hits);
      }
    }
    const top = strictTop(counts, thresholds.qualifiers);
    awards.push({
      key: "qualifiers-king",
      emoji: "👑",
      title: "מלך העולות",
      kind: "performance",
      holder: top ? names.get(top.id) || null : null,
      detail: top
        ? `פגע ב-${top.count} נבחרות שעלו מהבית`
        : `דרושות ≥${thresholds.qualifiers} עולות נכונות (בתים שהסתיימו)`,
    });
  }

  return awards;
}
