"use client";

import { useState, useMemo } from "react";
import { getFlag } from "@/lib/flags";

// Sample upcoming knockout matches for simulation
const UPCOMING_MATCHES = [
  { id: 1, home: "ARG", away: "CZE", stage: "R32", homeName: "ארגנטינה", awayName: "צ׳כיה" },
  { id: 2, home: "FRA", away: "NOR", stage: "R32", homeName: "צרפת", awayName: "נורבגיה" },
  { id: 3, home: "BRA", away: "SWE", stage: "R32", homeName: "ברזיל", awayName: "שוודיה" },
  { id: 4, home: "ESP", away: "IRN", stage: "R32", homeName: "ספרד", awayName: "איראן" },
  { id: 5, home: "GER", away: "GHA", stage: "R32", homeName: "גרמניה", awayName: "גאנה" },
  { id: 6, home: "ENG", away: "PAN", stage: "R32", homeName: "אנגליה", awayName: "פנמה" },
  { id: 7, home: "POR", away: "JOR", stage: "R32", homeName: "פורטוגל", awayName: "ירדן" },
  { id: 8, home: "NED", away: "TUN", stage: "R32", homeName: "הולנד", awayName: "תוניסיה" },
];

// Mock bettors with their bracket picks for these matches
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

export default function WhatIfPage() {
  const [selectedMatch, setSelectedMatch] = useState(UPCOMING_MATCHES[0]);
  const [simulatedWinner, setSimulatedWinner] = useState<string | null>(null);

  // Calculate impact on each bettor
  const impact = useMemo(() => {
    if (!simulatedWinner) return null;

    return Object.entries(BETTOR_PICKS).map(([name, picks]) => {
      const theirPick = picks[selectedMatch.id];
      const gotItRight = theirPick === simulatedWinner;
      const wouldAdvance = theirPick === simulatedWinner;

      // Check if this result breaks their bracket path
      const pickedFavorite = theirPick === selectedMatch.home;
      const favoriteWon = simulatedWinner === selectedMatch.home;
      const upsetForThem = pickedFavorite !== favoriteWon && theirPick !== simulatedWinner;

      return {
        name,
        pick: theirPick,
        correct: gotItRight,
        pointsGained: gotItRight ? 3 : 0, // Simplified: toto points
        bracketAlive: wouldAdvance,
        upset: upsetForThem,
        isYou: name === "אמית",
      };
    }).sort((a, b) => b.pointsGained - a.pointsGained);
  }, [selectedMatch, simulatedWinner]);

  const winnersCount = impact?.filter(i => i.correct).length || 0;
  const losersCount = impact?.filter(i => !i.correct).length || 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>מה אם...?</h1>
        <p className="text-base text-gray-600 mt-1">סמלצו תוצאות — ראו מי מרוויח ומי מפסיד</p>
      </div>

      {/* Match selector */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden mb-6">
        <div className="px-5 py-4 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
          <h2 className="text-lg font-bold text-gray-900">בחרו משחק</h2>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {UPCOMING_MATCHES.map(m => (
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
          <h2 className="text-lg font-bold text-gray-900">מה אם {selectedMatch.homeName} או {selectedMatch.awayName} מנצחת?</h2>
        </div>
        <div className="p-5 flex gap-3">
          <button onClick={() => setSimulatedWinner(selectedMatch.home)}
            className={`flex-1 py-4 rounded-xl border-2 text-center font-bold transition-all ${
              simulatedWinner === selectedMatch.home
                ? "border-green-400 bg-green-50 text-green-700 shadow-md"
                : "border-gray-200 hover:border-gray-300 text-gray-700"
            }`}>
            <span className="text-3xl block mb-1">{getFlag(selectedMatch.home)}</span>
            <span className="text-lg">{selectedMatch.homeName} מנצחת</span>
          </button>
          <button onClick={() => setSimulatedWinner(selectedMatch.away)}
            className={`flex-1 py-4 rounded-xl border-2 text-center font-bold transition-all ${
              simulatedWinner === selectedMatch.away
                ? "border-green-400 bg-green-50 text-green-700 shadow-md"
                : "border-gray-200 hover:border-gray-300 text-gray-700"
            }`}>
            <span className="text-3xl block mb-1">{getFlag(selectedMatch.away)}</span>
            <span className="text-lg">{selectedMatch.awayName} מנצחת</span>
          </button>
        </div>
      </div>

      {/* Impact analysis */}
      {impact && simulatedWinner && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-black text-green-600" style={{ fontFamily: "var(--font-inter)" }}>{winnersCount}</p>
              <p className="text-sm font-bold text-green-700">מהמרים מרוויחים</p>
              <p className="text-xs text-green-600">ניחשו {simulatedWinner === selectedMatch.home ? selectedMatch.homeName : selectedMatch.awayName}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-black text-red-600" style={{ fontFamily: "var(--font-inter)" }}>{losersCount}</p>
              <p className="text-sm font-bold text-red-700">מהמרים מפסידים</p>
              <p className="text-xs text-red-600">הנבחרת שלהם נפסלת מהעץ</p>
            </div>
          </div>

          {/* Per-bettor impact */}
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
                      <span className="text-sm font-bold text-red-500">הנבחרת שניחש נפסלת — 0 נק׳ על עולות בשלב הזה</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
