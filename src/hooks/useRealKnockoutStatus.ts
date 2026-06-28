"use client";

// ============================================================================
// Shared signal for the real-data tree ("עץ נתוני אמת"): is it open, and does
// the user still have open matches to bet? Powers the status-strip nudge, the
// "group stage ended" modal, and the הימורים-button badge — one source of
// truth, reusing the cached fixtures loader (no extra fetch storm).
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { loadRealFixtures, type RealFixture } from "@/lib/fixtures-client";
import {
  resolveKnockoutTree,
  computeGroupOrders,
  findKickoffForSlot,
  KO_SLOT_KEYS,
  type ScheduleMatch,
  type KoSlotKey,
} from "@/lib/scoring/knockout-resolver";
import { slotStatus, LOCK_BEFORE_MIN } from "@/lib/tournament/ko-live-state";
import { LIVE_FEEDERS } from "@/lib/tournament/knockout-derivation";
import { useBettingStore } from "@/stores/betting-store";
import { createClient } from "@/lib/supabase/client";
import type { FinishedMatch } from "@/lib/results-hits";

export interface RealKnockoutStatus {
  loading: boolean;
  /** All 12 groups finished → the real R32 (incl. best-thirds) is determined. */
  groupStageComplete: boolean;
  /** Slots currently editable (teams known, >30 min before kickoff). */
  openCount: number;
  /** Open slots the user hasn't predicted a winner for yet (LOCAL store). */
  unfilledOpenCount: number;
  /** Open slots NOT yet SAVED to the DB (authoritative — independent of the
   *  local cache). null until the DB read returns. This is what the bettor
   *  should trust: "X matches still missing in the current stage". */
  dbUnfilledOpenCount: number | null;
  /** Open slots already saved to the DB. */
  dbSavedOpenCount: number;
  /** Total resolved matches in the current stage (16 in R32), incl. locked —
   *  stays constant as matches lock so the saved count doesn't shrink. */
  stageTotal: number;
  /** How many of the current stage's matches are saved to the DB (0..stageTotal). */
  dbSavedStage: number;
  /** Hebrew name of the stage to fill now (earliest stage with unfilled open
   *  matches) — e.g. "שלב 32 הגדולות", then "שמינית הגמר". null when nothing open. */
  openStageLabel: string | null;
  /** Hebrew name of the current open stage REGARDLESS of fill state — drives the
   *  banner's "we're in stage X" text even after the viewer has bet. */
  currentStageLabel: string | null;
  /** The next match(es) still to be PLAYED by kickoff (open OR locked — NOT
   *  finished). ALL matches sharing the earliest kickoff are listed, so two
   *  simultaneous matches both show. A locked/in-play match stays "next" until
   *  it ends, then the following kickoff takes over. `locked` = betting closed. */
  nextMatch: { matches: { team1: string; team2: string }[]; kickoff: string; lockAt: string; locked: boolean } | null;
}

// Stage prefix → display order + Hebrew label. The real-data tree fills one
// stage at a time, so the "current" stage is the earliest one still open.
const STAGE_ORDER = ["r32", "r16", "qf", "sf", "final"] as const;
const STAGE_LABEL: Record<string, string> = {
  r32: "שלב 32 הגדולות",
  r16: "שמינית הגמר",
  qf: "רבע גמר",
  sf: "חצי גמר",
  final: "הגמר",
};
// A slot is "filled" when both 90' scores are entered. A draw is complete with
// no winner pick (penalties / who advances aren't part of the real-data tree).
const slotHasScores = (v?: { score1?: number | null; score2?: number | null } | null): boolean =>
  !!v && v.score1 != null && v.score2 != null;

function stageOf(key: string): string {
  if (key.startsWith("r32")) return "r32";
  if (key.startsWith("r16")) return "r16";
  if (key.startsWith("qf")) return "qf";
  if (key.startsWith("sf")) return "sf";
  return "final";
}

