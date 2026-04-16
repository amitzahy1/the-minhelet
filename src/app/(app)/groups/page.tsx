"use client";

import Link from "next/link";
import { useCallback, useMemo } from "react";
import { useBettingStore } from "@/stores/betting-store";
import { GROUPS as GROUPS_RAW } from "@/lib/tournament/groups";
import { calculateStandings } from "@/lib/tournament/standings";
import { FLAGS as __FLAGS } from "@/lib/flags";
import { SwipeableGroups } from "@/components/shared/SwipeableGroups";
import { SlotMachineScore } from "@/components/shared/SlotMachineScore";
import type { GroupMatchPrediction } from "@/types";

// Groups data from tournament config
const GROUP_LETTERS = Object.keys(GROUPS_RAW);

function generateMatchups(codes: string[]) {
  const [a, b, c, d] = codes;
  return [{ h: a, a: b }, { h: c, a: d }, { h: a, a: c }, { h: d, a: b }, { h: d, a: a }, { h: b, a: c }];
}

function ScoreStepper({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0 rounded border border-gray-200 overflow-hidden">
      <button onClick={() => onChange(Math.max(0, (value ?? 0) - 1))} aria-label="הפחת"
        className="w-9 h-10 flex items-center justify-center bg-gray-50 text-gray-400 text-sm font-bold hover:bg-gray-100 active:bg-gray-200">−</button>
      <span className="w-7 h-8 flex items-center justify-center font-bold text-base tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
        {value !== null ? <SlotMachineScore value={value ?? 0} /> : <span className="text-gray-300 text-sm">-</span>}
      </span>
      <button onClick={() => onChange((value ?? -1) + 1)} aria-label="הוסף"
        className="w-9 h-10 flex items-center justify-center bg-gray-50 text-gray-400 text-sm font-bold hover:bg-gray-100 active:bg-gray-200">+</button>
    </div>
  );
}

