"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useConfetti } from "@/hooks/useConfetti";
import { RegretMeter } from "@/components/shared/RegretMeter";
import { getFlag } from "@/lib/flags";
import { MatchReactions, MOCK_REACTIONS } from "@/components/shared/MatchReactions";
import WhosAlive from "@/components/shared/WhosAlive";
import { useSharedData } from "@/hooks/useSharedData";
import type { MatchPrediction, BettorBracket, BettorAdvancement } from "@/lib/supabase/shared-data";

// Live page — shows matches from last 24h and next 12h
// In production: real-time updates from API-Football via Supabase Realtime

const F: Record<string,string> = {
  ARG:"🇦🇷",MEX:"🇲🇽",BRA:"🇧🇷",FRA:"🇫🇷",ENG:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",ESP:"🇪🇸",GER:"🇩🇪",POR:"🇵🇹",
  KSA:"🇸🇦",IDN:"🇮🇩",JPN:"🇯🇵",MAR:"🇲🇦",UZB:"🇺🇿",CAN:"🇨🇦",SEN:"🇸🇳",DEN:"🇩🇰",
};

const MOCK_LIVE_MATCHES = [
  { id: 1, status: "live", minute: "72'", stage: "בית C · סיבוב 2",
    home: { code: "ARG", name: "ארגנטינה", goals: 2 },
    away: { code: "KSA", name: "ערב הסעודית", goals: 0 },
    yourPrediction: "2-0", yourStatus: "exact", potentialPts: "+3",
    friends: [{ name: "דני", pred: "3-0" }, { name: "יוני", pred: "1-0" }, { name: "רון", pred: "2-1" }, { name: "דור", pred: "2-0" }],
  },
  { id: 2, status: "live", minute: "45'+2", stage: "בית C · סיבוב 2",
    home: { code: "MEX", name: "מקסיקו", goals: 1 },
    away: { code: "IDN", name: "אינדונזיה", goals: 1 },
    yourPrediction: "2-0", yourStatus: "wrong", potentialPts: "+0",
    friends: [{ name: "דני", pred: "2-0" }, { name: "יוני", pred: "3-1" }],
  },
];

const MOCK_UPCOMING = [
  { id: 3, status: "upcoming", time: "19:00", stage: "בית D · סיבוב 2",
    home: { code: "JPN", name: "יפן" }, away: { code: "MAR", name: "מרוקו" }, yourPrediction: null },
  { id: 4, status: "upcoming", time: "22:00", stage: "בית D · סיבוב 2",
    home: { code: "CAN", name: "קנדה" }, away: { code: "SEN", name: "סנגל" }, yourPrediction: "1-0" },
];

