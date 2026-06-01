"use client";

// ============================================================================
// "עץ נתוני אמת" (Tree 2) — bet on the REAL knockout matchups.
//
// Opens after the group stage. Pulls the real bracket from /api/matches +
// /api/best-thirds via resolveKnockoutTree (the SAME resolver the scorer uses),
// so the teams the bettor predicts against are exactly what scoring will use.
// Each slot is editable until 1h before its real match kicks off; finished
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
  type KoSlotKey,
  type ScheduleMatch,
} from "@/lib/scoring/knockout-resolver";
import { lockAtFor } from "@/lib/tournament/ko-live-state";
import { LATER_FEEDERS } from "@/lib/tournament/knockout-derivation";
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
}

// slot → the downstream match it feeds (derived from the feeder map).
const NEXT_MATCH: Record<string, string> = {};
for (const [downstream, [f1, f2]] of Object.entries(LATER_FEEDERS)) {
  NEXT_MATCH[f1] = downstream;
  NEXT_MATCH[f2] = downstream;
}

export default function KnockoutLivePage() {
  const knockoutLive = useBettingStore((s) => s.knockoutLive);
  const setLive = useBettingStore((s) => s.setKnockoutLiveMatch);

  const [matches, setMatches] = useState<ApiMatch[]>([]);
  const [thirdsOverride, setThirdsOverride] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  // Pull real data — same fetch/derive pattern as the live view. Refresh
  // periodically so newly-finished matches cascade open the next round.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [m, t] = await Promise.all([
        fetch("/api/matches").then((r) => r.json()).catch(() => ({ matches: [] })),
        fetch("/api/best-thirds").then((r) => r.json()).catch(() => ({ override: null })),
      ]);
      if (!alive) return;
      setMatches((m.matches as ApiMatch[]) || []);
      const ov = t?.override;
      setThirdsOverride(Array.isArray(ov) && ov.length === 8 ? ov : null);
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
        })),
    [matches],
  );

  // Full list (incl. scheduled) for kickoff lookup + per-slot locking.
  const schedule: ScheduleMatch[] = useMemo(
    () => matches.map((m) => ({ homeTla: m.homeTla, awayTla: m.awayTla, date: m.date, status: m.status ?? null })),
    [matches],
  );

  const tree = useMemo(() => resolveKnockoutTree(scored, thirdsOverride), [scored, thirdsOverride]);
  const groupStageComplete = useMemo(() => Object.keys(computeGroupOrders(scored)).length === 12, [scored]);
  const champion = tree.final?.winner ?? knockoutLive.final?.winner ?? null;
  const filled = Object.values(knockoutLive).filter((m) => m.winner).length;

  // Teams for a slot: prefer the REAL team (once the feeding real match has
  // finished), otherwise fall back to the winner the user PICKED in the feeding
  // match — so the bracket fills forward exactly like the simulation tree, and
  // tie-winners advance. As real results land, the real team replaces the
  // predicted one and the user can re-edit (still editable until 1h pre-kickoff).
  const getTeams = (key: string): SlotTeams => {
    const slot = tree[key as KoSlotKey];
    const feeders = LATER_FEEDERS[key];
    const team1 = slot?.team1 ?? (feeders ? knockoutLive[feeders[0]]?.winner ?? null : null);
    const team2 = slot?.team2 ?? (feeders ? knockoutLive[feeders[1]]?.winner ?? null : null);
    return { team1, team2 };
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
          ניקוד על <strong>טוטו ותוצאה מדויקת</strong> בלבד. כל משחק נעול שעה לפני שריקת הפתיחה, ונפתח אוטומטית בשלב הבא.
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
            <BracketLayout getTeams={getTeams} renderMatch={renderMatch} champion={champion} />
          </>
        )}
      </div>
    </PageTransition>
  );
}
