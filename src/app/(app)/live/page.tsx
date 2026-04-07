"use client";

import { useEffect, useState, useMemo } from "react";
import { useConfetti } from "@/hooks/useConfetti";
import { RegretMeter } from "@/components/shared/RegretMeter";
import { getFlag } from "@/lib/flags";

// Live page — shows matches from last 24h and next 12h
// In production: real-time updates from API-Football via Supabase Realtime

const F: Record<string,string> = {
  ARG:"🇦🇷",MEX:"🇲🇽",BRA:"🇧🇷",FRA:"🇫🇷",ENG:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",ESP:"🇪🇸",GER:"🇩🇪",POR:"🇵🇹",
  KSA:"🇸🇦",IDN:"🇮🇩",JPN:"🇯🇵",MAR:"🇲🇦",UZB:"🇺🇿",CAN:"🇨🇦",SEN:"🇸🇳",DEN:"🇩🇰",
};

const LIVE_MATCHES = [
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

const UPCOMING = [
  { id: 3, status: "upcoming", time: "19:00", stage: "בית D · סיבוב 2",
    home: { code: "JPN", name: "יפן" }, away: { code: "MAR", name: "מרוקו" }, yourPrediction: null },
  { id: 4, status: "upcoming", time: "22:00", stage: "בית D · סיבוב 2",
    home: { code: "CAN", name: "קנדה" }, away: { code: "SEN", name: "סנגל" }, yourPrediction: "1-0" },
];

const FINISHED = [
  { id: 5, status: "finished", stage: "בית B · סיבוב 1",
    home: { code: "FRA", name: "צרפת", goals: 3 }, away: { code: "DEN", name: "דנמרק", goals: 1 },
    yourPrediction: "2-1", yourStatus: "toto", pts: "+2" },
  { id: 6, status: "finished", stage: "בית B · סיבוב 1",
    home: { code: "BRA", name: "ברזיל", goals: 2 }, away: { code: "UZB", name: "אוזבקיסטן", goals: 0 },
    yourPrediction: "2-0", yourStatus: "exact", pts: "+3" },
];

// What-If data
const WHATIF_MATCHES = [
  { id: 1, home: "ARG", away: "CZE", stage: "R32", homeName: "ארגנטינה", awayName: "צ׳כיה" },
  { id: 2, home: "FRA", away: "NOR", stage: "R32", homeName: "צרפת", awayName: "נורבגיה" },
  { id: 3, home: "BRA", away: "SWE", stage: "R32", homeName: "ברזיל", awayName: "שוודיה" },
  { id: 4, home: "ESP", away: "IRN", stage: "R32", homeName: "ספרד", awayName: "איראן" },
  { id: 5, home: "GER", away: "GHA", stage: "R32", homeName: "גרמניה", awayName: "גאנה" },
  { id: 6, home: "ENG", away: "PAN", stage: "R32", homeName: "אנגליה", awayName: "פנמה" },
  { id: 7, home: "POR", away: "JOR", stage: "R32", homeName: "פורטוגל", awayName: "ירדן" },
  { id: 8, home: "NED", away: "TUN", stage: "R32", homeName: "הולנד", awayName: "תוניסיה" },
];

const BETTOR_PICKS: Record<string, Record<number, string>> = {
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

export default function LivePage() {
  const fireConfetti = useConfetti();
  const [activeTab, setActiveTab] = useState<"live" | "whatif">("live");

  useEffect(() => {
    const hasExact = LIVE_MATCHES.some(m => m.yourStatus === "exact");
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
        <div className="flex gap-2">
          <button onClick={() => setActiveTab("live")}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
              activeTab === "live" ? "bg-gray-900 text-white shadow-md" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}>
            משחקים חיים
          </button>
          <button onClick={() => setActiveTab("whatif")}
            className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all ${
              activeTab === "whatif" ? "bg-gray-900 text-white shadow-md" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}>
            מה אם...?
          </button>
        </div>
      </div>

      {activeTab === "live" ? <LiveTab /> : <WhatIfTab />}
    </div>
  );
}

function LiveTab() {
  return (
    <>
      {/* LIVE NOW */}
      {LIVE_MATCHES.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            עכשיו בשידור חי
          </h2>
          <div className="space-y-4">
            {LIVE_MATCHES.map(m => (
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
                    {[...m.friends, { name: "אמית", pred: m.yourPrediction }].map(f => {
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UPCOMING */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-3">קרוב — היום</h2>
        <div className="space-y-3">
          {UPCOMING.map(m => (
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
          {FINISHED.map(m => (
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

function WhatIfTab() {
  const [selectedMatch, setSelectedMatch] = useState(WHATIF_MATCHES[0]);
  const [simulatedWinner, setSimulatedWinner] = useState<string | null>(null);

  const impact = useMemo(() => {
    if (!simulatedWinner) return null;

    return Object.entries(BETTOR_PICKS).map(([name, picks]) => {
      const theirPick = picks[selectedMatch.id];
      const gotItRight = theirPick === simulatedWinner;
      const pickedFavorite = theirPick === selectedMatch.home;
      const favoriteWon = simulatedWinner === selectedMatch.home;
      const upsetForThem = pickedFavorite !== favoriteWon && theirPick !== simulatedWinner;

      return {
        name,
        pick: theirPick,
        correct: gotItRight,
        pointsGained: gotItRight ? 3 : 0,
        bracketAlive: gotItRight,
        upset: upsetForThem,
        isYou: name === "אמית",
      };
    }).sort((a, b) => b.pointsGained - a.pointsGained);
  }, [selectedMatch, simulatedWinner]);

  const winnersCount = impact?.filter(i => i.correct).length || 0;
  const losersCount = impact?.filter(i => !i.correct).length || 0;

  return (
    <>
      <p className="text-base text-gray-600 mb-6">בחרו משחק וסמלצו תוצאה — ראו מי מרוויח ומי מפסיד</p>

      {/* Match selector */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden mb-6">
        <div className="px-5 py-4 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
          <h2 className="text-lg font-bold text-gray-900">בחרו משחק</h2>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {WHATIF_MATCHES.map(m => (
            <button key={m.id} onClick={() => { setSelectedMatch(m); setSimulatedWinner(null); }}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                selectedMatch.id === m.id ? "border-blue-300 bg-blue-50 shadow-sm" : "border-gray-200 hover:bg-gray-50"
              }`}>
              <span className="flex items-center gap-2">
                <span className="text-lg">{getFlag(m.home)}</span>
                <span className="font-bold text-sm">{m.homeName}</span>
              </span>
              <span className="text-xs text-gray-400">vs</span>
              <span className="flex items-center gap-2">
                <span className="font-bold text-sm">{m.awayName}</span>
                <span className="text-lg">{getFlag(m.away)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Simulate winner */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">מי מנצחת?</h2>
        </div>
        <div className="p-5 flex gap-3">
          <button onClick={() => setSimulatedWinner(selectedMatch.home)}
            className={`flex-1 py-4 rounded-xl border-2 text-center font-bold transition-all ${
              simulatedWinner === selectedMatch.home
                ? "border-green-400 bg-green-50 text-green-700 shadow-md"
                : "border-gray-200 hover:border-gray-300 text-gray-700"
            }`}>
            <span className="text-3xl block mb-1">{getFlag(selectedMatch.home)}</span>
            <span className="text-lg">{selectedMatch.homeName}</span>
          </button>
          <button onClick={() => setSimulatedWinner(selectedMatch.away)}
            className={`flex-1 py-4 rounded-xl border-2 text-center font-bold transition-all ${
              simulatedWinner === selectedMatch.away
                ? "border-green-400 bg-green-50 text-green-700 shadow-md"
                : "border-gray-200 hover:border-gray-300 text-gray-700"
            }`}>
            <span className="text-3xl block mb-1">{getFlag(selectedMatch.away)}</span>
            <span className="text-lg">{selectedMatch.awayName}</span>
          </button>
        </div>
      </div>

      {/* Impact analysis */}
      {impact && simulatedWinner && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-black text-green-600" style={{ fontFamily: "var(--font-inter)" }}>{winnersCount}</p>
              <p className="text-sm font-bold text-green-700">ניחשו נכון</p>
              <p className="text-xs text-green-600">+3 נקודות לכל אחד</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-black text-red-600" style={{ fontFamily: "var(--font-inter)" }}>{losersCount}</p>
              <p className="text-sm font-bold text-red-700">ניחשו לא נכון</p>
              <p className="text-xs text-red-600">הנבחרת שניחשו נפסלת מהמשך העץ</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">
                אם {getFlag(simulatedWinner)} {simulatedWinner === selectedMatch.home ? selectedMatch.homeName : selectedMatch.awayName} מנצחת:
              </h3>
            </div>
            <div className="divide-y divide-gray-100">
              {impact.map(i => (
                <div key={i.name} className={`flex items-center gap-3 px-5 py-3 ${i.isYou ? "bg-blue-50/40" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    i.correct ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                  }`}>
                    {i.correct ? "✓" : "✗"}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-gray-900">{i.name} {i.isYou && <span className="text-xs text-blue-500 bg-blue-100 rounded px-1 ms-1">אתה</span>}</p>
                    <p className="text-xs text-gray-500">
                      ניחש: {getFlag(i.pick)} {i.pick}
                      {i.upset && " — הפתעה! ניחש הפוך"}
                    </p>
                  </div>
                  <div className="text-end">
                    {i.correct ? (
                      <span className="text-sm font-bold text-green-600">+{i.pointsGained} נק׳</span>
                    ) : (
                      <span className="text-sm font-bold text-red-500">הנבחרת שניחש נפסלת מהעץ</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
