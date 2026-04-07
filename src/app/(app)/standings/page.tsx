"use client";

import { useState } from "react";
import { useBettingStore } from "@/stores/betting-store";
import { exportBetsToCSV, exportBetsToJSON, downloadFile, getAvailableBackups } from "@/lib/backup";

// Mock leaderboard data — in production this comes from Supabase scoring_log
const PLAYERS = [
  { id: "1", name: "דני", matchPts: 95, advPts: 52, specPts: 21, total: 168, today: "+12", delta: 3, toto: "65%", exact: 16, streak: 8, bestDay: "+18",
    breakdown: { totoGroup: 36, exactGroup: 12, totoKnockout: 30, exactKnockout: 17, groupAdvExact: 30, groupAdvPartial: 9, advQF: 16, advSF: 12, advFinal: 0, winner: 0, topScorer: 0, topAssists: 0, bestAttack: 0, specials: 6 } },
  { id: "2", name: "יוני", matchPts: 88, advPts: 55, specPts: 18, total: 161, today: "+8", delta: 1, toto: "62%", exact: 14, streak: 6, bestDay: "+16",
    breakdown: { totoGroup: 34, exactGroup: 10, totoKnockout: 28, exactKnockout: 16, groupAdvExact: 35, groupAdvPartial: 6, advQF: 12, advSF: 12, advFinal: 0, winner: 0, topScorer: 5, topAssists: 0, bestAttack: 6, specials: 7 } },
  { id: "3", name: "דור דסא", matchPts: 82, advPts: 60, specPts: 15, total: 157, today: "+15", delta: 2, toto: "60%", exact: 13, streak: 5, bestDay: "+20",
    breakdown: { totoGroup: 32, exactGroup: 11, totoKnockout: 24, exactKnockout: 15, groupAdvExact: 40, groupAdvPartial: 6, advQF: 8, advSF: 6, advFinal: 0, winner: 0, topScorer: 0, topAssists: 4, bestAttack: 0, specials: 11 } },
  { id: "4", name: "אמית", matchPts: 90, advPts: 45, specPts: 19, total: 154, today: "+6", delta: 0, toto: "62%", exact: 14, streak: 7, bestDay: "+23", isYou: true,
    breakdown: { totoGroup: 38, exactGroup: 14, totoKnockout: 24, exactKnockout: 14, groupAdvExact: 25, groupAdvPartial: 6, advQF: 8, advSF: 6, advFinal: 0, winner: 0, topScorer: 9, topAssists: 0, bestAttack: 0, specials: 10 } },
  { id: "5", name: "רון ב", matchPts: 78, advPts: 50, specPts: 16, total: 144, today: "+10", delta: -1, toto: "58%", exact: 11, streak: 4, bestDay: "+15",
    breakdown: { totoGroup: 30, exactGroup: 8, totoKnockout: 26, exactKnockout: 14, groupAdvExact: 30, groupAdvPartial: 9, advQF: 8, advSF: 0, advFinal: 0, winner: 0, topScorer: 0, topAssists: 4, bestAttack: 6, specials: 6 } },
  { id: "6", name: "רון ג", matchPts: 75, advPts: 42, specPts: 20, total: 137, today: "+4", delta: -2, toto: "55%", exact: 10, streak: 3, bestDay: "+14",
    breakdown: { totoGroup: 28, exactGroup: 9, totoKnockout: 24, exactKnockout: 14, groupAdvExact: 25, groupAdvPartial: 6, advQF: 8, advSF: 0, advFinal: 0, winner: 0, topScorer: 5, topAssists: 4, bestAttack: 0, specials: 11 } },
  { id: "7", name: "רועי", matchPts: 72, advPts: 48, specPts: 14, total: 134, today: "+7", delta: 1, toto: "56%", exact: 12, streak: 5, bestDay: "+16",
    breakdown: { totoGroup: 26, exactGroup: 10, totoKnockout: 22, exactKnockout: 14, groupAdvExact: 30, groupAdvPartial: 6, advQF: 12, advSF: 0, advFinal: 0, winner: 0, topScorer: 0, topAssists: 0, bestAttack: 6, specials: 8 } },
  { id: "8", name: "עידן", matchPts: 68, advPts: 44, specPts: 17, total: 129, today: "+5", delta: 0, toto: "54%", exact: 9, streak: 4, bestDay: "+13",
    breakdown: { totoGroup: 24, exactGroup: 8, totoKnockout: 22, exactKnockout: 14, groupAdvExact: 25, groupAdvPartial: 9, advQF: 8, advSF: 0, advFinal: 0, winner: 0, topScorer: 0, topAssists: 0, bestAttack: 6, specials: 11 } },
  { id: "9", name: "אוהד", matchPts: 65, advPts: 38, specPts: 22, total: 125, today: "+9", delta: 2, toto: "52%", exact: 8, streak: 3, bestDay: "+17",
    breakdown: { totoGroup: 22, exactGroup: 7, totoKnockout: 22, exactKnockout: 14, groupAdvExact: 20, groupAdvPartial: 6, advQF: 8, advSF: 0, advFinal: 0, winner: 0, topScorer: 9, topAssists: 7, bestAttack: 6, specials: 0 } },
  { id: "10", name: "אורי", matchPts: 60, advPts: 40, specPts: 13, total: 113, today: "+3", delta: -1, toto: "48%", exact: 7, streak: 2, bestDay: "+12",
    breakdown: { totoGroup: 20, exactGroup: 6, totoKnockout: 20, exactKnockout: 14, groupAdvExact: 25, groupAdvPartial: 3, advQF: 8, advSF: 0, advFinal: 0, winner: 0, topScorer: 0, topAssists: 0, bestAttack: 6, specials: 7 } },
];