export function useRealKnockoutStatus(): RealKnockoutStatus {
  const knockoutLive = useBettingStore((s) => s.knockoutLive);
  const [fixtures, setFixtures] = useState<RealFixture[] | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // The viewer's OWN saved picks straight from the DB (RLS lets them read their
  // row) — the authoritative "what actually saved", separate from the local store.
  const [dbSaved, setDbSaved] = useState<Record<string, { score1?: number | null; score2?: number | null }> | null>(null);

  useEffect(() => {
    let alive = true;
    const fetchSaved = async (): Promise<Record<string, { score1?: number | null; score2?: number | null }> | null> => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        const { data } = await supabase
          .from("user_brackets")
          .select("knockout_tree_live")
          .eq("user_id", user.id)
          .maybeSingle();
        return (data?.knockout_tree_live || {}) as Record<string, { score1?: number | null; score2?: number | null }>;
      } catch {
        return null;
      }
    };
    const refresh = () => {
      loadRealFixtures().then((f) => { if (alive) { setFixtures(f); setNow(Date.now()); } });
      fetchSaved().then((s) => { if (alive && s) setDbSaved(s); });
    };
    refresh();
    const id = setInterval(refresh, 120_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return useMemo<RealKnockoutStatus>(() => {
    if (fixtures === null) return { loading: true, groupStageComplete: false, openCount: 0, unfilledOpenCount: 0, dbUnfilledOpenCount: null, dbSavedOpenCount: 0, stageTotal: 0, dbSavedStage: 0, openStageLabel: null, currentStageLabel: null, nextMatch: null };
    const scored: FinishedMatch[] = fixtures
      .filter((m) => m.homeGoals != null && m.awayGoals != null)
      .map((m) => ({
        id: m.id, date: m.date, homeTla: m.homeTla, awayTla: m.awayTla,
        group: m.group ?? "", stage: m.stage ?? "",
        homeGoals: m.homeGoals as number, awayGoals: m.awayGoals as number,
        homePenalties: m.homePenalties ?? null, awayPenalties: m.awayPenalties ?? null,
        winner: m.winner ?? null,
      }));
    const schedule: ScheduleMatch[] = fixtures.map((m) => ({ homeTla: m.homeTla, awayTla: m.awayTla, date: m.date, status: m.status ?? null }));
    const groupStageComplete = Object.keys(computeGroupOrders(scored)).length === 12;
    if (!groupStageComplete) return { loading: false, groupStageComplete: false, openCount: 0, unfilledOpenCount: 0, dbUnfilledOpenCount: null, dbSavedOpenCount: 0, stageTotal: 0, dbSavedStage: 0, openStageLabel: null, currentStageLabel: null, nextMatch: null };
    const tree = resolveKnockoutTree(scored, null, undefined, LIVE_FEEDERS);
    let openCount = 0;
    let unfilledOpenCount = 0;
    let dbSavedOpenCount = 0;
    let earliestUnfilledStageIdx = Infinity;
    let earliestOpenStageIdx = Infinity;
    let nextMatch: RealKnockoutStatus["nextMatch"] = null;
    let nextKo = Infinity;
    for (const k of KO_SLOT_KEYS as readonly KoSlotKey[]) {
      const st = slotStatus(k, tree, schedule, now);
      // "Next match" = earliest-kickoff match still to be PLAYED (open OR locked,
      // i.e. NOT finished/waiting) — so tonight's locked/in-play match stays the
      // "next match" until it actually ends, then the following one takes over.
      if (st === "open" || st === "locked") {
        const slot = tree[k];
        const ko = findKickoffForSlot(k, tree, schedule);
        if (ko && slot?.team1 && slot?.team2) {
          const t = Date.parse(ko.date);
          if (!Number.isNaN(t)) {
            if (t < nextKo) {
              // Earlier kickoff → starts a fresh "next" group.
              nextKo = t;
              nextMatch = { matches: [{ team1: slot.team1, team2: slot.team2 }], kickoff: ko.date, lockAt: new Date(t - LOCK_BEFORE_MIN * 60_000).toISOString(), locked: st === "locked" };
            } else if (t === nextKo && nextMatch) {
              // Same kickoff → another simultaneous match; list it too.
              nextMatch.matches.push({ team1: slot.team1, team2: slot.team2 });
              if (st === "locked") nextMatch.locked = true;
            }
          }
        }
      }
      // The remaining counts are about BETTING — open (editable) slots only.
      if (st !== "open") continue;
      openCount++;
      if (slotHasScores(dbSaved?.[k])) dbSavedOpenCount++;
      const sIdx = (STAGE_ORDER as readonly string[]).indexOf(stageOf(k));
      if (sIdx >= 0 && sIdx < earliestOpenStageIdx) earliestOpenStageIdx = sIdx;
      if (!slotHasScores(knockoutLive[k])) {
        unfilledOpenCount++;
        if (sIdx >= 0 && sIdx < earliestUnfilledStageIdx) earliestUnfilledStageIdx = sIdx;
      }
    }
    // Stage totals (C): count the WHOLE current stage's matches (16 in R32),
    // incl. locked/finished, so "saved X/Y" doesn't shrink as matches lock.
    const currentStageKey = earliestOpenStageIdx < STAGE_ORDER.length ? STAGE_ORDER[earliestOpenStageIdx] : null;
    let stageTotal = 0;
    let dbSavedStage = 0;
    if (currentStageKey) {
      for (const k of KO_SLOT_KEYS as readonly KoSlotKey[]) {
        if (stageOf(k) !== currentStageKey) continue;
        const slot = tree[k];
        if (!slot?.team1 || !slot?.team2) continue; // resolved matches only
        stageTotal++;
        if (slotHasScores(dbSaved?.[k])) dbSavedStage++;
      }
    }
    const openStageLabel = earliestUnfilledStageIdx < STAGE_ORDER.length
      ? STAGE_LABEL[STAGE_ORDER[earliestUnfilledStageIdx]]
      : null;
    const currentStageLabel = earliestOpenStageIdx < STAGE_ORDER.length
      ? STAGE_LABEL[STAGE_ORDER[earliestOpenStageIdx]]
      : null;
    const dbUnfilledOpenCount = dbSaved ? Math.max(0, openCount - dbSavedOpenCount) : null;
    return { loading: false, groupStageComplete: true, openCount, unfilledOpenCount, dbUnfilledOpenCount, dbSavedOpenCount, stageTotal, dbSavedStage, openStageLabel, currentStageLabel, nextMatch };
  }, [fixtures, now, knockoutLive, dbSaved]);
}
