// ============================================================================
// WC2026 — Special bets scoring (final + live-tentative)
//
// Two modes:
//
// 1. **Final** — admin entered the official outcome in `tournament_actuals`.
//    Exact picks award the full point value (e.g. top scorer = 12). Top-scorer
//    and top-assists also support "relative" credit, but it is **closest among
//    bettors, gated on no exact**: relative is awarded ONLY when no bettor
//    picked the exact winner, and then only to the bettor(s) whose picked player
//    ranks highest in the actual chart (ties share), subject to a ≥3 goals /
//    ≥2 assists qualifying floor. This cross-bettor decision is made once by
//    `computeSpecialBetsPool` and passed in via the `relative` arg — the per-user
//    scorer just checks `stat === relative.value`.
//
// 2. **Live tentative (during tournament)** — admin hasn't entered the final
//    yet, but the cron-synced `player_stats` table records per-player goals /
//    assists. We award the same point values the user would earn IF the
//    tournament ended right now: pick === current leader → exact; otherwise the
//    closest-among-bettors relative (same `relative` arg, computed off the live
//    leader). Every awarded line is flagged `interim: true` so the UI can mark
//    it as "כרגע" / "זמני".
//
// "Other" special bets (best-attack team, prolific group, …) work in both
// modes too: when the admin has entered the actual value, exact match awards
// the full points; otherwise the bet contributes 0 (no live tentative path
// for team/group bets yet — those resolve cleanly after group stage).
// ============================================================================

import { SCORING, type ScoreReason, type ScoringValues } from "@/types";
import type { BettorSpecialBets } from "@/lib/supabase/shared-data";
import { MATCHUPS, parseMatchupPick } from "@/lib/matchups";

/** Admin-entered tournament outcome (mirrors the `tournament_actuals` row). */
export interface TournamentActuals {
  top_scorer_player: string | null;
  top_assists_player: string | null;
  best_attack_team: string | null;
  most_prolific_group: string | null;
  driest_group: string | null;
  dirtiest_team: string | null;
  /**
   * Admin-maintained per-team card tally (yellow=1, red=3). Feeds the group /
   * best-thirds fair-play tiebreaker via `fairPlayFromBoard` — the results API
   * has no bookings, so this is the only card source. Optional/null when unset.
   */
  dirtiest_board?: Array<{ team: string; yellow: number; red: number }> | null;
  /** One result per player-duel matchup (3 fixtures). Each scored independently. */
  matchup_result_1: "1" | "X" | "2" | null;
  matchup_result_2: "1" | "X" | "2" | null;
  matchup_result_3: "1" | "X" | "2" | null;
  penalties_over_under: "OVER" | "UNDER" | null;
}

/** Per-player tournament stats — populated by the sync cron or admin patch. */
export interface PlayerStat {
  name: string;
  goals: number;
  assists: number;
  minutes?: number;
}

export interface SpecialBetLine {
  reason: ScoreReason;
  points: number;
  /** True when admin hasn't entered the final result yet — score is interim. */
  interim: boolean;
  /** Display hint: who's currently leading (only set when interim). */
  liveLeader?: string;
  /** Display hint: the user's pick value as stored (for the breakdown UI). */
  pick?: string | null;
}

export interface SpecialBetsBreakdown {
  total: number;
  /** True if **any** line is interim. */
  hasInterim: boolean;
  lines: SpecialBetLine[];
}

/** The special-bet categories shown as their own row in the breakdown UI.
 *  (The penalties over/under bet was removed from the game on 2026-06-13 —
 *  stored picks remain in the DB but are never scored or displayed.) */
export type SpecialCategory =
  | "topScorer"
  | "topAssists"
  | "bestAttack"
  | "prolificGroup"
  | "driestGroup"
  | "dirtiestTeam"
  | "matchups";

/**
 * Pool-level "closest among bettors" relative winner values. A pick wins the
 * relative line iff its stat EQUALS the value here. `null` means no relative is
 * awarded for that category — either someone hit the exact winner (which
 * suppresses relative entirely) or no pick cleared the qualifying floor.
 */