function Sparkline({ data, highlight }: { data: number[]; highlight?: boolean }) {
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const w = 80, h = 24;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible" style={{ direction: "ltr" }}>
      <polyline points={points} fill="none" stroke={highlight ? "#3B82F6" : "#94A3B8"} strokeWidth={highlight ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - ((data[data.length - 1] - min) / range) * h} r={2.5} fill={highlight ? "#3B82F6" : "#94A3B8"} />
    </svg>
  );
}

// Hover tooltip for detailed breakdown
function PlayerTooltip({ player, visible }: { player: typeof PLAYERS[0]; visible: boolean }) {
  if (!visible) return null;
  const b = player.breakdown;
  return (
    <div className="absolute z-50 top-full mt-1 end-0 w-72 bg-gray-900 text-white rounded-xl shadow-2xl p-4 text-sm" dir="rtl">
      <p className="font-black text-base mb-3 border-b border-gray-700 pb-2">{player.name} — פירוט {player.total} נקודות</p>
      <div className="space-y-1.5">
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">הימורי משחקים ({player.matchPts})</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <span className="text-gray-300">טוטו בתים</span><span className="font-bold text-end" style={{ fontFamily: "var(--font-inter)" }}>{b.totoGroup}</span>
          <span className="text-gray-300">מדויקת בתים</span><span className="font-bold text-end" style={{ fontFamily: "var(--font-inter)" }}>{b.exactGroup}</span>
          <span className="text-gray-300">טוטו נוק-אאוט</span><span className="font-bold text-end" style={{ fontFamily: "var(--font-inter)" }}>{b.totoKnockout}</span>
          <span className="text-gray-300">מדויקת נוק-אאוט</span><span className="font-bold text-end" style={{ fontFamily: "var(--font-inter)" }}>{b.exactKnockout}</span>
        </div>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-2">הימורי עולות ({player.advPts})</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <span className="text-gray-300">עולות מדויקות</span><span className="font-bold text-end" style={{ fontFamily: "var(--font-inter)" }}>{b.groupAdvExact}</span>
          <span className="text-gray-300">עולות חלקיות</span><span className="font-bold text-end" style={{ fontFamily: "var(--font-inter)" }}>{b.groupAdvPartial}</span>
          <span className="text-gray-300">רבע גמר</span><span className="font-bold text-end" style={{ fontFamily: "var(--font-inter)" }}>{b.advQF}</span>
          <span className="text-gray-300">חצי גמר</span><span className="font-bold text-end" style={{ fontFamily: "var(--font-inter)" }}>{b.advSF}</span>
          <span className="text-gray-300">גמר</span><span className="font-bold text-end" style={{ fontFamily: "var(--font-inter)" }}>{b.advFinal}</span>
          <span className="text-gray-300">זוכה</span><span className="font-bold text-end" style={{ fontFamily: "var(--font-inter)" }}>{b.winner}</span>
        </div>
        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-2">מיוחדים ({player.specPts})</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
          <span className="text-gray-300">מלך שערים</span><span className="font-bold text-end" style={{ fontFamily: "var(--font-inter)" }}>{b.topScorer}</span>
          <span className="text-gray-300">מלך בישולים</span><span className="font-bold text-end" style={{ fontFamily: "var(--font-inter)" }}>{b.topAssists}</span>
          <span className="text-gray-300">התקפה טובה</span><span className="font-bold text-end" style={{ fontFamily: "var(--font-inter)" }}>{b.bestAttack}</span>
          <span className="text-gray-300">אחרים</span><span className="font-bold text-end" style={{ fontFamily: "var(--font-inter)" }}>{b.specials}</span>
        </div>
      </div>
    </div>
  );
}

