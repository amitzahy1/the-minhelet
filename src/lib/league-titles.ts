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

import type { BettorBracket } from "@/lib/supabase/shared-data";
import { computeGroupHits, normalizeTla, type FinishedMatch } from "@/lib/results-hits";
import { calculateStandings } from "@/lib/tournament/standings";
import { GROUPS } from "@/lib/tournament/groups";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import { toIsraelDateKey } from "@/lib/timezone";
import { SCORING, type ScoringValues, type GroupMatchPrediction } from "@/types";

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
  /** הסגן הנצחי — minimum match-days finished in 2nd place. */
  runnerUpDays: number;
  /** נביא הבתים — minimum group winners nobody else picked. */
  prophet: number;
}

export const DEFAULT_TITLE_THRESHOLDS: TitleThresholds = {
  sniper: 3,
  almost: 3,
  qualifiers: 5,
  hater: 3,
  draws: 4,
  runnerUpDays: 3,
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
 */
function agreementPct(a: BettorBracket, b: BettorBracket): number | null {
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
  scoring: ScoringValues = SCORING,
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
        ? `${top.count} מתוך ${bettors.length} הימרו עליה`
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
        ? `היחיד שהלך על ${flagTeam(wolf.champion!)}`
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
          ? `מסכימים על ${Math.round(bestPair.pct)}% מההימורים`
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
        ? `מסכים עם שאר הליגה על ${Math.round(loner.value)}% בלבד`
        : "אף אחד לא מנותק מספיק",
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
        ? `לבדו על ${top.count} מנצחות בתים: ${picks.map((c) => getFlag(c)).join(" ")}`
        : `דרושות ≥${thresholds.prophet} מנצחות בתים ייחודיות`,
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
        ? `${top.count} תוצאות מדויקות`
        : `דרושות ≥${thresholds.sniper} מדויקות (בלי תיקו בצמרת)`,
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
        ? `${top.count} פעמים שער אחד מתוצאה מדויקת`
        : `דרושים ≥${thresholds.almost} "כמעט" (פספוס בשער אחד)`,
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
        ? `הימר 0-0 ${top.count} פעמים`
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
        ? `${top.count} הימורי תיקו — אמיץ`
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
        ? `${top.count} עולות נכונות מהבתים`
        : `דרושות ≥${thresholds.qualifiers} עולות נכונות (בתים שהסתיימו)`,
    });
  }

  // ---------- 🥈 הסגן הנצחי — most match-days finished in 2nd place ----------
  // Ranked by cumulative MATCH points (group stage), same engine as the
  // leaderboard sparkline — advancement/special points don't move day ranks.
  {
    const byDay = new Map<string, FinishedMatch[]>();
    for (const m of groupFinished) {
      const key = toIsraelDateKey(m.date);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(m);
    }
    const totals = new Map<string, number>();
    const daysAtSecond = new Map<string, number>();
    for (const b of bettors) {
      totals.set(b.userId, 0);
      daysAtSecond.set(b.userId, 0);
    }
    for (const [, ms] of [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      for (const m of ms) {
        for (const h of computeGroupHits(m, bettors)) {
          const pts =
            h.hit === "exact"
              ? scoring.toto.GROUP + scoring.exact.GROUP
              : h.hit === "toto"
              ? scoring.toto.GROUP
              : 0;
          if (pts) totals.set(h.userId, (totals.get(h.userId) || 0) + pts);
        }
      }
      // Day over — who is 2nd right now?
      const vals = [...totals.entries()];
      for (const [uid, total] of vals) {
        const above = vals.filter(([, t]) => t > total).length;
        if (above === 1) daysAtSecond.set(uid, (daysAtSecond.get(uid) || 0) + 1);
      }
    }
    const top = strictTop(daysAtSecond, thresholds.runnerUpDays);
    awards.push({
      key: "runner-up",
      emoji: "🥈",
      title: "הסגן הנצחי",
      kind: "performance",
      holder: top ? names.get(top.id) || null : null,
      detail: top
        ? `${top.count} ימי משחקים סיים במקום השני`
        : `דרושים ≥${thresholds.runnerUpDays} ימים במקום השני`,
    });
  }

  return awards;
}