export interface SpecialBetsRelative {
  topScorerGoals: number | null;
  topAssistsCount: number | null;
}

/** Resolution state of a category across the whole pool (for display). */
export type SpecialCatStatus = "won" | "void" | "pending";

export interface SpecialBetsPool {
  relative: SpecialBetsRelative;
  status: Record<SpecialCategory, SpecialCatStatus>;
  /**
   * Whether each category's FINAL actual is entered — i.e. the bet is truly
   * locked and can no longer change. Distinct from `status: "won"`, which for
   * top scorer / top assists only means someone is CURRENTLY (interim) catching
   * it. Displays use this to decide "🔒 נסגר" vs "⏱ זמני" for a bettor who has
   * no line in the category (so no per-line `interim` flag to read).
   */
  resolved: Record<SpecialCategory, boolean>;
}

/** Map a special-bet score reason to its breakdown category (null = not special). */
export function specialReasonToCategory(reason: ScoreReason): SpecialCategory | null {
  switch (reason) {
    case "TOP_SCORER_EXACT":
    case "TOP_SCORER_RELATIVE":
      return "topScorer";
    case "TOP_ASSISTS_EXACT":
    case "TOP_ASSISTS_RELATIVE":
      return "topAssists";
    case "BEST_ATTACK":
      return "bestAttack";
    case "PROLIFIC_GROUP":
      return "prolificGroup";
    case "DRIEST_GROUP":
      return "driestGroup";
    case "DIRTIEST_TEAM":
      return "dirtiestTeam";
    case "MATCHUP":
      return "matchups";
    default:
      return null;
  }
}

const isSet = (v: string | null | undefined): boolean => v != null && v !== "";

/**
 * Names that hold a category crown by `key` (goals / assists). Ties SHARE the
 * crown with NO tiebreak — every player level on the top count is a co-king, so
 * a bettor who picked ANY of them earns the exact award (league rule: "there
 * can be several top scorers if they have the most"). Empty when nobody has
 * scored/assisted yet. Used for both the live-tentative path (no `finalName`)
 * and the final path (`finalName` = admin-entered winner; ties on that winner's
 * count still share, so co-scorers the admin didn't type are credited too).
 */
function kingNames(finalName: string | null, stats: PlayerStat[], key: "goals" | "assists"): string[] {
  if (finalName) {
    const ws = findStat(stats, finalName);
    if (ws && ws[key] > 0) {
      const tied = stats.filter((s) => s[key] === ws[key]).map((s) => s.name);
      // Guarantee the admin's name is present even if the feed lacks its stat.
      if (!tied.some((n) => sameName(n, finalName))) tied.push(finalName);
      return tied;
    }
    return [finalName];
  }
  if (!stats.length) return [];
  const max = Math.max(...stats.map((s) => s[key]));
  if (max <= 0) return [];
  return stats.filter((s) => s[key] === max).map((s) => s.name);
}

// Accent-insensitive, all-significant-tokens match — so a stored pick like
// "Vinícius Jr." resolves to the feed's "Vinícius Júnior", while "Harry Kane"
// does NOT collide with squad-mate "Harry Maguire" (requires "kane" too).
const deburrName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

// EXACT-pick equality must tolerate accent/case drift between the stored pick
// and the feed / admin-entered name: real picks include "Harry kane" (vs the
// feed's "Harry Kane") and "Vinícius Júnior" (vs FD's "Vinicius Junior"). A
// strict === here silently downgraded a correct golden-boot pick from the
// exact award to the relative one. Full-string deburr equality only — no
// substring matching, so "Harry Kane" still never collides with "Harry Maguire".
const sameName = (a: string | null | undefined, b: string | null | undefined): boolean =>
  !!a && !!b && (a === b || deburrName(a) === deburrName(b));