type SortKey = "total" | "matchPts" | "advPts" | "specPts";
const TABS: { label: string; key: SortKey }[] = [
  { label: "כללי", key: "total" },
  { label: "משחקים", key: "matchPts" },
  { label: "עולות", key: "advPts" },
  { label: "מיוחדים", key: "specPts" },
];

export default function StandingsPage() {
  const totalFilled = useBettingStore((s) => s.getTotalFilledMatches());
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SortKey>("total");

  const handleExportCSV = () => {
    const state = useBettingStore.getState();
    const csv = exportBetsToCSV(state);
    downloadFile(csv, `wc2026-bets-${new Date().toISOString().split("T")[0]}.csv`);
  };

  const handleExportJSON = () => {
    const state = useBettingStore.getState();
    const json = exportBetsToJSON(state);
    downloadFile(json, `wc2026-backup-${new Date().toISOString().split("T")[0]}.json`, "application/json");
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>מי מוביל?</h1>
          <p className="text-base text-gray-600 mt-1">מונדיאל 2026 — The Minhelet · עקבו אחרי המירוץ</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportCSV} className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors">
            CSV
          </button>
          <button onClick={handleExportJSON} className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors">
            גיבוי
          </button>
        </div>
      </div>

      {/* Main leaderboard */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden hover:shadow-lg transition-all mb-6">
        <div className="px-5 py-3 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-800">טבלת דירוג</h2>
            <p className="text-xs text-gray-400 mt-0.5">לחצו לסידור לפי קטגוריה</p>
          </div>
          <div className="flex gap-1 text-sm">
            {TABS.map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-full font-bold transition-all ${
                  activeTab === tab.key
                    ? "bg-gray-900 text-white shadow-md"
                    : "text-gray-500 hover:bg-gray-200"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Table header — mobile */}
        <div className="flex sm:hidden items-center px-4 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200 font-semibold" style={{ fontFamily: "var(--font-inter)" }}>
          <span className="w-8 text-center">#</span>
          <span className="w-9 me-2"></span>
          <span className="me-3 flex-1 text-start">שחקן</span>
          <span className="w-12 text-center">היום</span>
          <span className="w-16 text-center">סה״כ</span>
          <span className="w-8 text-center">שינוי</span>
        </div>
        {/* Table header — desktop */}
        <div className="hidden sm:flex items-center px-4 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200 font-semibold" style={{ fontFamily: "var(--font-inter)" }}>
          <span className="w-8 text-center">#</span>
          <span className="w-10 me-2"></span>
          <span className="me-3 flex-1 text-start">שחקן</span>
          <span className="w-14 text-center">משחקים</span>
          <span className="w-14 text-center">עולות</span>
          <span className="w-14 text-center">מיוחדים</span>
          <span className="w-20 text-center">מגמה</span>
          <span className="w-12 text-center">היום</span>
          <span className="w-16 text-center">סה״כ</span>
          <span className="w-8 text-center">שינוי</span>
        </div>

        {[...PLAYERS].sort((a, b) => b[activeTab] - a[activeTab]).map((p, i) => {
          const history = [30 + i * 5, 50 + i * 4, 70 + i * 3, 90 + i * 2, 110 + i, 130 - i * 2, p.total];
          return (
            <div key={p.id}
              className={`relative flex items-center px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${
                p.isYou ? "bg-blue-50/50" : "hover:bg-gray-50/50"
              }`}
              onMouseEnter={() => setHoveredPlayer(p.id)}
              onMouseLeave={() => setHoveredPlayer(null)}
            >
              <span className="w-8 text-center font-bold text-base text-gray-400">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
              </span>
              <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold me-2 ${
                i === 0 ? "bg-amber-100 text-amber-700 ring-2 ring-amber-300" :
                i === 1 ? "bg-gray-200 text-gray-600" :
                i === 2 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
              }`}>{p.name[0]}</div>
              <div className="me-3 flex-1 min-w-0 relative">
                <span className="font-bold text-base text-gray-900 cursor-pointer hover:text-blue-600 transition-colors">{p.name}</span>
                {p.isYou && <span className="text-xs text-blue-500 ms-1.5 bg-blue-100 rounded px-1.5 py-0.5 font-bold">אתה</span>}
                <PlayerTooltip player={p} visible={hoveredPlayer === p.id} />
              </div>
              <span className={`w-14 text-center text-sm font-medium hidden sm:block ${activeTab === "matchPts" ? "text-blue-600 font-bold" : "text-gray-600"}`} style={{ fontFamily: "var(--font-inter)" }}>{p.matchPts}</span>
              <span className={`w-14 text-center text-sm font-medium hidden sm:block ${activeTab === "advPts" ? "text-blue-600 font-bold" : "text-gray-600"}`} style={{ fontFamily: "var(--font-inter)" }}>{p.advPts}</span>
              <span className={`w-14 text-center text-sm font-medium hidden sm:block ${activeTab === "specPts" ? "text-blue-600 font-bold" : "text-gray-600"}`} style={{ fontFamily: "var(--font-inter)" }}>{p.specPts}</span>
              <div className="w-20 hidden sm:flex justify-center">
                <Sparkline data={history} highlight={!!p.isYou} />
              </div>
              <span className="w-12 text-center text-sm text-green-600 font-bold" style={{ fontFamily: "var(--font-inter)" }}>{p.today}</span>
              <span className="w-16 text-center font-black text-lg text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{p.total}</span>
              <span className={`w-8 text-center text-sm font-bold ${p.delta > 0 ? "text-green-500" : p.delta < 0 ? "text-red-400" : "text-gray-400"}`}>
                {p.delta > 0 ? `▲${p.delta}` : p.delta < 0 ? `▼${Math.abs(p.delta)}` : "—"}
              </span>
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden hover:shadow-lg transition-all mb-6">
        <div className="px-5 py-4 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
          <h2 className="text-lg font-bold text-gray-800">השוואת כל המהמרים</h2>
          <p className="text-sm text-gray-500">מי הכי חזק בכל קטגוריה?</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 font-semibold border-b border-gray-200" style={{ fontFamily: "var(--font-inter)" }}>
                <th className="py-3 px-4 text-start">שחקן</th>
                <th className="py-3 px-3 text-center font-bold">סה״כ</th>
                <th className="py-3 px-3 text-center">% טוטו</th>
                <th className="py-3 px-3 text-center">מדויקות</th>
                <th className="py-3 px-3 text-center">רצף</th>
                <th className="py-3 px-3 text-center">יום טוב</th>
              </tr>
            </thead>
            <tbody>
              {PLAYERS.map((p) => (
                <tr key={p.id} className={`border-t border-gray-100 ${p.isYou ? "bg-blue-50/40" : "hover:bg-gray-50/30"}`}>
                  <td className="py-3 px-4 font-bold text-gray-900">{p.name} {p.isYou && <span className="text-xs text-blue-500 bg-blue-100 rounded px-1">אתה</span>}</td>
                  <td className="py-3 px-3 text-center font-black text-base" style={{ fontFamily: "var(--font-inter)" }}>{p.total}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`font-bold ${parseInt(p.toto) >= 60 ? "text-green-600" : parseInt(p.toto) >= 55 ? "text-amber-600" : "text-red-500"}`}>{p.toto}</span>
                  </td>
                  <td className="py-3 px-3 text-center font-medium" style={{ fontFamily: "var(--font-inter)" }}>{p.exact}</td>
                  <td className="py-3 px-3 text-center text-amber-600 font-bold">{p.streak} 🔥</td>
                  <td className="py-3 px-3 text-center text-green-600 font-bold" style={{ fontFamily: "var(--font-inter)" }}>{p.bestDay}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category leaders */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">מלכי הקטגוריות</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { title: "מלך הטוטו", name: "דני", value: "65%", bg: "bg-green-50 border-green-200" },
            { title: "צלף מדויק", name: "דני", value: "16", bg: "bg-blue-50 border-blue-200" },
            { title: "רצף הכי ארוך", name: "דני", value: "8", bg: "bg-amber-50 border-amber-200" },
            { title: "יום הכי חזק", name: "אמית", value: "+23", bg: "bg-orange-50 border-orange-200" },
          ].map(cat => (
            <div key={cat.title} className={`rounded-xl border p-4 text-center ${cat.bg}`}>
              <p className="text-sm text-gray-500 font-medium">{cat.title}</p>
              <p className="text-2xl font-black text-gray-900 mt-1" style={{ fontFamily: "var(--font-inter)" }}>{cat.value}</p>
              <p className="text-sm font-bold text-blue-600 mt-0.5">{cat.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Head to head */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden hover:shadow-lg transition-all">
        <div className="px-5 py-4 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
          <h2 className="text-lg font-bold text-gray-800">ראש בראש</h2>
        </div>
        <div className="p-4 space-y-2.5">
          {[
            { rival: "דני (מקום 1)", gap: -14, trend: "מתקרב", detail: "הוא חזק בטוטו" },
            { rival: "יוני (מקום 2)", gap: -7, trend: "מתקרב", detail: "פער מצטמצם" },
            { rival: "דור (מקום 3)", gap: -3, trend: "כמעט!", detail: "הוא מוביל בעולות" },
            { rival: "רון ב (מקום 5)", gap: 10, trend: "מוביל", detail: "פער יציב" },
          ].map(r => (
            <div key={r.rival} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50">
              <span className="text-sm text-gray-800 font-bold flex-1">{r.rival}</span>
              <span className="text-sm text-gray-400 hidden sm:block">{r.detail}</span>
              <span className={`text-lg font-black tabular-nums ${r.gap > 0 ? "text-green-600" : "text-red-500"}`} style={{ fontFamily: "var(--font-inter)" }}>
                {r.gap > 0 ? `+${r.gap}` : r.gap}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                r.trend === "מוביל" ? "bg-green-100 text-green-700" : r.trend === "כמעט!" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
              }`}>{r.trend}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
