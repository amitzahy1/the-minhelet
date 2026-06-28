"use client";

// ============================================================================
// "עץ נתוני אמת" (Tree 2) — bet on the REAL knockout matchups.
//
// Opens after the group stage. Pulls the real bracket from /api/matches +
// /api/best-thirds via resolveKnockoutTree (the SAME resolver the scorer uses),
// so the teams the bettor predicts against are exactly what scoring will use.
// Each slot is editable until 30 min before its real match kicks off; finished
// matches show the result vs the user's pick. Predictions are scored for
// knockout match-results (toto/exact).
// ============================================================================

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageTransition } from "@/components/shared/PageTransition";
import { LoadingPage } from "@/components/shared/LoadingAnimation";
import { useBettingStore } from "@/stores/betting-store";
import {
  resolveKnockoutTree,
  computeGroupOrders,
  fairPlayFromBoard,
  type KoSlotKey,
  type ScheduleMatch,
} from "@/lib/scoring/knockout-resolver";
import { lockAtFor } from "@/lib/tournament/ko-live-state";
import { LIVE_FEEDERS } from "@/lib/tournament/knockout-derivation";
import { BracketLayout, BracketMatchCell, type KOValue, type SlotTeams, type SlotStatus } from "@/components/knockout/BracketLayout";
import type { FinishedMatch } from "@/lib/results-hits";
import { saveLiveKnockout } from "@/lib/supabase/sync";

interface ApiMatch {
  id: number;
  date: string;
  homeTla: string;
  awayTla: string;
  group?: string;
  stage?: string;
  status?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
  homePenalties?: number | null;
  awayPenalties?: number | null;
  winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
}

// slot → the downstream match it feeds (derived from the REAL-bracket feeder map).
const NEXT_MATCH: Record<string, string> = {};
for (const [downstream, [f1, f2]] of Object.entries(LIVE_FEEDERS)) {
  NEXT_MATCH[f1] = downstream;
  NEXT_MATCH[f2] = downstream;
}

// R32 column draw-order so the official (cross-side) R16 pairings render as a
// clean tree: each consecutive R32 pair feeds the R16 slot beside it. Display
// only — slot keys / stored data are unchanged.
const LIVE_R32L = ["r32l_1", "r32r_0", "r32l_0", "r32l_2", "r32r_2", "r32l_5", "r32r_4", "r32r_1"];
const LIVE_R32R = ["r32l_3", "r32r_6", "r32l_4", "r32r_5", "r32r_3", "r32l_7", "r32l_6", "r32r_7"];