function findStat(stats: PlayerStat[], name: string | null | undefined): PlayerStat | null {
  if (!name) return null;
  const exact = stats.find((s) => s.name === name) ||
    stats.find((s) => s.name.endsWith(` ${name}`) || s.name.endsWith(`. ${name}`));
  if (exact) return exact;
  const q = deburrName(name);
  const qTokens = q.split(" ").filter((t) => t.length >= 4);
  return (
    stats.find((s) => {
      const n = deburrName(s.name);
      return n.includes(q) || q.includes(n) || (qTokens.length > 0 && qTokens.every((t) => n.includes(t)));
    }) || null
  );
}

/**
 * Current live result of a player-duel by total goals + assists, or null when
 * neither duel player has any stat yet. Drives the matchup live-tentative path:
 * whoever leads the duel right now "catches" it for bettors who picked that side.
 */
/**
 * Teams currently TIED for the most goals scored (tournament-cumulative) —
 * the live "best attack" leaders. Empty when no goals/data. Ties all count, so
 * a bettor who picked any co-leader catches it (mirrors how a tie would
 * tentatively resolve). Used for the best-attack live-tentative path.
 */
function bestAttackLeaderSet(goalsByTeam: Record<string, number> | undefined): Set<string> {
  const s = new Set<string>();
  if (!goalsByTeam) return s;
  const vals = Object.values(goalsByTeam);
  if (!vals.length) return s;
  const max = Math.max(...vals);
  if (max <= 0) return s;
  for (const [team, g] of Object.entries(goalsByTeam)) if (g === max) s.add(team);
  return s;
}

/**
 * Teams currently TIED for the most cards (weighted yellow=1, red=3) on the
 * admin/feed-maintained dirtiest board — the live "dirtiest team" leaders.
 * Used for the dirtiest-team live-tentative path.
 */
function dirtiestLeaderSet(board: TournamentActuals["dirtiest_board"]): Set<string> {
  const s = new Set<string>();
  if (!board || !board.length) return s;
  const w = (c: { yellow: number; red: number }) => c.yellow + c.red * 3;
  const max = Math.max(...board.map(w));
  if (max <= 0) return s;
  for (const c of board) if (w(c) === max) s.add(c.team);
  return s;
}

function liveMatchupResult(stats: PlayerStat[], mu: (typeof MATCHUPS)[number]): "1" | "X" | "2" | null {
  const s1 = findStat(stats, mu.name1);
  const s2 = findStat(stats, mu.name2);
  const t1 = (s1?.goals ?? 0) + (s1?.assists ?? 0);
  const t2 = (s2?.goals ?? 0) + (s2?.assists ?? 0);
  if (t1 === 0 && t2 === 0) return null;
  if (t1 > t2) return "1";
  if (t2 > t1) return "2";
  return "X";
}

/**
 * Score one user's special-bets entry.
 *
 * - `actuals` may be partially-filled — each field is scored independently.
 *   Fields the admin hasn't entered yet (null) fall back to the live tentative
 *   path when `playerStats` data exists, otherwise contribute 0.
 * - The returned `total` already factors in interim lines; the caller is
 *   responsible for rendering those with a visual marker (see `interim` flag).
 */