const MOCK_FINISHED = [
  { id: 5, status: "finished", stage: "בית B · סיבוב 1",
    home: { code: "FRA", name: "צרפת", goals: 3 }, away: { code: "DEN", name: "דנמרק", goals: 1 },
    yourPrediction: "2-1", yourStatus: "toto", pts: "+2" },
  { id: 6, status: "finished", stage: "בית B · סיבוב 1",
    home: { code: "BRA", name: "ברזיל", goals: 2 }, away: { code: "UZB", name: "אוזבקיסטן", goals: 0 },
    yourPrediction: "2-0", yourStatus: "exact", pts: "+3" },
];

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
  const [activeTab, setActiveTab] = useState<"live" | "whatif" | "alive" | "sim">("live");
  const { predictions, brackets, advancements, profiles } = useSharedData();

  useEffect(() => {
    const hasExact = MOCK_LIVE_MATCHES.some(m => m.yourStatus === "exact");
    if (hasExact) {
      const timer = setTimeout(fireConfetti, 500);
      return () => clearTimeout(timer);
    }
  }, [fireConfetti]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      {/* Page header + tabs */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
          <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>לייב</h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          {([
            { key: "live" as const, label: "משחקים חיים" },
            { key: "whatif" as const, label: "מה אם...?" },
            { key: "alive" as const, label: "מי חי?" },
            { key: "sim" as const, label: "סימולציה" },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
                activeTab === tab.key ? "bg-gray-900 text-white shadow-md" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "live" && <LiveTab predictions={predictions} />}
      {activeTab === "whatif" && <WhatIfTab brackets={brackets} />}
      {activeTab === "alive" && <WhosAliveTab advancements={advancements} />}
      {activeTab === "sim" && <SimulationTab />}
    </div>
  );
}

function LiveTab({ predictions }: { predictions: MatchPrediction[] }) {
  // Build friends list per match from real predictions, or fall back to mock
  const hasRealPredictions = predictions.length > 0;

  function getFriendsForMatch(matchId: number, mockFriends: { name: string; pred: string }[]) {
    if (!hasRealPredictions) return mockFriends;
    const matchPreds = predictions.filter(p => p.matchId === matchId);
    if (matchPreds.length === 0) return mockFriends;
    return matchPreds.map(p => ({
      name: p.displayName,
      pred: `${p.predictedHomeGoals}-${p.predictedAwayGoals}`,
    }));
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
                    <span className="text-5xl">{F[m.home.code]}</span>
                    <span className="font-bold text-base text-gray-800">{m.home.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-6xl tabular-nums text-gray-900" style={{ fontFamily: "var(--font-inter)" }}>{m.home.goals}</span>
                    <span className="text-gray-300 text-4xl font-light">-</span>
                    <span className="font-black text-6xl tabular-nums text-gray-900" style={{ fontFamily: "var(--font-inter)" }}>{m.away.goals}</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 w-28">
                    <span className="text-5xl">{F[m.away.code]}</span>
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
                {/* All bettors predictions — color coded */}
                <div className="border-t border-gray-100 px-5 py-3">
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
                </div>
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
                <span className="text-2xl">{F[m.home.code]}</span>
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
                <span className="text-2xl">{F[m.away.code]}</span>
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
                  <span className="text-2xl">{F[m.home.code]}</span>
                  <span className="font-bold text-base">{m.home.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-2xl tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{m.home.goals}</span>
                  <span className="text-gray-300 text-xl">-</span>
                  <span className="font-black text-2xl tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{m.away.goals}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-base">{m.away.name}</span>
                  <span className="text-2xl">{F[m.away.code]}</span>
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
    if (!hasRealBrackets) return MOCK_BETTOR_PICKS;
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
    return Object.keys(picks).length > 0 ? picks : MOCK_BETTOR_PICKS;
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
    if (!hasSimulated) return null;
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

      {/* Impact table */}
      {impact && hasSimulated && (
        <div className="space-y-2 mb-4">
          {/* Summary */}
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
                    i.points > 0 ? "text-green-600" : "text-gray-300"
                  }`} style={{ fontFamily: "var(--font-inter)" }}>
                    +{i.points}
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

function SimulationTab() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
        <span className="text-4xl mb-3 block">🧪</span>
        <h2 className="text-xl font-bold text-gray-900 mb-2">סימולטור טורניר</h2>
        <p className="text-sm text-gray-600 mb-4">הזינו תוצאות לכל המשחקים הנותרים ותראו איך הטבלה משתנה</p>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          <p className="font-bold mb-1">בקרוב!</p>
          <p>הסימולטור המלא יהיה זמין כשהטורניר מתחיל (11.6.2026).</p>
          <p className="mt-1">בינתיים — השתמשו בטאב "מה אם?" לבדיקת משחקים בודדים.</p>
        </div>
      </div>
    </div>
  );
}

function WhosAliveTab({ advancements }: { advancements: BettorAdvancement[] }) {
  // Build WhosAlive data from real advancements, or fall back to mock
  const bettors = useMemo(() => {
    if (advancements.length === 0) return MOCK_WHOS_ALIVE_DATA;

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

    return realData.length > 0 ? realData : MOCK_WHOS_ALIVE_DATA;
  }, [advancements]);

  return <WhosAlive bettors={bettors} />;
}

