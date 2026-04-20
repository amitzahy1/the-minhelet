"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useConfetti } from "@/hooks/useConfetti";
import { RegretMeter } from "@/components/shared/RegretMeter";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import { GROUPS } from "@/lib/tournament/groups";
import { MatchReactions, MOCK_REACTIONS } from "@/components/shared/MatchReactions";
import WhosAlive from "@/components/shared/WhosAlive";
import { useSharedData } from "@/hooks/useSharedData";
import { isLocked } from "@/lib/constants";
import type { MatchPrediction, BettorBracket, BettorAdvancement } from "@/lib/supabase/shared-data";

// Live page — shows matches from last 24h and next 12h
// In production: real-time updates from API-Football via Supabase Realtime

// Live match data — populated from DB once tournament starts.
// Kept as empty arrays so the page shows clean empty states before kickoff.
type LiveMatchRow = { id: number; status: string; minute: string; stage: string;
  home: { code: string; name: string; goals: number }; away: { code: string; name: string; goals: number };
  yourPrediction: string; yourStatus: "exact" | "wrong" | "toto"; potentialPts: string;
  friends: { name: string; pred: string }[]; };
type UpcomingMatchRow = { id: number; status: string; time: string; stage: string;
  home: { code: string; name: string }; away: { code: string; name: string }; yourPrediction: string | null; };
type FinishedMatchRow = { id: number; status: string; stage: string;
  home: { code: string; name: string; goals: number }; away: { code: string; name: string; goals: number };
  yourPrediction: string; yourStatus: "exact" | "toto" | "wrong"; pts: string; };

const MOCK_LIVE_MATCHES: LiveMatchRow[] = [];
const MOCK_UPCOMING: UpcomingMatchRow[] = [];
const MOCK_FINISHED: FinishedMatchRow[] = [];

// What-If data
const MOCK_WHATIF_MATCHES = [
  { id: 1, home: "ARG", away: "CZE", stage: "R32", homeName: "ארגנטינה", awayName: "צ׳כיה" },
  { id: 2, home: "FRA", away: "NOR", stage: "R32", homeName: "צרפת", awayName: "נורבגיה" },
  { id: 3, home: "BRA", away: "SWE", stage: "R32", homeName: "ברזיל", awayName: "שוודיה" },
  { id: 4, home: "ESP", away: "IRN", stage: "R32", homeName: "ספרד", awayName: "איראן" },
  { id: 5, home: "GER", away: "GHA", stage: "R32", homeName: "גרמניה", awayName: "גאנה" },
  { id: 6, home: "ENG", away: "PAN", stage: "R32", homeName: "אנגליה", awayName: "פנמה" },
  { id: 7, home: "POR", away: "JOR", stage: "R32", homeName: "פורטוגל", awayName: "ירדן" },
  { id: 8, home: "NED", away: "TUN", stage: "R32", homeName: "הולנד", awayName: "תוניסיה" },
];

const MOCK_BETTOR_PICKS: Record<string, Record<number, string>> = {
  "דני": { 1: "ARG", 2: "FRA", 3: "BRA", 4: "ESP", 5: "GER", 6: "ENG", 7: "POR", 8: "NED" },
  "יוני": { 1: "ARG", 2: "FRA", 3: "BRA", 4: "ESP", 5: "GER", 6: "ENG", 7: "POR", 8: "NED" },
  "דור דסא": { 1: "ARG", 2: "FRA", 3: "BRA", 4: "ESP", 5: "GER", 6: "ENG", 7: "POR", 8: "NED" },
  "אמית": { 1: "ARG", 2: "FRA", 3: "BRA", 4: "ESP", 5: "GER", 6: "ENG", 7: "POR", 8: "NED" },
  "רון ב": { 1: "CZE", 2: "FRA", 3: "BRA", 4: "ESP", 5: "GER", 6: "ENG", 7: "POR", 8: "NED" },
  "רון ג": { 1: "ARG", 2: "FRA", 3: "BRA", 4: "IRN", 5: "GER", 6: "PAN", 7: "POR", 8: "TUN" },
  "רועי": { 1: "ARG", 2: "FRA", 3: "BRA", 4: "ESP", 5: "GER", 6: "ENG", 7: "JOR", 8: "NED" },
  "עידן": { 1: "ARG", 2: "FRA", 3: "BRA", 4: "ESP", 5: "GER", 6: "ENG", 7: "POR", 8: "NED" },
  "אוהד": { 1: "ARG", 2: "FRA", 3: "BRA", 4: "ESP", 5: "GER", 6: "ENG", 7: "POR", 8: "NED" },
  "אורי": { 1: "ARG", 2: "NOR", 3: "BRA", 4: "ESP", 5: "GHA", 6: "ENG", 7: "POR", 8: "NED" },
};

// Mock bettor SCORE predictions for WhatIfTab (home-away for each match)
const MOCK_BETTOR_SCORE_PREDS: Record<string, Record<number, { home: number; away: number }>> = {
  "דני":     { 1: { home: 2, away: 0 }, 2: { home: 2, away: 1 }, 3: { home: 3, away: 0 }, 4: { home: 1, away: 0 }, 5: { home: 2, away: 1 }, 6: { home: 3, away: 0 }, 7: { home: 2, away: 0 }, 8: { home: 1, away: 0 } },
  "יוני":    { 1: { home: 1, away: 0 }, 2: { home: 1, away: 1 }, 3: { home: 2, away: 1 }, 4: { home: 2, away: 0 }, 5: { home: 1, away: 0 }, 6: { home: 2, away: 0 }, 7: { home: 1, away: 0 }, 8: { home: 2, away: 1 } },
  "דור דסא": { 1: { home: 3, away: 1 }, 2: { home: 2, away: 0 }, 3: { home: 1, away: 0 }, 4: { home: 2, away: 1 }, 5: { home: 3, away: 1 }, 6: { home: 1, away: 0 }, 7: { home: 2, away: 1 }, 8: { home: 1, away: 0 } },
  "אמית":   { 1: { home: 2, away: 1 }, 2: { home: 3, away: 0 }, 3: { home: 2, away: 0 }, 4: { home: 1, away: 0 }, 5: { home: 2, away: 0 }, 6: { home: 2, away: 1 }, 7: { home: 1, away: 0 }, 8: { home: 2, away: 0 } },
  "רון ב":  { 1: { home: 0, away: 1 }, 2: { home: 2, away: 0 }, 3: { home: 3, away: 1 }, 4: { home: 1, away: 0 }, 5: { home: 2, away: 0 }, 6: { home: 1, away: 0 }, 7: { home: 2, away: 0 }, 8: { home: 1, away: 1 } },
  "רון ג":  { 1: { home: 1, away: 0 }, 2: { home: 1, away: 0 }, 3: { home: 2, away: 0 }, 4: { home: 0, away: 2 }, 5: { home: 1, away: 0 }, 6: { home: 0, away: 1 }, 7: { home: 1, away: 0 }, 8: { home: 0, away: 1 } },
  "רועי":   { 1: { home: 2, away: 0 }, 2: { home: 2, away: 0 }, 3: { home: 1, away: 0 }, 4: { home: 3, away: 0 }, 5: { home: 2, away: 1 }, 6: { home: 2, away: 0 }, 7: { home: 0, away: 1 }, 8: { home: 2, away: 0 } },
  "עידן":   { 1: { home: 1, away: 0 }, 2: { home: 2, away: 1 }, 3: { home: 2, away: 0 }, 4: { home: 1, away: 0 }, 5: { home: 1, away: 0 }, 6: { home: 3, away: 1 }, 7: { home: 2, away: 0 }, 8: { home: 1, away: 0 } },
  "אוהד":   { 1: { home: 3, away: 0 }, 2: { home: 1, away: 0 }, 3: { home: 2, away: 1 }, 4: { home: 2, away: 0 }, 5: { home: 2, away: 0 }, 6: { home: 2, away: 0 }, 7: { home: 1, away: 0 }, 8: { home: 3, away: 0 } },
  "אורי":   { 1: { home: 2, away: 1 }, 2: { home: 0, away: 2 }, 3: { home: 1, away: 0 }, 4: { home: 1, away: 0 }, 5: { home: 0, away: 1 }, 6: { home: 1, away: 0 }, 7: { home: 2, away: 0 }, 8: { home: 2, away: 1 } },
};