export function scoreSpecialBetsForUser(
  bets: BettorSpecialBets,
  actuals: TournamentActuals | null,
  playerStats: PlayerStat[] = [],
  scoring: ScoringValues = SCORING,
  // Pool-level relative winner values. Default = no relative awarded; the live
  // path always passes the value from `computeSpecialBetsPool`. Relative is
  // "closest among bettors, only if nobody got the exact" — so a pick wins the
  // relative line iff its stat EQUALS the value here (see computeSpecialBetsPool).
  relative: SpecialBetsRelative = { topScorerGoals: null, topAssistsCount: null },
  // Tournament-cumulative goals-for per team — drives the best-attack LIVE
  // tentative path (current top-scoring team). Empty = no live path (best
  // attack then only scores once the admin enters the final). Dirtiest's live
  // leader comes from `actuals.dirtiest_board` (already on `actuals`).
  liveTeamGoals: Record<string, number> = {},
): SpecialBetsBreakdown {
  const lines: SpecialBetLine[] = [];
  const bestAttackLeaders = bestAttackLeaderSet(liveTeamGoals);
  const dirtiestLeaders = dirtiestLeaderSet(actuals?.dirtiest_board);

  // -- Top scorer --
  // Ties SHARE the crown: every player level on the most goals is a co-king, so
  // any bettor who picked one earns the EXACT award (no golden-boot tiebreak).
  // A caught king suppresses the relative line pool-wide (see the pool). When a
  // final winner is entered, `interim` flips to false but the tie rule stays.
  const finalScorer = isSet(actuals?.top_scorer_player) ? actuals!.top_scorer_player! : null;
  if (bets.topScorerPlayer) {
    const kings = kingNames(finalScorer, playerStats, "goals");
    if (finalScorer || kings.length) {
      const interim = !finalScorer;
      const liveLeader = interim ? kings.join("/") : undefined;
      if (kings.some((n) => sameName(bets.topScorerPlayer, n))) {
        lines.push({
          reason: "TOP_SCORER_EXACT",
          points: scoring.specials.top_scorer_exact,
          interim,
          liveLeader,
          pick: bets.topScorerPlayer,
        });
      } else {
        const stat = findStat(playerStats, bets.topScorerPlayer);
        if (relative.topScorerGoals != null && stat && stat.goals === relative.topScorerGoals) {
          lines.push({
            reason: "TOP_SCORER_RELATIVE",
            points: scoring.specials.top_scorer_relative,
            interim,
            liveLeader,
            pick: bets.topScorerPlayer,
          });
        }
      }
    }
  }

  // -- Top assists -- (same tie-shares-the-crown rule as top scorer)
  const finalAssists = isSet(actuals?.top_assists_player) ? actuals!.top_assists_player! : null;
  if (bets.topAssistsPlayer) {
    const kings = kingNames(finalAssists, playerStats, "assists");
    if (finalAssists || kings.length) {
      const interim = !finalAssists;
      const liveLeader = interim ? kings.join("/") : undefined;
      if (kings.some((n) => sameName(bets.topAssistsPlayer, n))) {
        lines.push({
          reason: "TOP_ASSISTS_EXACT",
          points: scoring.specials.top_assists_exact,
          interim,
          liveLeader,
          pick: bets.topAssistsPlayer,
        });
      } else {
        const stat = findStat(playerStats, bets.topAssistsPlayer);
        if (relative.topAssistsCount != null && stat && stat.assists === relative.topAssistsCount) {
          lines.push({
            reason: "TOP_ASSISTS_RELATIVE",
            points: scoring.specials.top_assists_relative,
            interim,
            liveLeader,
            pick: bets.topAssistsPlayer,
          });
        }
      }
    }
  }

  // -- Most prolific group / Driest group --
  // Group bets are mathematically DECIDED at the end of the group stage; the
  // actual is filled (admin or auto-derived) so they score exact & final.
  const simpleExact: [keyof BettorSpecialBets, keyof TournamentActuals, ScoreReason, keyof typeof SCORING.specials][] = [
    ["prolificGroup", "most_prolific_group", "PROLIFIC_GROUP", "prolific_group"],
    ["driestGroup", "driest_group", "DRIEST_GROUP", "driest_group"],
  ];
  for (const [betField, actualField, reason, scoringField] of simpleExact) {
    const pick = bets[betField] as string | null;
    const actual = actuals?.[actualField] as string | null | undefined;
    if (pick && actual && pick === actual) {
      lines.push({ reason, points: scoring.specials[scoringField], interim: false, pick });
    }
  }

  // -- Best attack team & Dirtiest team --
  // Tournament-long bets: FINAL when the admin enters the value (exact), else
  // LIVE-tentative against the current leader (top-scoring team / most-carded
  // team). Whoever picked a current co-leader catches it for now (interim);
  // it flips as the standings move and locks when the admin enters the final.
  const nonEmpty = (v: string | null | undefined): boolean => v != null && v !== "";
  if (bets.bestAttackTeam) {
    const finalBA = actuals?.best_attack_team;
    if (nonEmpty(finalBA)) {
      if (bets.bestAttackTeam === finalBA) {
        lines.push({ reason: "BEST_ATTACK", points: scoring.specials.best_attack, interim: false, pick: bets.bestAttackTeam });
      }
    } else if (bestAttackLeaders.has(bets.bestAttackTeam)) {
      lines.push({ reason: "BEST_ATTACK", points: scoring.specials.best_attack, interim: true, liveLeader: [...bestAttackLeaders].join("/"), pick: bets.bestAttackTeam });
    }
  }
  if (bets.dirtiestTeam) {
    const finalDT = actuals?.dirtiest_team;
    if (nonEmpty(finalDT)) {
      if (bets.dirtiestTeam === finalDT) {
        lines.push({ reason: "DIRTIEST_TEAM", points: scoring.specials.dirtiest_team, interim: false, pick: bets.dirtiestTeam });
      }
    } else if (dirtiestLeaders.has(bets.dirtiestTeam)) {
      lines.push({ reason: "DIRTIEST_TEAM", points: scoring.specials.dirtiest_team, interim: true, liveLeader: [...dirtiestLeaders].join("/"), pick: bets.dirtiestTeam });
    }
  }

  // -- Matchups (3 player duels) --
  // The user's pick is stored as a comma-joined "1,X,2" string; the admin
  // enters one result per duel (matchup_result_1..3). Each duel is scored
  // independently at scoring.specials.matchup. When the admin hasn't entered a
  // duel's result yet, it's scored LIVE-tentatively from the current
  // goals+assists of the two duel players (interim) — whoever leads catches it.
  const matchupPicks = parseMatchupPick(bets.matchupPick);
  const matchupActuals = [
    actuals?.matchup_result_1 ?? null,
    actuals?.matchup_result_2 ?? null,
    actuals?.matchup_result_3 ?? null,
  ];
  for (let i = 0; i < MATCHUPS.length; i++) {
    const pick = matchupPicks[i];
    if (!pick) continue;
    const mu = MATCHUPS[i];
    const actual = matchupActuals[i];
    // Show just the player the bettor picked (or "תיקו") — short and clear,
    // instead of the long "A vs B: 1" string.
    const sideName = pick === "1" ? mu.p1Short : pick === "2" ? mu.p2Short : "תיקו";
    if (actual) {
      if (pick === actual) {
        lines.push({ reason: "MATCHUP", points: scoring.specials.matchup, interim: false, pick: sideName });
      }
    } else {
      // Live tentative: whoever currently leads the duel catches it.
      const live = liveMatchupResult(playerStats, mu);
      if (live && pick === live) {
        lines.push({
          reason: "MATCHUP",
          points: scoring.specials.matchup,
          interim: true,
          liveLeader: live === "X" ? "תיקו" : live === "1" ? mu.p1Short : mu.p2Short,
          pick: sideName,
        });
      }
    }
  }

  // (No penalties over/under scoring — the bet was removed from the game on
  // 2026-06-13. Stored picks and the actuals column are intentionally ignored.)

  const total = lines.reduce((sum, l) => sum + l.points, 0);
  const hasInterim = lines.some((l) => l.interim);
  return { total, hasInterim, lines };
}