export default function KnockoutLivePage() {
  const knockoutLive = useBettingStore((s) => s.knockoutLive);
  const setLive = useBettingStore((s) => s.setKnockoutLiveMatch);

  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [thirdsOverride, setThirdsOverride] = useState<string[] | null>(null);
  const [dirtyBoard, setDirtyBoard] = useState<Array<{ team: string; yellow: number; red: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  // Pull real data — same fetch/derive pattern as the live view. Refresh
  // periodically so newly-finished matches cascade open the next round.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [m, t, s] = await Promise.all([
        fetch("/api/matches").then((r) => r.json()).catch(() => ({ matches: [] })),
        fetch("/api/best-thirds").then((r) => r.json()).catch(() => ({ override: null })),
        fetch("/api/tournament-stats").then((r) => r.json()).catch(() => null),
      ]);
      if (!alive) return;
      setMatches((m.matches as ApiMatch[]) || []);
      const ov = t?.override;
      setThirdsOverride(Array.isArray(ov) && ov.length === 8 ? ov : null);
      const board = s?.actuals?.dirtiest_board;
      if (Array.isArray(board)) setDirtyBoard(board);
      setNow(Date.now());
      setLoading(false);
    };
    load();
    const id = setInterval(load, 90_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Tick "now" so per-slot locks flip without a refetch.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Scored matches → FinishedMatch[] for the resolver (drop unscored rows; never
  // coerce nulls to 0, which would invent 0-0 results).
  const scored: FinishedMatch[] = useMemo(
    () =>
      matches
        .filter((m) => m.homeGoals != null && m.awayGoals != null)
        .map((m) => ({
          id: m.id,
          date: m.date,
          homeTla: m.homeTla,
          awayTla: m.awayTla,
          group: m.group ?? "",
          stage: m.stage ?? "",
          homeGoals: m.homeGoals as number,
          awayGoals: m.awayGoals as number,
          homePenalties: m.homePenalties ?? null,
          awayPenalties: m.awayPenalties ?? null,
          winner: m.winner ?? null,
        })),
    [matches],
  );

  // Full list (incl. scheduled) for kickoff lookup + per-slot locking.
  const schedule: ScheduleMatch[] = useMemo(
    () => matches.map((m) => ({ homeTla: m.homeTla, awayTla: m.awayTla, date: m.date, status: m.status ?? null })),
    [matches],
  );

  // Card data (admin dirtiest board) so a card-decided group tie seeds the real
  // bracket the same way the scorer does. Undefined when none entered.
  const fairPlay = useMemo(() => fairPlayFromBoard(dirtyBoard), [dirtyBoard]);
  const tree = useMemo(() => resolveKnockoutTree(scored, thirdsOverride, fairPlay, LIVE_FEEDERS), [scored, thirdsOverride, fairPlay]);
  const groupStageComplete = useMemo(() => Object.keys(computeGroupOrders(scored, fairPlay)).length === 12, [scored, fairPlay]);
  const champion = tree.final?.winner ?? null;
  const filled = Object.values(knockoutLive).filter((m) => m.winner).length;

  // Teams for a slot: ONLY the REAL team, resolved from actual results. This is
  // the real-data tree — you bet one stage at a time on the match that ACTUALLY
  // exists. A slot whose feeding real matches haven't finished stays "waiting":
  // we deliberately do NOT fill it with the winner the user PICKED upstream, so
  // if you guessed the wrong advancer the next round still shows the REAL
  // matchup once that real result lands — never your prediction.
  const getTeams = (key: string): SlotTeams => {
    const slot = tree[key as KoSlotKey];
    return { team1: slot?.team1 ?? null, team2: slot?.team2 ?? null };
  };

  // Debounced per-slot save (Supabase enforces the per-match lock).
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const scheduleSave = (key: string) => {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      const v = useBettingStore.getState().knockoutLive[key] || { score1: null, score2: null, winner: null };
      saveLiveKnockout(key, v, lockAtFor(key as KoSlotKey, tree, schedule));
    }, 800);
  };
  const onChange = (key: string, data: Partial<KOValue>) => {
    const oldWinner = useBettingStore.getState().knockoutLive[key]?.winner ?? null;
    setLive(key, data);
    scheduleSave(key);
    // If the winner changed, the store cascade-cleared downstream picks — persist
    // those cleared slots too so the DB doesn't keep stale forward predictions.
    const newWinner = useBettingStore.getState().knockoutLive[key]?.winner ?? null;
    if (oldWinner && oldWinner !== newWinner) {
      let d: string | undefined = NEXT_MATCH[key];
      while (d) { scheduleSave(d); d = NEXT_MATCH[d]; }
    }
  };

  const renderMatch = (key: string, teams: SlotTeams, size: "sm" | "md") => {
    const real = tree[key as KoSlotKey];
    const realFinished = !!real?.winner && real?.score1 != null;
    const lockAt = lockAtFor(key as KoSlotKey, tree, schedule);
    let status: SlotStatus;
    if (!teams.team1 || !teams.team2) status = "waiting";
    else if (realFinished) status = "finished";
    else if (lockAt && now >= new Date(lockAt).getTime()) status = "locked";
    else status = "open";
    const realResult = realFinished ? { score1: real.score1, score2: real.score2, winner: real.winner } : null;
    return (
      <BracketMatchCell
        key={key}
        team1Code={teams.team1}
        team2Code={teams.team2}
        value={knockoutLive[key]}
        onChange={(d) => onChange(key, d)}
        size={size}
        editable={status === "open"}
        status={status}
        realResult={realResult}
      />
    );
  };

  if (loading) {
    return <PageTransition><LoadingPage /></PageTransition>;
  }

  return (
    <PageTransition>
      <div className="max-w-full mx-auto px-4 py-6 pb-24">
        <div className="mb-4">
          <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>עץ נתוני אמת</h1>
          <p className="text-lg text-gray-600 mt-1">ניחוש תוצאות על המשחקים האמיתיים — לפי הנתונים בזמן אמת</p>
        </div>

        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-2.5 text-[13px] text-blue-900">
          ניקוד על <strong>טוטו ותוצאה מדויקת</strong> בלבד. כל משחק נעול חצי שעה לפני שריקת הפתיחה, ונפתח אוטומטית בשלב הבא.
        </div>

        {!groupStageComplete ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-12 text-center">
            <h2 className="text-xl font-black text-gray-800 mb-2">ייפתח בתום שלב הבתים</h2>
            <p className="text-sm text-gray-500 max-w-sm mx-auto">
              בינתיים השלימו את <Link href="/knockout" className="text-blue-600 font-bold underline">עץ הסימולציה</Link>.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
                <span className="text-sm font-bold text-gray-700">ניחושים:</span>
                <span className="text-sm font-black text-blue-600" style={{ fontFamily: "var(--font-inter)" }}>{filled}/31</span>
              </div>
              <p className="text-sm text-gray-500">לחצו על נבחרת לבחירת העולה, +/- לתוצאה</p>
            </div>
            <BracketLayout getTeams={getTeams} renderMatch={renderMatch} champion={champion} r32LeftOrder={LIVE_R32L} r32RightOrder={LIVE_R32R} />
          </>
        )}
      </div>
    </PageTransition>
  );
}