function GroupView({ groupId }: { groupId: string }) {
  const teams = GROUPS_RAW[groupId];
  const groupState = useBettingStore((s) => s.groups[groupId]);
  const setGroupScore = useBettingStore((s) => s.setGroupScore);

  const codes = teams.map(t => t.code);
  const matchups = useMemo(() => generateMatchups(codes), [codes.join(",")]);

  // Calculate standings from current scores
  const standings = useMemo(() => {
    const predictions: GroupMatchPrediction[] = matchups.map((m, i) => ({
      match_id: i,
      home_team_code: m.h,
      away_team_code: m.a,
      home_goals: groupState.scores[i].home ?? 0,
      away_goals: groupState.scores[i].away ?? 0,
    }));
    const hasAny = groupState.scores.some(s => s.home !== null);
    if (!hasAny) return null;
    return calculateStandings(
      teams.map(t => ({ id: t.id, code: t.code })),
      predictions
    );
  }, [groupState.scores, matchups, teams]);

  const filledCount = groupState.scores.filter(s => s.home !== null && s.away !== null).length;
  const isComplete = filledCount === 6;

  const handleScore = useCallback((matchIdx: number, side: "home" | "away", value: number) => {
    setGroupScore(groupId, matchIdx, side, value);
  }, [groupId, setGroupScore]);

  const getTeam = (code: string) => teams.find(t => t.code === code)!;
  const getFlag = (code: string) => {
    const FLAGS = __FLAGS;
    return FLAGS[code] || "🏳️";
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${isComplete ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${(filledCount / 6) * 100}%` }}></div>
        </div>
        <span className="text-xs text-gray-400" style={{ fontFamily: "var(--font-inter)" }}>{filledCount}/6</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* RIGHT — Table */}
        <div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-800 flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-white">טבלה מחושבת</p>
                <p className="text-sm text-gray-300">מתעדכנת אוטומטית לפי חוקי FIFA</p>
              </div>
              {isComplete && <span className="text-sm text-green-300 font-medium bg-green-900/40 px-3 py-1 rounded-full border border-green-600/30">סופי</span>}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 bg-gray-50 text-xs font-semibold">
                  <th className="py-2.5 ps-4 text-start w-8">#</th>
                  <th className="py-2.5 text-start">קבוצה</th>
                  <th className="py-2.5 text-center w-8">מש</th>
                  <th className="py-2.5 text-center w-8">נצ</th>
                  <th className="py-2.5 text-center w-8">תק</th>
                  <th className="py-2.5 text-center w-8">הפ</th>
                  <th className="py-2.5 text-center w-12">שערים</th>
                  <th className="py-2.5 text-center w-12">הפרש</th>
                  <th className="py-2.5 pe-4 text-center w-12 font-bold">נקודות</th>
                </tr>
              </thead>
              <tbody>
                {(standings || teams.map(t => ({
                  team_code: t.code, position: 0, played: 0, won: 0, drawn: 0, lost: 0,
                  goals_for: 0, goals_against: 0, goal_difference: 0, points: 0, team_id: t.id, fair_play_score: 0,
                }))).map((row, i) => (
                  <tr key={row.team_code} className={`border-t border-gray-100 ${standings && i < 2 ? "bg-green-50/40" : standings && i === 2 ? "bg-amber-50/30" : ""}`}>
                    <td className="py-3 ps-4 font-bold text-gray-300 text-base">{i + 1}</td>
                    <td className="py-3">
                      <span className="flex items-center gap-2">
                        <span className="text-lg">{getFlag(row.team_code)}</span>
                        <span className="font-bold text-gray-900">{getTeam(row.team_code).name_he}</span>
                      </span>
                    </td>
                    <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.played}</td>
                    <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.won}</td>
                    <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.drawn}</td>
                    <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.lost}</td>
                    <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.goals_for}:{row.goals_against}</td>
                    <td className="text-center text-gray-600 font-semibold" style={{ fontFamily: "var(--font-inter)" }}>{row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}</td>
                    <td className="pe-4 text-center font-black text-gray-900 text-base" style={{ fontFamily: "var(--font-inter)" }}>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

        </div>

        {/* LEFT — Match bets */}
        <div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden lg:sticky lg:top-24">
            <div className="px-5 py-3 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50 flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-gray-800">הימורי תוצאות</p>
                <p className="text-sm text-gray-500">הזינו תוצאה מדויקת לכל משחק</p>
              </div>
              <div className="text-sm text-gray-500 text-end leading-relaxed" style={{ fontFamily: "var(--font-inter)" }}>
                <span className="block">טוטו: <strong className="text-blue-600">2 נק׳</strong></span>
                <span className="block">מדויקת: <strong className="text-green-600">+1 נק׳</strong></span>
              </div>
            </div>
            <div className="p-3 space-y-1.5">
              {matchups.map((m, i) => {
                const ht = getTeam(m.h);
                const at = getTeam(m.a);
                const isFilled = groupState.scores[i].home !== null && groupState.scores[i].away !== null;
                return (
                  <div key={i} className={`flex items-center rounded-lg border px-3 py-2 transition-colors ${
                    isFilled ? "bg-green-50/30 border-green-200" : "bg-gray-50/50 border-gray-100"
                  }`}>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-lg shrink-0">{getFlag(ht.code)}</span>
                      <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">{ht.name_he}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mx-1 sm:mx-2">
                      <ScoreStepper value={groupState.scores[i].home} onChange={(v) => handleScore(i, "home", v)} />
                      <span className="text-gray-300 text-sm">:</span>
                      <ScoreStepper value={groupState.scores[i].away} onChange={(v) => handleScore(i, "away", v)} />
                    </div>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                      <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">{at.name_he}</span>
                      <span className="text-lg shrink-0">{getFlag(at.code)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function GroupsPage() {
  const currentGroupIndex = useBettingStore((s) => s.currentGroupIndex);
  const setCurrentGroupIndex = useBettingStore((s) => s.setCurrentGroupIndex);
  const getCompletedGroupsCount = useBettingStore((s) => s.getCompletedGroupsCount);
  const getTotalFilledGroups = useBettingStore((s) => s.getTotalFilledGroups);

  const completedGroups = getCompletedGroupsCount();
  const totalFilled = getTotalFilledGroups();
  const groupId = GROUP_LETTERS[currentGroupIndex];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>שלב הבתים</h1>
        <p className="text-base text-gray-600 mt-1">סדרו את הקבוצות, הזינו תוצאות — הטבלה מתעדכנת אוטומטית לפי חוקי FIFA</p>
      </div>

      {/* Peer pressure — who hasn't finished? */}
      {completedGroups < 12 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <p className="text-sm font-bold text-amber-800">
            {completedGroups === 0
              ? "אף אחד עוד לא התחיל — תהיו הראשונים!"
              : `השלמת ${completedGroups}/12 בתים. ${12 - completedGroups} בתים נותרו — אל תישארו מאחור!`}
          </p>
        </div>
      )}

      {/* All-groups-complete CTA → next step */}
      {completedGroups === 12 && (
        <Link
          href="/knockout"
          className="mb-4 bg-gradient-to-l from-green-500 to-emerald-600 text-white rounded-xl px-5 py-4 flex items-center justify-between gap-3 shadow-lg shadow-green-500/20 hover:shadow-green-500/30 hover:scale-[1.01] transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎉</span>
            <div>
              <p className="text-base font-black">סיימת את שלב הבתים!</p>
              <p className="text-sm text-green-50">המשך לשלב 2 — עץ הטורניר</p>
            </div>
          </div>
          <span className="text-2xl font-black">←</span>
        </Link>
      )}

      {/* Compact progress */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm shrink-0">
          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${completedGroups === 12 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${(totalFilled / 72) * 100}%` }}></div>
          </div>
          <span className="text-xs font-bold text-gray-500" style={{ fontFamily: "var(--font-inter)" }}>{completedGroups}/12</span>
        </div>
        <div className="flex gap-1 sm:gap-1.5 flex-wrap">
          {GROUP_LETTERS.map((letter, i) => {
            const filled = useBettingStore.getState().getGroupFilledCount(letter);
            const done = filled === 6;
            return (
              <button key={letter} onClick={() => setCurrentGroupIndex(i)}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-[11px] sm:text-xs font-bold transition-all ${
                  i === currentGroupIndex ? "bg-gray-900 text-white shadow-md scale-110" :
                  done ? "bg-green-100 text-green-700 border border-green-200" :
                  filled > 0 ? "bg-blue-50 text-blue-600 border border-blue-200" :
                  "bg-gray-100 text-gray-400"
                }`} style={{ fontFamily: "var(--font-inter)" }}>
                {letter}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lock */}
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-gradient-to-l from-blue-50 to-white border border-blue-200 px-4 py-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 shrink-0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <p className="text-sm font-medium text-gray-700">ננעל ב-10.06.2026, 17:00 (שעון ישראל) · ניתן לשנות עד אז</p>
      </div>

      {/* Carousel header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentGroupIndex(Math.max(0, currentGroupIndex - 1))} disabled={currentGroupIndex === 0}
          className={`px-3 py-2 rounded-lg text-sm font-medium ${currentGroupIndex === 0 ? "text-gray-300" : "text-gray-600 hover:bg-gray-100"}`}>
          בית {currentGroupIndex > 0 ? GROUP_LETTERS[currentGroupIndex - 1] : ""} →
        </button>
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">בית {groupId}</h2>
          <p className="text-sm text-gray-400">{currentGroupIndex + 1} מתוך 12</p>
        </div>
        <button onClick={() => setCurrentGroupIndex(Math.min(11, currentGroupIndex + 1))} disabled={currentGroupIndex === 11}
          className={`px-3 py-2 rounded-lg text-sm font-medium ${currentGroupIndex === 11 ? "text-gray-300" : "text-gray-600 hover:bg-gray-100"}`}>
          ← בית {currentGroupIndex < 11 ? GROUP_LETTERS[currentGroupIndex + 1] : ""}
        </button>
      </div>

      {/* Group view */}
      <SwipeableGroups
        onSwipeLeft={() => setCurrentGroupIndex(Math.min(11, currentGroupIndex + 1))}
        onSwipeRight={() => setCurrentGroupIndex(Math.max(0, currentGroupIndex - 1))}
      >
        <GroupView groupId={groupId} />
      </SwipeableGroups>

      {/* Next button */}
      {currentGroupIndex < 11 && (
        <div className="mt-6 text-center">
          <button onClick={() => setCurrentGroupIndex(currentGroupIndex + 1)}
            className="px-8 py-3 rounded-xl bg-gray-900 text-white font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm">
            ← המשך לבית {GROUP_LETTERS[currentGroupIndex + 1]}
          </button>
        </div>
      )}

      {/* Last-group → next stage CTA */}
      {currentGroupIndex === 11 && completedGroups === 12 && (
        <div className="mt-6 text-center">
          <Link href="/knockout"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-l from-green-500 to-emerald-600 text-white font-bold text-base shadow-lg shadow-green-500/25 hover:shadow-green-500/35 hover:scale-[1.02] transition-all">
            <span>עבור לעץ הטורניר</span>
            <span className="text-xl">←</span>
          </Link>
        </div>
      )}
    </div>
  );
}