/**
 * Pool-level pass over EVERY bettor's special bets. Produces:
 *
 * - `relative` — the "closest among bettors, only if no exact" winner value for
 *   top scorer / top assists. If any bettor picked the exact winner (or live
 *   leader, mid-tournament), relative is `null` for that category (exact
 *   suppresses relative). Otherwise it's the highest stat among all picks that
 *   clear the qualifying floor; bettors whose pick EQUALS that value win the
 *   relative line (ties share). Feed this into `scoreSpecialBetsForUser`.
 *
 * - `status` — per-category resolution state for the breakdown UI:
 *   `pending` (result not entered yet), `won` (entered and ≥1 bettor scored),
 *   `void` (entered and nobody scored → "אף אחד לא תפס").
 */
export function computeSpecialBetsPool(
  allBets: BettorSpecialBets[],
  actuals: TournamentActuals | null,
  playerStats: PlayerStat[] = [],
  scoring: ScoringValues = SCORING,
  liveTeamGoals: Record<string, number> = {},
): SpecialBetsPool {
  // Treat empty strings as "unset" — the actuals row stores "" (not null) for
  // fields the admin hasn't filled.
  const set = (v: string | null | undefined): boolean => v != null && v !== "";

  // Co-king sets (ties share), identical to the per-user scorer's basis. Relative
  // is awarded to the closest-among-bettors ONLY when nobody caught a king.
  const scorerKings = kingNames(set(actuals?.top_scorer_player) ? actuals!.top_scorer_player! : null, playerStats, "goals");
  const assistsKings = kingNames(set(actuals?.top_assists_player) ? actuals!.top_assists_player! : null, playerStats, "assists");

  const relativeValue = (
    picks: (string | null)[],
    kings: string[],
    statKey: "goals" | "assists",
    floor: number,
  ): number | null => {
    if (!kings.length) return null;
    const isKing = (p: string | null) => kings.some((k) => sameName(p, k));
    // Any bettor holding a co-king suppresses relative entirely.
    if (picks.some((p) => p != null && isKing(p))) return null;
    let best: number | null = null;
    for (const p of picks) {
      if (!p || isKing(p)) continue;
      const st = findStat(playerStats, p);
      const v = st ? st[statKey] : 0;
      if (v >= floor && (best === null || v > best)) best = v;
    }
    return best;
  };

  const relative: SpecialBetsRelative = {
    topScorerGoals: relativeValue(
      allBets.map((b) => b.topScorerPlayer),
      scorerKings,
      "goals",
      scoring.relative_minimums.top_scorer_goals,
    ),
    topAssistsCount: relativeValue(
      allBets.map((b) => b.topAssistsPlayer),
      assistsKings,
      "assists",
      scoring.relative_minimums.top_assists,
    ),
  };

  // Who scored each category? Reuse the per-user scorer with the pool relative.
  const anyScored: Record<SpecialCategory, boolean> = {
    topScorer: false, topAssists: false, bestAttack: false, prolificGroup: false,
    driestGroup: false, dirtiestTeam: false, matchups: false,
  };
  for (const bets of allBets) {
    const bd = scoreSpecialBetsForUser(bets, actuals, playerStats, scoring, relative, liveTeamGoals);
    for (const line of bd.lines) {
      const cat = specialReasonToCategory(line.reason);
      if (cat && line.points > 0) anyScored[cat] = true;
    }
  }

  // A category is "resolved" once its actual is entered (empty string = unset).
  // Matchups resolve when any of the three duel results is entered.
  const resolved: Record<SpecialCategory, boolean> = {
    topScorer: set(actuals?.top_scorer_player),
    topAssists: set(actuals?.top_assists_player),
    bestAttack: set(actuals?.best_attack_team),
    prolificGroup: set(actuals?.most_prolific_group),
    driestGroup: set(actuals?.driest_group),
    dirtiestTeam: set(actuals?.dirtiest_team),
    matchups:
      set(actuals?.matchup_result_1) ||
      set(actuals?.matchup_result_2) ||
      set(actuals?.matchup_result_3),
  };

  const cats: SpecialCategory[] = [
    "topScorer", "topAssists", "bestAttack", "prolificGroup",
    "driestGroup", "dirtiestTeam", "matchups",
  ];
  const status = {} as Record<SpecialCategory, SpecialCatStatus>;
  for (const c of cats) {
    // Top scorer / assists carry RELATIVE scoring — there's always a current
    // catcher (the closest bettor among those with goals/assists), so they're
    // never "void". They're "won" once anyone scores, else "pending".
    if (c === "topScorer" || c === "topAssists") {
      status[c] = anyScored[c] ? "won" : "pending";
    } else {
      status[c] = !resolved[c] ? "pending" : anyScored[c] ? "won" : "void";
    }
  }

  return { relative, status, resolved };
}