export default function LivePage() {
  const fireConfetti = useConfetti();
  const { predictions } = useSharedData();

  useEffect(() => {
    const hasExact = MOCK_LIVE_MATCHES.some(m => m.yourStatus === "exact");
    if (hasExact) {
      const timer = setTimeout(fireConfetti, 500);
      return () => clearTimeout(timer);
    }
  }, [fireConfetti]);

  // Focused page — only live/upcoming/finished matches. The other tabs
  // ("מה אם", "מי חי", "סימולציה") moved into the compare page as
  // additional tabs, so this page is a single-purpose live ticker.
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6 flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>לייב</h1>
      </div>
      <LiveTab predictions={predictions} />
    </div>
  );
}

function LiveTab({ predictions }: { predictions: MatchPrediction[] }) {
  // Build friends list per match from real predictions, or fall back to mock
  const hasRealPredictions = predictions.length > 0;

  function getFriendsForMatch(matchId: number, _mockFriends: { name: string; pred: string }[]) {
    if (!hasRealPredictions) return [];
    const matchPreds = predictions.filter(p => p.matchId === matchId);
    if (matchPreds.length === 0) return [];
    return matchPreds.map(p => ({
      name: p.displayName,
      pred: `${p.predictedHomeGoals}-${p.predictedAwayGoals}`,
    }));
  }

  const hasAnyMatches = MOCK_LIVE_MATCHES.length + MOCK_UPCOMING.length + MOCK_FINISHED.length > 0;

  if (!hasAnyMatches) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 py-12 text-center">
        <div className="text-6xl mb-4">⚽</div>
        <h2 className="text-xl font-black text-gray-800 mb-2">הטורניר עוד לא התחיל</h2>
        <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
          המשחקים יופיעו כאן כשהטורניר יתחיל.<br/>
          בינתיים — תוודאו שהברקט שלכם מלא.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* LIVE NOW */}
      {MOCK_LIVE_MATCHES.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            עכשיו בשידור חי
          </h2>
          <div className="space-y-4">
            {MOCK_LIVE_MATCHES.map(m => {
              const friends = getFriendsForMatch(m.id, m.friends);
              return (
              <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-center gap-2 py-2.5 bg-red-50 border-b border-red-100">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                  <span className="text-sm font-bold text-red-600 tracking-wider" style={{ fontFamily: "var(--font-inter)" }}>LIVE</span>
                  <span className="text-sm text-red-400">{m.minute}</span>
                </div>
                <div className="px-6 py-5 flex items-center justify-between">
                  <div className="flex flex-col items-center gap-2 w-28">
                    <span className="text-5xl">{getFlag(m.home.code)}</span>
                    <span className="font-bold text-base text-gray-800">{m.home.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-6xl tabular-nums text-gray-900" style={{ fontFamily: "var(--font-inter)" }}>{m.home.goals}</span>
                    <span className="text-gray-300 text-4xl font-light">-</span>
                    <span className="font-black text-6xl tabular-nums text-gray-900" style={{ fontFamily: "var(--font-inter)" }}>{m.away.goals}</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 w-28">
                    <span className="text-5xl">{getFlag(m.away.code)}</span>
                    <span className="font-bold text-base text-gray-800">{m.away.name}</span>
                  </div>
                </div>
                {/* Your prediction */}
                <div className={`border-t px-5 py-3 ${m.yourStatus === "exact" ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-600">הניחוש שלך: </span>
                      <span className="text-base font-black text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{m.yourPrediction}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${
                      m.yourStatus === "exact" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {m.yourStatus === "exact" ? "תוצאה מדויקת!" : "לא תואם"}
                    </span>
                  </div>
                  {m.yourStatus === "exact" && (
                    <p className="text-sm text-green-600 font-semibold mt-1">אם נגמר ככה: <strong>{m.potentialPts} נקודות</strong></p>
                  )}
                </div>
                {/* What you need */}
                {m.yourStatus !== "exact" && (
                  <div className="border-t border-blue-100 px-5 py-2.5 bg-blue-50/50">
                    {(() => {
                      const [ph, pa] = m.yourPrediction.split("-").map(Number);
                      const ah = m.home.goals, aa = m.away.goals;
                      const predDir = ph > pa ? "1" : pa > ph ? "2" : "X";
                      const actDir = ah > aa ? "1" : aa > ah ? "2" : "X";
                      const hasToto = predDir === actDir;
                      const homeDiff = ph - ah;
                      const awayDiff = pa - aa;

                      let mainText = "";
                      let subText = "";

                      if (homeDiff === 0 && awayDiff === 0) {
                        mainText = "תוצאה מדויקת!";
                      } else if (hasToto) {
                        mainText = "כיוון נכון! ";
                        if (homeDiff !== 0 && awayDiff !== 0) {
                          mainText += `צריך ${ph}-${pa} למדויקת`;
                        } else if (homeDiff !== 0) {
                          mainText += `צריך ${homeDiff > 0 ? `עוד ${homeDiff} גול ל${m.home.name}` : `ש${m.home.name} תספוג ${-homeDiff} פחות`} למדויקת`;
                        } else {
                          mainText += `צריך ${awayDiff > 0 ? `עוד ${awayDiff} גול ל${m.away.name}` : `ש${m.away.name} תספוג ${-awayDiff} פחות`} למדויקת`;
                        }
                        subText = `(+2 נק׳ על כיוון, +1 על מדויקת)`;
                      } else {
                        if (predDir === "1") mainText = `ניחשת ניצחון ל${m.home.name} — צריך שתתקדם`;
                        else if (predDir === "2") mainText = `ניחשת ניצחון ל${m.away.name} — צריך שתתקדם`;
                        else mainText = `ניחשת תיקו — צריך השוואה`;
                        subText = `(כרגע 0 נק׳ על המשחק הזה)`;
                      }

                      return (
                        <>
                          <p className="text-sm font-bold text-blue-700">{mainText}</p>
                          {subText && <p className="text-xs text-blue-500 mt-0.5">{subText}</p>}
                        </>
                      );
                    })()}
                  </div>
                )}
                {/* All bettors predictions — only after lock */}
                {isLocked() && <div className="border-t border-gray-100 px-5 py-3">
                  <p className="text-xs text-gray-500 mb-2 font-bold">כל המהמרים:</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(hasRealPredictions ? friends : [...friends, { name: "אמית", pred: m.yourPrediction }]).map(f => {
                      const [fh, fa] = f.pred.split("-").map(Number);
                      const isExact = fh === m.home.goals && fa === m.away.goals;
                      const predResult = fh > fa ? "1" : fa > fh ? "2" : "X";
                      const actualResult = m.home.goals > m.away.goals ? "1" : m.away.goals > m.home.goals ? "2" : "X";
                      const isToto = predResult === actualResult;
                      const bgColor = isExact ? "bg-green-100 border-green-300 text-green-800" :
                                     isToto ? "bg-gray-100 border-gray-300 text-gray-700" :
                                     "bg-red-50 border-red-200 text-red-700";
                      return (
                        <div key={f.name} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs font-bold ${bgColor}`}>
                          <span>{f.name}</span>
                          <span style={{ fontFamily: "var(--font-inter)" }}>{f.pred} {isExact && "🎯"}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-3 mt-2 text-[10px] text-gray-400">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span> מדויקת</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-400"></span> כיוון נכון</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> טעה</span>
                  </div>
                </div>}
                {/* Match Reactions */}
                <MatchReactions
                  matchId={String(m.id)}
                  reactions={MOCK_REACTIONS.reactions}
                  comments={MOCK_REACTIONS.comments}
                />
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* UPCOMING */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-3">קרוב — היום</h2>
        <div className="space-y-3">
          {MOCK_UPCOMING.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getFlag(m.home.code)}</span>
                <span className="font-bold text-base text-gray-800">{m.home.name}</span>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-gray-400" style={{ fontFamily: "var(--font-inter)" }}>{m.time}</p>
                <p className="text-xs text-gray-400">{m.stage}</p>
                {m.yourPrediction ? (
                  <p className="text-xs text-green-600 font-bold mt-1">ניחוש: {m.yourPrediction}</p>
                ) : (
                  <p className="text-xs text-amber-600 font-bold mt-1">טרם ניחשת</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-base text-gray-800">{m.away.name}</span>
                <span className="text-2xl">{getFlag(m.away.code)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FINISHED */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-3">הסתיימו — אתמול</h2>
        <div className="space-y-3">
          {MOCK_FINISHED.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getFlag(m.home.code)}</span>
                  <span className="font-bold text-base">{m.home.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-2xl tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{m.home.goals}</span>
                  <span className="text-gray-300 text-xl">-</span>
                  <span className="font-black text-2xl tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{m.away.goals}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-base">{m.away.name}</span>
                  <span className="text-2xl">{getFlag(m.away.code)}</span>
                </div>
              </div>
              <div className={`px-5 py-2 border-t flex items-center justify-between ${m.yourStatus === "exact" ? "bg-green-50 border-green-100" : "bg-blue-50 border-blue-100"}`}>
                <span className="text-sm text-gray-600">ניחוש: <strong>{m.yourPrediction}</strong></span>
                <span className={`text-sm font-bold ${m.yourStatus === "exact" ? "text-green-600" : "text-blue-600"}`}>
                  {m.yourStatus === "exact" ? "מדויקת! " : "טוטו נכון "}{m.pts}
                </span>
              </div>
              {m.yourStatus !== "exact" && (
                <RegretMeter
                  yourPrediction={{ home: parseInt(m.yourPrediction.split("-")[0]) || 0, away: parseInt(m.yourPrediction.split("-")[1]) || 0 }}
                  actualResult={{ home: m.home.goals, away: m.away.goals }}
                  stage="GROUP"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bracket health */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">בריאות העץ שלך</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { value: "8/12", label: "בתים נכונים", color: "bg-green-50 border-green-200 text-green-600" },
            { value: "26/32", label: "עולות מהבתים", color: "bg-blue-50 border-blue-200 text-blue-600" },
            { value: "🇦🇷", label: "האלוף שלך חי", color: "bg-amber-50 border-amber-200 text-amber-600" },
            { value: "154", label: "סה״כ נקודות", color: "bg-purple-50 border-purple-200 text-purple-600" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 text-center ${s.color}`}>
              <p className="text-2xl font-black" style={{ fontFamily: "var(--font-inter)" }}>{s.value}</p>
              <p className="text-xs font-bold mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// Scoring config per stage (from migration defaults)
function getScoringConfig(stage: string): { toto: number; exact: number } {
  switch (stage) {
    case "GROUP": return { toto: 2, exact: 1 };
    case "R32": case "R16": return { toto: 3, exact: 1 };
    case "QF": return { toto: 3, exact: 1 };
    case "SF": return { toto: 3, exact: 2 };
    case "THIRD": return { toto: 3, exact: 1 };
    case "FINAL": return { toto: 4, exact: 2 };
    default: return { toto: 2, exact: 1 };
  }
}

function ScoreStepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold text-gray-400">{label}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-lg flex items-center justify-center transition-colors">-</button>
        <span className="w-10 text-center font-black text-2xl tabular-nums text-gray-900" style={{ fontFamily: "var(--font-inter)" }}>{value}</span>
        <button onClick={() => onChange(Math.min(15, value + 1))}
          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-lg flex items-center justify-center transition-colors">+</button>
      </div>
    </div>
  );
}

function WhatIfTab({ brackets }: { brackets: BettorBracket[] }) {
  const [selectedMatch, setSelectedMatch] = useState(MOCK_WHATIF_MATCHES[0]);
  const [homeGoals, setHomeGoals] = useState<number>(0);
  const [awayGoals, setAwayGoals] = useState<number>(0);
  const [hasSimulated, setHasSimulated] = useState(false);

  // Build bettor picks from real brackets data, or fall back to mock
  const hasRealBrackets = brackets.length > 0;

  const bettorPicks: Record<string, Record<number, string>> = useMemo(() => {
    if (!hasRealBrackets) return {};
    const picks: Record<string, Record<number, string>> = {};
    for (const b of brackets) {
      const userPicks: Record<number, string> = {};
      for (const [matchKey, matchData] of Object.entries(b.knockoutTree)) {
        const matchNum = parseInt(matchKey, 10);
        if (!isNaN(matchNum) && matchData.winner) {
          userPicks[matchNum] = matchData.winner;
        }
      }
      if (Object.keys(userPicks).length > 0) {
        picks[b.displayName] = userPicks;
      }
    }
    return picks;
  }, [brackets, hasRealBrackets]);

  const setQuickResult = useCallback((h: number, a: number) => {
    setHomeGoals(h);
    setAwayGoals(a);
    setHasSimulated(true);
  }, []);

  // Auto-simulate when score changes
  useEffect(() => {
    if (homeGoals > 0 || awayGoals > 0) setHasSimulated(true);
  }, [homeGoals, awayGoals]);

  const impact = useMemo(() => {
    const { toto: totoPoints, exact: exactPoints } = getScoringConfig(selectedMatch.stage);
    const simDir = homeGoals > awayGoals ? "1" : awayGoals > homeGoals ? "2" : "X";
    const simWinner = homeGoals > awayGoals ? selectedMatch.home : awayGoals > homeGoals ? selectedMatch.away : null;
    const isKnockout = selectedMatch.stage !== "GROUP";

    return Object.entries(MOCK_BETTOR_SCORE_PREDS).map(([name, preds]) => {
      const pred = preds[selectedMatch.id];
      if (!pred) return null;

      const predDir = pred.home > pred.away ? "1" : pred.away > pred.home ? "2" : "X";
      const totoCorrect = predDir === simDir;
      const exactCorrect = pred.home === homeGoals && pred.away === awayGoals;
      const points = (totoCorrect ? totoPoints : 0) + (exactCorrect ? exactPoints : 0);

      // Bracket check for knockout
      const bracketPick = bettorPicks[name]?.[selectedMatch.id];
      const bracketAlive = !isKnockout || !simWinner ? null : bracketPick === simWinner;

      return {
        name,
        predHome: pred.home,
        predAway: pred.away,
        totoCorrect,
        exactCorrect,
        points,
        bracketAlive,
        bracketPick,
        isYou: name === "אמית",
      };
    }).filter(Boolean).sort((a, b) => b!.points - a!.points) as {
      name: string; predHome: number; predAway: number; totoCorrect: boolean;
      exactCorrect: boolean; points: number; bracketAlive: boolean | null;
      bracketPick: string | undefined; isYou: boolean;
    }[];
  }, [selectedMatch, homeGoals, awayGoals, hasSimulated, bettorPicks]);

  const totalPoints = impact?.reduce((s, i) => s + i.points, 0) || 0;
  const exactCount = impact?.filter(i => i.exactCorrect).length || 0;
  const totoCount = impact?.filter(i => i.totoCorrect && !i.exactCorrect).length || 0;

  return (
    <>
      {/* Score input */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-3">
        <div className="px-4 py-2.5 bg-blue-50/50 border-b border-blue-100/50 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-800">
            {getFlag(selectedMatch.home)} {selectedMatch.homeName} vs {selectedMatch.awayName} {getFlag(selectedMatch.away)}
          </span>
          <span className="text-[10px] text-gray-400 font-bold">{selectedMatch.stage}</span>
        </div>
        <div className="px-4 py-4 flex items-center justify-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <span className="text-3xl">{getFlag(selectedMatch.home)}</span>
            <span className="text-xs font-bold text-gray-700">{selectedMatch.homeName}</span>
          </div>
          <ScoreStepper value={homeGoals} onChange={(v) => { setHomeGoals(v); setHasSimulated(true); }} label="גולים" />
          <span className="text-3xl text-gray-300 font-light mt-4">:</span>
          <ScoreStepper value={awayGoals} onChange={(v) => { setAwayGoals(v); setHasSimulated(true); }} label="גולים" />
          <div className="flex flex-col items-center gap-1">
            <span className="text-3xl">{getFlag(selectedMatch.away)}</span>
            <span className="text-xs font-bold text-gray-700">{selectedMatch.awayName}</span>
          </div>
        </div>
        {/* Quick buttons */}
        <div className="px-4 pb-3 flex gap-2 justify-center">
          <button onClick={() => setQuickResult(1, 0)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            {selectedMatch.homeName} מנצחת 1-0
          </button>
          <button onClick={() => setQuickResult(0, 1)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            {selectedMatch.awayName} מנצחת 0-1
          </button>
          <button onClick={() => setQuickResult(1, 1)}
            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-600 hover:bg-gray-50 transition-colors">
            תיקו 1-1
          </button>
        </div>
      </div>

      {/* Bettor predictions — always visible, points show when simulated */}
      {impact && impact.length > 0 && (
        <div className="space-y-2 mb-4">
          {/* Summary — only when simulated */}
          {hasSimulated && (
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
                <p className="text-xl font-black text-amber-600">{exactCount}</p>
                <p className="text-[10px] font-bold text-amber-700">מדויקת</p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                <p className="text-xl font-black text-green-600">{totoCount}</p>
                <p className="text-[10px] font-bold text-green-700">טוטו בלבד</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 text-center">
                <p className="text-xl font-black text-purple-600">{totalPoints}</p>
                <p className="text-[10px] font-bold text-purple-700">סה״כ נק׳</p>
              </div>
            </div>
          )}

          {!hasSimulated && (
            <p className="text-xs text-gray-400 text-center py-2">הזינו תוצאה למעלה כדי לראות ניקוד</p>
          )}

          {/* Per-bettor results */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-100">
              {impact.map(i => (
                <div key={i.name} className={`flex items-center gap-2 px-3 py-2.5 ${i.isYou ? "bg-blue-50/40" : ""}`}>
                  {/* Toto/exact indicators */}
                  <span className="flex gap-0.5">
                    {i.totoCorrect && <span className="text-green-500 text-sm" title="טוטו נכון">&#10003;</span>}
                    {i.exactCorrect && <span className="text-amber-500 text-sm" title="מדויקת">&#9733;</span>}
                    {!i.totoCorrect && <span className="text-red-400 text-sm">&#10007;</span>}
                  </span>
                  <span className="font-bold text-xs text-gray-900 flex-1">{i.name}</span>
                  <span className="text-xs text-gray-500 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
                    {i.predHome}-{i.predAway}
                  </span>
                  {i.bracketAlive !== null && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      i.bracketAlive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}>
                      {i.bracketAlive ? "עץ חי" : "עץ מת"}
                    </span>
                  )}
                  <span className={`text-sm font-black tabular-nums min-w-[28px] text-left ${
                    !hasSimulated ? "text-gray-300" : i.points > 0 ? "text-green-600" : "text-gray-300"
                  }`} style={{ fontFamily: "var(--font-inter)" }}>
                    {hasSimulated ? `+${i.points}` : "-"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Legend */}
          <div className="flex gap-3 text-[10px] text-gray-400 px-1">
            <span className="flex items-center gap-1"><span className="text-green-500">&#10003;</span> טוטו נכון</span>
            <span className="flex items-center gap-1"><span className="text-amber-500">&#9733;</span> מדויקת</span>
            <span className="flex items-center gap-1"><span className="text-red-400">&#10007;</span> טעה</span>
          </div>
        </div>
      )}

      {/* Match selector */}
      <details className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <summary className="px-3 py-2 cursor-pointer text-sm font-bold text-gray-600 hover:bg-gray-50">החלף משחק</summary>
        <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1 border-t border-gray-100">
          {MOCK_WHATIF_MATCHES.map(m => (
            <button key={m.id} onClick={() => { setSelectedMatch(m); setHomeGoals(0); setAwayGoals(0); setHasSimulated(false); }}
              className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs transition-all ${
                selectedMatch.id === m.id ? "border-blue-300 bg-blue-50" : "border-gray-100 hover:bg-gray-50"
              }`}>
              <span>{getFlag(m.home)} {m.homeName}</span>
              <span className="text-gray-300">vs</span>
              <span>{m.awayName} {getFlag(m.away)}</span>
            </button>
          ))}
        </div>
      </details>
    </>
  );
}

const MOCK_WHOS_ALIVE_DATA = [
  {
    name: "אמית",
    champion: "ARG",
    semifinalists: ["ARG", "GER", "FRA", "BRA"],
    quarterfinalists: ["ARG", "GER", "FRA", "BRA", "ESP", "ENG", "NED", "POR"],
    alive: ["ARG", "FRA", "BRA", "ESP", "ENG", "NED", "POR"],
    dead: ["GER"],
  },
  {
    name: "דני",
    champion: "ARG",
    semifinalists: ["ARG", "FRA", "BRA", "GER"],
    quarterfinalists: ["ARG", "FRA", "BRA", "GER", "ESP", "POR", "ENG", "NED"],
    alive: ["ARG", "FRA", "BRA", "ESP", "ENG", "NED"],
    dead: ["GER", "POR"],
  },
  {
    name: "יוני",
    champion: "FRA",
    semifinalists: ["FRA", "BRA", "ENG", "ARG"],
    quarterfinalists: ["FRA", "BRA", "ENG", "ARG", "GER", "ESP", "NED", "POR"],
    alive: ["FRA", "BRA", "ENG", "ARG", "ESP", "NED", "POR"],
    dead: ["GER"],
  },
  {
    name: "רון ב",
    champion: "ENG",
    semifinalists: ["ENG", "FRA", "BRA", "POR"],
    quarterfinalists: ["ENG", "FRA", "BRA", "POR", "ARG", "GER", "ESP", "NED"],
    alive: ["ENG", "FRA", "BRA", "ARG", "ESP", "NED"],
    dead: ["POR", "GER"],
  },
  {
    name: "רון ג",
    champion: "ESP",
    semifinalists: ["ESP", "ARG", "FRA", "BRA"],
    quarterfinalists: ["ESP", "ARG", "FRA", "BRA", "GER", "ENG", "NED", "POR"],
    alive: ["ESP", "ARG", "FRA", "BRA", "ENG", "NED", "POR"],
    dead: ["GER"],
  },
  {
    name: "רועי",
    champion: "GER",
    semifinalists: ["GER", "FRA", "ARG", "BRA"],
    quarterfinalists: ["GER", "FRA", "ARG", "BRA", "ESP", "ENG", "NED", "POR"],
    alive: ["FRA", "ARG", "BRA", "ESP", "ENG", "NED", "POR"],
    dead: ["GER"],
  },
  {
    name: "עידן",
    champion: "FRA",
    semifinalists: ["FRA", "ARG", "BRA", "ENG"],
    quarterfinalists: ["FRA", "ARG", "BRA", "ENG", "GER", "ESP", "NED", "POR"],
    alive: ["FRA", "ARG", "BRA", "ENG", "ESP", "NED", "POR"],
    dead: ["GER"],
  },
  {
    name: "אוהד",
    champion: "ARG",
    semifinalists: ["ARG", "BRA", "FRA", "ESP"],
    quarterfinalists: ["ARG", "BRA", "FRA", "ESP", "GER", "ENG", "NED", "POR"],
    alive: ["ARG", "BRA", "FRA", "ESP", "ENG", "NED", "POR"],
    dead: ["GER"],
  },
];

// --- Simulation Tab: group-stage scoring simulator ---

// Generate round-robin matches for a group of 4 teams (6 matches)
function groupMatches(groupId: string): { key: string; home: string; away: string }[] {
  const teams = GROUPS[groupId];
  if (!teams) return [];
  const pairs: { key: string; home: string; away: string }[] = [];
  for (let i = 0; i < teams.length; i++)
    for (let j = i + 1; j < teams.length; j++)
      pairs.push({ key: `${groupId}-${teams[i].code}-${teams[j].code}`, home: teams[i].code, away: teams[j].code });
  return pairs;
}

const ALL_GROUP_MATCHES = Object.keys(GROUPS).flatMap(g => groupMatches(g));

// Deterministic seeded random: hash bettor name + match key into 0..max-1
function seededGoals(name: string, matchKey: string, max: number): number {
  let h = 0;
  const s = name + matchKey;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return ((h < 0 ? -h : h) % max);
}

const SIM_BETTORS = ["דני", "יוני", "אמית", "דור דסא", "רון ב", "רון ג", "רועי", "עידן"];

// Pre-compute mock predictions: each bettor has a home/away prediction for every group match
const MOCK_SIM_PREDS: Record<string, Record<string, { home: number; away: number }>> = {};
for (const name of SIM_BETTORS) {
  MOCK_SIM_PREDS[name] = {};
  for (const m of ALL_GROUP_MATCHES) {
    MOCK_SIM_PREDS[name][m.key] = {
      home: seededGoals(name, m.key + "h", 4),
      away: seededGoals(name, m.key + "a", 3),
    };
  }
}

const TOTO_PTS = 2;
const EXACT_PTS = 1;

// Knockout matches for simulation
const KO_MATCHES = [
  { key: "ko_r32_1", home: "MEX", away: "QAT", round: "R32", homeName: "מקסיקו", awayName: "קטאר" },
  { key: "ko_r32_2", home: "BRA", away: "HAI", round: "R32", homeName: "ברזיל", awayName: "האיטי" },
  { key: "ko_r32_3", home: "ARG", away: "AUS", round: "R32", homeName: "ארגנטינה", awayName: "אוסטרליה" },
  { key: "ko_r32_4", home: "FRA", away: "IRQ", round: "R32", homeName: "צרפת", awayName: "עיראק" },
  { key: "ko_r32_5", home: "GER", away: "CUR", round: "R32", homeName: "גרמניה", awayName: "קוראסאו" },
  { key: "ko_r32_6", home: "NED", away: "TUN", round: "R32", homeName: "הולנד", awayName: "תוניסיה" },
  { key: "ko_r32_7", home: "BEL", away: "NZL", round: "R32", homeName: "בלגיה", awayName: "ניו זילנד" },
  { key: "ko_r32_8", home: "ESP", away: "CPV", round: "R32", homeName: "ספרד", awayName: "כף ורדה" },
  { key: "ko_r16_1", home: "MEX", away: "BRA", round: "R16", homeName: "מקסיקו", awayName: "ברזיל" },
  { key: "ko_r16_2", home: "ARG", away: "FRA", round: "R16", homeName: "ארגנטינה", awayName: "צרפת" },
  { key: "ko_r16_3", home: "GER", away: "NED", round: "R16", homeName: "גרמניה", awayName: "הולנד" },
  { key: "ko_r16_4", home: "BEL", away: "ESP", round: "R16", homeName: "בלגיה", awayName: "ספרד" },
  { key: "ko_qf_1", home: "BRA", away: "ARG", round: "QF", homeName: "ברזיל", awayName: "ארגנטינה" },
  { key: "ko_qf_2", home: "GER", away: "ESP", round: "QF", homeName: "גרמניה", awayName: "ספרד" },
  { key: "ko_sf_1", home: "ARG", away: "ESP", round: "SF", homeName: "ארגנטינה", awayName: "ספרד" },
  { key: "ko_final", home: "ARG", away: "FRA", round: "FINAL", homeName: "ארגנטינה", awayName: "צרפת" },
];

const KO_SCORING: Record<string, { toto: number; exact: number }> = {
  R32: { toto: 3, exact: 1 }, R16: { toto: 3, exact: 1 },
  QF: { toto: 3, exact: 1 }, SF: { toto: 3, exact: 2 }, FINAL: { toto: 4, exact: 2 },
};

// Mock bettor knockout predictions
const MOCK_SIM_KO_PREDS: Record<string, Record<string, { home: number; away: number }>> = {};
for (const name of SIM_BETTORS) {
  MOCK_SIM_KO_PREDS[name] = {};
  for (const m of KO_MATCHES) {
    MOCK_SIM_KO_PREDS[name][m.key] = { home: seededGoals(name, m.key + "h", 3), away: seededGoals(name, m.key + "a", 2) };
  }
}

// Mock bettor special bets
const SPECIAL_CATS = [
  { key: "topScorer", label: "מלך שערים", pts: 9 },
  { key: "topAssists", label: "מלך בישולים", pts: 7 },
  { key: "bestAttack", label: "התקפה הכי טובה", pts: 6 },
  { key: "dirtiestTeam", label: "הכי כסחנית", pts: 5 },
  { key: "prolificGroup", label: "בית פורה", pts: 5 },
  { key: "driestGroup", label: "בית יבש", pts: 5 },
  { key: "matchup", label: "מאצ׳אפ", pts: 5 },
  { key: "penalties", label: "פנדלים", pts: 5 },
] as const;

const MOCK_BETTOR_SPECIALS: Record<string, Record<string, string>> = {
  "דני": { topScorer: "Lautaro", topAssists: "Griezmann", bestAttack: "BRA", dirtiestTeam: "URU", prolificGroup: "C", driestGroup: "H", matchup: "1", penalties: "OVER" },
  "יוני": { topScorer: "Mbappé", topAssists: "Pedri", bestAttack: "ARG", dirtiestTeam: "MAR", prolificGroup: "A", driestGroup: "G", matchup: "2", penalties: "UNDER" },
  "דור דסא": { topScorer: "Vinícius Jr.", topAssists: "Musiala", bestAttack: "FRA", dirtiestTeam: "KSA", prolificGroup: "B", driestGroup: "L", matchup: "1", penalties: "OVER" },
  "אמית": { topScorer: "Haaland", topAssists: "Messi", bestAttack: "GER", dirtiestTeam: "MAR", prolificGroup: "C", driestGroup: "H", matchup: "X", penalties: "UNDER" },
  "רון ב": { topScorer: "Kane", topAssists: "Rodrygo", bestAttack: "ESP", dirtiestTeam: "IRN", prolificGroup: "D", driestGroup: "K", matchup: "1", penalties: "OVER" },
  "רון ג": { topScorer: "Ronaldo", topAssists: "Mbappé", bestAttack: "ARG", dirtiestTeam: "AUS", prolificGroup: "A", driestGroup: "J", matchup: "2", penalties: "UNDER" },
  "רועי": { topScorer: "Isak", topAssists: "Bellingham", bestAttack: "FRA", dirtiestTeam: "URU", prolificGroup: "B", driestGroup: "H", matchup: "1", penalties: "OVER" },
  "עידן": { topScorer: "Álvarez", topAssists: "B. Fernandes", bestAttack: "ARG", dirtiestTeam: "CRO", prolificGroup: "C", driestGroup: "G", matchup: "X", penalties: "UNDER" },
};

function SimulationTab() {
  const [results, setResults] = useState<Record<string, { home: number; away: number }>>({});
  const [koResults, setKoResults] = useState<Record<string, { home: number; away: number }>>({});
  const [specialResults, setSpecialResults] = useState<Record<string, string>>({});

  const setGoal = useCallback((key: string, side: "home" | "away", val: number) => {
    setResults(prev => {
      const cur = prev[key] || { home: 0, away: 0 };
      return { ...prev, [key]: { ...cur, [side]: Math.max(0, Math.min(15, val)) } };
    });
  }, []);

  const setKoGoal = useCallback((key: string, side: "home" | "away", val: number) => {
    setKoResults(prev => {
      const cur = prev[key] || { home: 0, away: 0 };
      return { ...prev, [key]: { ...cur, [side]: Math.max(0, Math.min(15, val)) } };
    });
  }, []);

  // Compute leaderboard from ALL results (groups + knockout + specials)
  const leaderboard = useMemo(() => {
    return SIM_BETTORS.map(name => {
      let matchPts = 0, advPts = 0, specPts = 0, exactCount = 0, totoCount = 0;

      // Group matches
      for (const key of Object.keys(results)) {
        const r = results[key]; const p = MOCK_SIM_PREDS[name]?.[key];
        if (!p) continue;
        const rDir = r.home > r.away ? 1 : r.away > r.home ? -1 : 0;
        const pDir = p.home > p.away ? 1 : p.away > p.home ? -1 : 0;
        if (rDir === pDir) { totoCount++; matchPts += TOTO_PTS; }
        if (r.home === p.home && r.away === p.away) { exactCount++; matchPts += EXACT_PTS; }
      }

      // Knockout matches
      for (const key of Object.keys(koResults)) {
        const r = koResults[key]; const p = MOCK_SIM_KO_PREDS[name]?.[key];
        if (!p) continue;
        const m = KO_MATCHES.find(km => km.key === key);
        const sc = KO_SCORING[m?.round || "R32"];
        const rDir = r.home > r.away ? 1 : r.away > r.home ? -1 : 0;
        const pDir = p.home > p.away ? 1 : p.away > p.home ? -1 : 0;
        if (rDir === pDir) { totoCount++; matchPts += sc.toto; }
        if (r.home === p.home && r.away === p.away) { exactCount++; matchPts += sc.exact; }
      }

      // Special bets
      const bs = MOCK_BETTOR_SPECIALS[name] || {};
      for (const cat of SPECIAL_CATS) {
        const simVal = specialResults[cat.key];
        if (simVal && bs[cat.key] && simVal.toLowerCase() === bs[cat.key].toLowerCase()) {
          specPts += cat.pts;
        }
      }

      const total = matchPts + advPts + specPts;
      return { name, matchPts, advPts, specPts, total, exactCount, totoCount };
    }).sort((a, b) => b.total - a.total || b.exactCount - a.exactCount);
  }, [results, koResults, specialResults]);

  const filledCount = Object.keys(results).length + Object.keys(koResults).length;
  const totalMatches = 72 + KO_MATCHES.length;
  const progressPct = Math.round((filledCount / totalMatches) * 100);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-5 text-center">
        <h2 className="text-lg font-black text-gray-900 mb-1">סימולטור ניקוד — הזינו תוצאות ותראו איך הטבלה משתנה</h2>
        <p className="text-xs text-gray-500 mb-3">בתים: טוטו={TOTO_PTS} מדויקת=+{EXACT_PTS} · נוק-אאוט: 3-4 · מיוחדים: 5-9 נק׳</p>
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-3">
          <span className="text-sm font-bold text-gray-700">מילאתם {filledCount}/{totalMatches} משחקים</span>
          <div className="w-40 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-l from-blue-500 to-indigo-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
          <span className="text-xs text-gray-400 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{progressPct}%</span>
        </div>
      </div>

      {/* Leaderboard — identical design to standings page */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden hover:shadow-lg transition-all">
        <div className="px-5 py-3 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-800">טבלת דירוג</h2>
            <p className="text-xs text-gray-400 mt-0.5">הניקוד מתעדכן בזמן אמת</p>
          </div>
        </div>

        {/* Table header */}
        <div className="flex items-center px-4 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200 font-semibold" style={{ fontFamily: "var(--font-inter)" }}>
          <span className="w-8 text-center">#</span>
          <span className="w-9 sm:w-10 me-2"></span>
          <span className="me-3 flex-1 text-start">שחקן</span>
          <span className="w-12 sm:w-14 text-center">משחקים</span>
          <span className="w-12 sm:w-14 text-center hidden sm:block">מיוחדים</span>
          <span className="w-16 text-center">סה״כ</span>
        </div>

        {leaderboard.map((b, i) => (
          <div key={b.name}
            className={`relative flex items-center px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${
              b.name === "אמית" ? "bg-blue-50/50" : "hover:bg-gray-50/50"
            }`}
          >
            {/* Rank */}
            <span className="w-8 text-center font-bold text-base text-gray-400">
              {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
            </span>
            {/* Avatar */}
            <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold me-2 ${
              i === 0 ? "bg-amber-100 text-amber-700 ring-2 ring-amber-300" :
              i === 1 ? "bg-gray-200 text-gray-600" :
              i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
            }`}>{b.name?.[0] || "?"}</div>
            {/* Name */}
            <div className="me-3 flex-1 min-w-0">
              <span className="font-bold text-base text-gray-900">{b.name}</span>
              {b.name === "אמית" && <span className="text-xs text-blue-500 ms-1.5 bg-blue-100 rounded px-1.5 py-0.5 font-bold">אתה</span>}
            </div>
            <span className="w-12 sm:w-14 text-center text-sm font-medium text-gray-600" style={{ fontFamily: "var(--font-inter)" }}>{b.matchPts}</span>
            <span className="w-14 text-center text-sm font-medium text-gray-600 hidden sm:block" style={{ fontFamily: "var(--font-inter)" }}>{b.specPts}</span>
            {/* Total */}
            <span className="w-16 text-center font-black text-lg text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{b.total}</span>
          </div>
        ))}
      </div>

      {/* Groups — score inputs */}
      {Object.keys(GROUPS).map(groupId => {
        const matches = groupMatches(groupId);
        return (
          <details key={groupId} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <summary className="px-4 py-2.5 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
              <span className="text-sm font-black text-gray-800">בית {groupId}</span>
              <span className="text-[10px] text-gray-400">
                {matches.filter(m => results[m.key]).length}/{matches.length} מולאו
              </span>
            </summary>
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {matches.map(m => {
                const r = results[m.key] || { home: 0, away: 0 };
                const filled = !!results[m.key];
                return (
                  <div key={m.key} className="px-3 py-2 flex items-center gap-1.5">
                    <span className="text-sm">{getFlag(m.home)}</span>
                    <span className="text-[11px] font-bold text-gray-700 w-16 truncate text-right">{getTeamNameHe(m.home)}</span>
                    <input type="number" min={0} max={15} value={r.home}
                      onChange={e => setGoal(m.key, "home", parseInt(e.target.value) || 0)}
                      className={`w-9 h-8 text-center rounded-lg border text-sm font-black tabular-nums ${filled ? "border-green-300 bg-green-50" : "border-gray-200"}`}
                      style={{ fontFamily: "var(--font-inter)" }} />
                    <span className="text-gray-300 text-xs">:</span>
                    <input type="number" min={0} max={15} value={r.away}
                      onChange={e => setGoal(m.key, "away", parseInt(e.target.value) || 0)}
                      className={`w-9 h-8 text-center rounded-lg border text-sm font-black tabular-nums ${filled ? "border-green-300 bg-green-50" : "border-gray-200"}`}
                      style={{ fontFamily: "var(--font-inter)" }} />
                    <span className="text-[11px] font-bold text-gray-700 w-16 truncate">{getTeamNameHe(m.away)}</span>
                    <span className="text-sm">{getFlag(m.away)}</span>
                    {!filled && (
                      <button onClick={() => setResults(prev => ({ ...prev, [m.key]: { home: 0, away: 0 } }))}
                        className="text-[9px] text-blue-500 font-bold mr-auto hover:underline">0:0</button>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        );
      })}

      {/* Knockout matches */}
      <details className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <summary className="px-4 py-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
          <span className="text-sm font-black text-gray-800">שלב הנוק-אאוט ({KO_MATCHES.length} משחקים)</span>
          <span className="text-[10px] text-gray-400">{Object.keys(koResults).length}/{KO_MATCHES.length} מולאו</span>
        </summary>
        <div className="border-t border-gray-100">
          {(["R32", "R16", "QF", "SF", "FINAL"] as const).map(round => {
            const roundMatches = KO_MATCHES.filter(m => m.round === round);
            const roundLabel = round === "R32" ? "שמינית גמר" : round === "R16" ? "רבע" : round === "QF" ? "רבע גמר" : round === "SF" ? "חצי גמר" : "גמר";
            const sc = KO_SCORING[round];
            return (
              <details key={round} className="border-b border-gray-100 last:border-0">
                <summary className="px-4 py-2 cursor-pointer hover:bg-gray-50 flex items-center justify-between text-xs">
                  <span className="font-bold text-gray-700">{roundLabel} ({roundMatches.length})</span>
                  <span className="text-gray-400">טוטו={sc.toto} מדויקת=+{sc.exact}</span>
                </summary>
                <div className="divide-y divide-gray-50">
                  {roundMatches.map(m => {
                    const r = koResults[m.key] || { home: 0, away: 0 };
                    const filled = !!koResults[m.key];
                    return (
                      <div key={m.key} className="px-3 py-2 flex items-center gap-1.5">
                        <span className="text-sm">{getFlag(m.home)}</span>
                        <span className="text-[11px] font-bold text-gray-700 w-16 truncate text-right">{m.homeName}</span>
                        <input type="number" min={0} max={15} value={r.home}
                          onChange={e => setKoGoal(m.key, "home", parseInt(e.target.value) || 0)}
                          className={`w-9 h-8 text-center rounded-lg border text-sm font-black tabular-nums ${filled ? "border-green-300 bg-green-50" : "border-gray-200"}`}
                          style={{ fontFamily: "var(--font-inter)" }} />
                        <span className="text-gray-300 text-xs">:</span>
                        <input type="number" min={0} max={15} value={r.away}
                          onChange={e => setKoGoal(m.key, "away", parseInt(e.target.value) || 0)}
                          className={`w-9 h-8 text-center rounded-lg border text-sm font-black tabular-nums ${filled ? "border-green-300 bg-green-50" : "border-gray-200"}`}
                          style={{ fontFamily: "var(--font-inter)" }} />
                        <span className="text-[11px] font-bold text-gray-700 w-16 truncate">{m.awayName}</span>
                        <span className="text-sm">{getFlag(m.away)}</span>
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
      </details>

      {/* Special bets outcomes */}
      <details className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <summary className="px-4 py-3 cursor-pointer hover:bg-gray-50 flex items-center justify-between">
          <span className="text-sm font-black text-gray-800">הימורים מיוחדים — תוצאות</span>
          <span className="text-[10px] text-gray-400">{Object.keys(specialResults).length}/{SPECIAL_CATS.length} מולאו</span>
        </summary>
        <div className="border-t border-gray-100 divide-y divide-gray-50 p-3 space-y-2">
          {SPECIAL_CATS.map(cat => {
            const selectCls = "flex-1 h-8 rounded-lg border border-gray-200 text-xs px-2";
            const onChange = (v: string) => setSpecialResults(prev => ({ ...prev, [cat.key]: v }));
            return (
              <div key={cat.key} className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700 w-24 shrink-0">{cat.label}</span>
                <span className="text-[10px] text-gray-400 w-10 shrink-0">{cat.pts} נק׳</span>
                {(cat.key === "bestAttack" || cat.key === "dirtiestTeam") ? (
                  <select value={specialResults[cat.key] || ""} onChange={e => onChange(e.target.value)} className={selectCls}>
                    <option value="">בחרו נבחרת</option>
                    {Object.keys(GROUPS).flatMap(g => GROUPS[g].map(t => (
                      <option key={t.code} value={t.code}>{getFlag(t.code)} {t.name_he}</option>
                    )))}
                  </select>
                ) : (cat.key === "topScorer" || cat.key === "topAssists") ? (
                  <select value={specialResults[cat.key] || ""} onChange={e => onChange(e.target.value)} className={selectCls}>
                    <option value="">בחרו שחקן</option>
                    {["Haaland", "Mbappé", "Kane", "Vinícius Jr.", "Lautaro", "Isak", "Morata", "Ronaldo",
                      "Álvarez", "Rodrygo", "Havertz", "Núñez", "Bellingham", "Saka", "Palmer", "Gyökeres",
                      "Osimhen", "Salah", "Messi", "Son Heung-min", "Pulisic", "David", "Mané",
                      "Griezmann", "Pedri", "De Bruyne", "Wirtz", "Musiala", "B. Fernandes", "Ødegaard",
                    ].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                ) : cat.key === "prolificGroup" || cat.key === "driestGroup" ? (
                  <select value={specialResults[cat.key] || ""} onChange={e => onChange(e.target.value)} className={selectCls}>
                    <option value="">בחרו בית</option>
                    {"ABCDEFGHIJKL".split("").map(g => <option key={g} value={g}>בית {g}</option>)}
                  </select>
                ) : cat.key === "matchup" ? (
                  <select value={specialResults[cat.key] || ""} onChange={e => onChange(e.target.value)} className={selectCls}>
                    <option value="">בחרו</option>
                    <option value="1">1</option><option value="X">X</option><option value="2">2</option>
                  </select>
                ) : (
                  <select value={specialResults[cat.key] || ""} onChange={e => onChange(e.target.value)} className={selectCls}>
                    <option value="">בחרו</option>
                    <option value="OVER">אובר</option><option value="UNDER">אנדר</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function WhosAliveTab({ advancements }: { advancements: BettorAdvancement[] }) {
  // Build WhosAlive data from real advancements, or fall back to mock
  const bettors = useMemo(() => {
    if (advancements.length === 0) return [];

    const realData = advancements.map(a => {
      const allPicked = [
        ...a.advanceToQF,
        ...a.advanceToSF,
        ...a.advanceToFinal,
        ...(a.winner ? [a.winner] : []),
      ];
      // For now, treat all picked teams as alive (actual alive/dead status
      // would require tournament results data which is not yet available)
      return {
        name: a.displayName,
        champion: a.winner,
        semifinalists: a.advanceToSF,
        quarterfinalists: a.advanceToQF,
        alive: allPicked,
        dead: [] as string[],
      };
    });

    return realData;
  }, [advancements]);

  return <WhosAlive bettors={bettors} />;
}

