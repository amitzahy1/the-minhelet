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
import { slotStatus, lockAtFor } from "@/lib/tournament/ko-live-state";
import { BracketLayout, BracketMatchCell, type KOValue, type SlotTeams } from "@/components/knockout/BracketLayout";
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
  const champion = tree.final?.winner ?? null;
  const filled = Object.values(knockoutLive).filter((m) => m.winner).length;

  const getTeams = (key: string): SlotTeams => {
    const s = tree[key as KoSlotKey];
    return { team1: s?.team1 ?? null, team2: s?.team2 ?? null };
  };

  // Debounced per-slot save (Supabase enforces the per-match lock).
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const onChange = (key: string, data: Partial<KOValue>) => {
    const cur = useBettingStore.getState().knockoutLive[key] || { score1: null, score2: null, winner: null };
    const merged: KOValue = { ...cur, ...data };
    setLive(key, data);
    const lockAt = lockAtFor(key as KoSlotKey, tree, schedule);
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      saveLiveKnockout(key, merged, lockAt);
    }, 800);
  };

  const renderMatch = (key: string, teams: SlotTeams, size: "sm" | "md") => {
    const status = slotStatus(key as KoSlotKey, tree, schedule, now);
    const real = tree[key as KoSlotKey];
    const realResult =
      status === "finished" && real ? { score1: real.score1, score2: real.score2, winner: real.winner } : null;
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

        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-[13px] text-blue-900 leading-relaxed">
          זהו העץ שנספר לניקוד תוצאות הנוק-אאוט. המשחקים מתעדכנים מהנתונים האמיתיים של הטורניר.
          כל משחק ניתן לעריכה <strong>עד שעה לפני שריקת הפתיחה</strong> — אין דד-ליין אחד. השלב הבא נפתח אוטומטית כשהמנצחות מהשלב הקודם ידועות.
        </div>

        {!groupStageComplete ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-12 text-center">
            <div className="text-5xl mb-4">⏳</div>
            <h2 className="text-xl font-black text-gray-800 mb-2">ייפתח בתום שלב הבתים</h2>
            <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
              עץ נתוני האמת ייפתח כשכל 12 הבתים יסיימו את משחקיהם ויקבעו 32 העולות (כולל 8 המקומות השלישיים הטובים).
              בינתיים — מלאו את <Link href="/knockout" className="text-blue-600 font-bold underline">עץ הסימולציה</Link> לבחירת העולות והאלופה.
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
