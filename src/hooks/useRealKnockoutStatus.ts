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
  KO_SLOT_KEYS,
  type ScheduleMatch,
  type KoSlotKey,
} from "@/lib/scoring/knockout-resolver";
import { slotStatus } from "@/lib/tournament/ko-live-state";
import { useBettingStore } from "@/stores/betting-store";
import type { FinishedMatch } from "@/lib/results-hits";

export interface RealKnockoutStatus {
  loading: boolean;
  /** All 12 groups finished → the real R32 (incl. best-thirds) is determined. */
  groupStageComplete: boolean;
  /** Slots currently editable (teams known, >30 min before kickoff). */
  openCount: number;
  /** Open slots the user hasn't predicted a winner for yet. */
  unfilledOpenCount: number;
}

export function useRealKnockoutStatus(): RealKnockoutStatus {
  const knockoutLive = useBettingStore((s) => s.knockoutLive);
  const [fixtures, setFixtures] = useState<RealFixture[] | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const refresh = () => loadRealFixtures().then((f) => { if (alive) { setFixtures(f); setNow(Date.now()); } });
    refresh();
    const id = setInterval(refresh, 120_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return useMemo<RealKnockoutStatus>(() => {
    if (fixtures === null) return { loading: true, groupStageComplete: false, openCount: 0, unfilledOpenCount: 0 };
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
    if (!groupStageComplete) return { loading: false, groupStageComplete: false, openCount: 0, unfilledOpenCount: 0 };
    const tree = resolveKnockoutTree(scored, null);
    let openCount = 0;
    let unfilledOpenCount = 0;
    for (const k of KO_SLOT_KEYS as readonly KoSlotKey[]) {
      if (slotStatus(k, tree, schedule, now) === "open") {
        openCount++;
        if (!knockoutLive[k]?.winner) unfilledOpenCount++;
      }
    }
    return { loading: false, groupStageComplete: true, openCount, unfilledOpenCount };
  }, [fixtures, now, knockoutLive]);
}
