"use client";

import { useState, useMemo } from "react";
import { useBettingStore } from "@/stores/betting-store";
import { exportBetsToCSV, exportBetsToJSON, downloadFile } from "@/lib/backup";
import { shareLeaderboard, openWhatsApp } from "@/lib/share";
import { CompletionTracker, type PlayerCompletion } from "@/components/shared/CompletionTracker";
import { HeroRoast } from "@/components/shared/HeroRoast";
import { RadarChart } from "@/components/shared/RadarChart";
import { LeaderboardRace } from "@/components/shared/LeaderboardRace";
import { PointsSankey } from "@/components/shared/PointsSankey";
import { useSharedData } from "@/hooks/useSharedData";

// Mock completion data — in production this comes from Supabase
const MOCK_COMPLETION_DATA: PlayerCompletion[] = [
  { name: "דני", completion: { groups: 75, knockout: 0, specials: 100 } },
  { name: "רון ב", completion: { groups: 100, knockout: 100, specials: 40 } },
  { name: "עידן", completion: { groups: 50, knockout: 0, specials: 0 } },
  { name: "אמית", completion: { groups: 100, knockout: 100, specials: 100 } },
];

// Mock leaderboard data — in production this comes from Supabase scoring_log
const MOCK_PLAYERS = [
  { id: "bot", name: "הבוט 🤖", matchPts: 80, advPts: 48, specPts: 14, total: 142, today: "+8", delta: 0, toto: "57%", exact: 10, streak: 3, bestDay: "+16",
    breakdown: { totoGroup: 30, exactGroup: 8, totoKnockout: 28, exactKnockout: 14, groupAdvExact: 28, groupAdvPartial: 6, advQF: 8, advSF: 6, advFinal: 0, winner: 0, topScorer: 0, topAssists: 0, bestAttack: 6, specials: 8 } },
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
function PlayerTooltip({ player, visible, openUp = false }: { player: typeof MOCK_PLAYERS[0]; visible: boolean; openUp?: boolean }) {
  if (!visible) return null;
  const b = player.breakdown;
  return (
    <div className={`absolute z-50 end-0 w-72 bg-white rounded-xl shadow-lg border border-gray-200 p-4 text-sm ${openUp ? "bottom-full mb-1" : "top-full mt-1"}`} dir="rtl">
      <p className="font-bold text-base mb-3 border-b border-gray-100 pb-2 text-gray-900">{player.name} — פירוט {player.total} נקודות</p>
      <div className="space-y-2.5">
        <div>
          <p className="text-xs text-gray-400 font-bold mb-1">הימורי משחקים ({player.matchPts})</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-gray-500">טוטו בתים</span><span className="font-bold text-end text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{b.totoGroup}</span>
            <span className="text-gray-500">מדויקת בתים</span><span className="font-bold text-end text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{b.exactGroup}</span>
            <span className="text-gray-500">טוטו נוק-אאוט</span><span className="font-bold text-end text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{b.totoKnockout}</span>
            <span className="text-gray-500">מדויקת נוק-אאוט</span><span className="font-bold text-end text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{b.exactKnockout}</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-bold mb-1">הימורי עולות ({player.advPts})</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-gray-500">עולות מדויקות</span><span className="font-bold text-end text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{b.groupAdvExact}</span>
            <span className="text-gray-500">עולות חלקיות</span><span className="font-bold text-end text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{b.groupAdvPartial}</span>
            <span className="text-gray-500">רבע גמר</span><span className="font-bold text-end text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{b.advQF}</span>
            <span className="text-gray-500">חצי גמר</span><span className="font-bold text-end text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{b.advSF}</span>
            <span className="text-gray-500">גמר</span><span className="font-bold text-end text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{b.advFinal}</span>
            <span className="text-gray-500">זוכה</span><span className="font-bold text-end text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{b.winner}</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-gray-400 font-bold mb-1">מיוחדים ({player.specPts})</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-gray-500">מלך שערים</span><span className="font-bold text-end text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{b.topScorer}</span>
            <span className="text-gray-500">מלך בישולים</span><span className="font-bold text-end text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{b.topAssists}</span>
            <span className="text-gray-500">התקפה טובה</span><span className="font-bold text-end text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{b.bestAttack}</span>
            <span className="text-gray-500">אחרים</span><span className="font-bold text-end text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{b.specials}</span>
          </div>
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

// --- Scoring reason → breakdown bucket mapping ---
const REASON_TO_BUCKET: Record<string, keyof typeof MOCK_PLAYERS[0]["breakdown"]> = {
  toto_group: "totoGroup",
  exact_group: "exactGroup",
  toto_knockout: "totoKnockout",
  exact_knockout: "exactKnockout",
  group_adv_exact: "groupAdvExact",
  group_adv_partial: "groupAdvPartial",
  adv_qf: "advQF",
  adv_sf: "advSF",
  adv_final: "advFinal",
  winner: "winner",
  top_scorer: "topScorer",
  top_assists: "topAssists",
  best_attack: "bestAttack",
  specials: "specials",
};

// Map scoring reason to the high-level category
function reasonToCategory(reason: string): "matchPts" | "advPts" | "specPts" {
  if (["toto_group", "exact_group", "toto_knockout", "exact_knockout"].includes(reason)) return "matchPts";
  if (["group_adv_exact", "group_adv_partial", "adv_qf", "adv_sf", "adv_final", "winner"].includes(reason)) return "advPts";
  return "specPts";
}

export default function StandingsPage() {
  const totalFilled = useBettingStore((s) => s.getTotalFilledMatches());
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SortKey>("total");
  const [radarPlayerId, setRadarPlayerId] = useState<string>("4"); // default to אמית

  // Load real data from Supabase (falls back to empty arrays if not configured)
  const { profiles, scoringLog } = useSharedData();

  // Build real players from Supabase profiles + scoring log
  const realPlayers = useMemo(() => {
    if (profiles.length === 0) return [];

    return profiles.map((profile, idx) => {
      // Aggregate scoring entries for this user
      const userEntries = scoringLog.filter((e) => e.userId === profile.id);

      const breakdown = {
        totoGroup: 0, exactGroup: 0, totoKnockout: 0, exactKnockout: 0,
        groupAdvExact: 0, groupAdvPartial: 0, advQF: 0, advSF: 0,
        advFinal: 0, winner: 0, topScorer: 0, topAssists: 0,
        bestAttack: 0, specials: 0,
      };

      let matchPts = 0, advPts = 0, specPts = 0, total = 0;

      for (const entry of userEntries) {
        const bucket = REASON_TO_BUCKET[entry.reason];
        if (bucket) {
          breakdown[bucket] += entry.points;
        }
        const cat = reasonToCategory(entry.reason);
        if (cat === "matchPts") matchPts += entry.points;
        else if (cat === "advPts") advPts += entry.points;
        else specPts += entry.points;
        total += entry.points;
      }

      // Count exact-score hits and compute toto percentage
      const exactHits = userEntries.filter((e) => e.reason === "exact_group" || e.reason === "exact_knockout").length;
      const totoHits = userEntries.filter((e) =>
        ["toto_group", "exact_group", "toto_knockout", "exact_knockout"].includes(e.reason)
      ).length;
      const matchCount = totoHits + userEntries.filter((e) => e.reason === "miss").length;
      const totoPct = matchCount > 0 ? Math.round((totoHits / matchCount) * 100) : 0;

      return {
        id: profile.id,
        name: profile.displayName || "ללא שם",
        matchPts,
        advPts,
        specPts,
        total,
        today: "+0",
        delta: 0,
        toto: `${totoPct}%`,
        exact: exactHits,
        streak: 0,
        bestDay: "+0",
        isYou: false as boolean,
        breakdown,
      };
    });
  }, [profiles, scoringLog]);

  const PLAYERS = realPlayers.length > 0 ? realPlayers : MOCK_PLAYERS;
  const COMPLETION_DATA = MOCK_COMPLETION_DATA; // TODO: build from real data when available

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
          <button onClick={() => {
            const text = shareLeaderboard(
              [...PLAYERS].sort((a,b) => b.total - a.total).map((p,i) => ({ rank: i+1, name: p.name, total: p.total, today: p.today }))
            );
            openWhatsApp(text);
          }} className="px-3 py-2 rounded-lg bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-colors flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492l4.625-1.464A11.96 11.96 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.487 0-4.774-.846-6.592-2.266l-.46-.345-2.741.868.91-2.666-.38-.503A9.96 9.96 0 0 1 2 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
            שתף
          </button>
          <button onClick={handleExportCSV} className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors">
            CSV
          </button>
          <button onClick={handleExportJSON} className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 hover:bg-gray-100 transition-colors">
            גיבוי
          </button>
        </div>
      </div>

      <CompletionTracker players={COMPLETION_DATA} />

      {/* Hero & Roast of the day */}
      {PLAYERS.length >= 2 && PLAYERS[0]?.name && (() => {
        const sorted = [...PLAYERS].sort((a, b) => parseInt(b.today || "0") - parseInt(a.today || "0"));
        const heroPlayer = sorted[0];
        const roastPlayer = sorted[sorted.length - 1];
        if (!heroPlayer?.name || !roastPlayer?.name) return null;
        return (
          <HeroRoast
            hero={{ name: heroPlayer.name, points: parseInt(heroPlayer.today || "0"), highlight: `${heroPlayer.exact} מדויקות!` }}
            roast={{ name: roastPlayer.name, points: parseInt(roastPlayer.today || "0"), highlight: `רק ${roastPlayer.today || "0"} — יום קשה` }}
            matchday="יום משחק 3"
          />
        );
      })()}

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
          <span className="w-12 text-center text-blue-600">{TABS.find(t => t.key === activeTab)?.label || ""}</span>
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
              }`}>{p.name?.[0] || "?"}</div>
              <div className="me-3 flex-1 min-w-0 relative">
                <span className="font-bold text-base text-gray-900 cursor-pointer hover:text-blue-600 transition-colors">{p.name}</span>
                {p.isYou && <span className="text-xs text-blue-500 ms-1.5 bg-blue-100 rounded px-1.5 py-0.5 font-bold">אתה</span>}
                <PlayerTooltip player={p} visible={hoveredPlayer === p.id} openUp={i >= PLAYERS.length - 4} />
              </div>
              {/* Mobile: show only the active tab value */}
              <span className={`w-12 text-center text-sm font-bold text-blue-600 sm:hidden`} style={{ fontFamily: "var(--font-inter)" }}>
                {activeTab === "matchPts" ? p.matchPts : activeTab === "advPts" ? p.advPts : activeTab === "specPts" ? p.specPts : ""}
              </span>
              {/* Desktop: show all 3 + sparkline */}
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

      {/* Player Radar Chart */}
      {(() => {
        const radarPlayer = PLAYERS.find((p) => p.id === radarPlayerId) ?? PLAYERS.find((p) => p.isYou)!;
        const leader = [...PLAYERS].sort((a, b) => b.total - a.total)[0];
        // Compute max values for normalization
        const maxToto = Math.max(...PLAYERS.map((p) => parseInt(p.toto)));
        const maxExact = Math.max(...PLAYERS.map((p) => p.exact));
        const maxGroups = Math.max(...PLAYERS.map((p) => p.breakdown.totoGroup + p.breakdown.exactGroup));
        const maxKnockout = Math.max(...PLAYERS.map((p) => p.breakdown.totoKnockout + p.breakdown.exactKnockout));
        const maxSpecials = Math.max(...PLAYERS.map((p) => p.specPts));
        const normalize = (p: typeof PLAYERS[0]) => ({
          name: p.name,
          toto: Math.round((parseInt(p.toto) / maxToto) * 100),
          exact: Math.round((p.exact / maxExact) * 100),
          groups: Math.round(((p.breakdown.totoGroup + p.breakdown.exactGroup) / maxGroups) * 100),
          knockout: Math.round(((p.breakdown.totoKnockout + p.breakdown.exactKnockout) / maxKnockout) * 100),
          specials: Math.round((p.specPts / maxSpecials) * 100),
        });
        return (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden hover:shadow-lg transition-all mb-6">
            <div className="px-5 py-4 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-800">פרופיל שחקן</h2>
                <p className="text-sm text-gray-500">השוואה מול המוביל</p>
              </div>
              <select
                value={radarPlayerId}
                onChange={(e) => setRadarPlayerId(e.target.value)}
                className="text-sm font-bold border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-white"
                dir="rtl"
              >
                {PLAYERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="p-5">
              <RadarChart player={normalize(radarPlayer)} leader={normalize(leader)} />
            </div>
          </div>
        );
      })()}

      {/* Leaderboard Race */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">מירוץ הנקודות</h2>
        {(() => {
          const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6", "#E11D48"];
          const raceData = PLAYERS.map((p, idx) => {
            // Generate mock 10-matchday history ending at the player's total
            const steps = 10;
            const history = Array.from({ length: steps }, (_, i) =>
              Math.round((p.total / steps) * (i + 1) + (Math.sin(idx + i) * 8))
            );
            history[steps - 1] = p.total; // ensure final value matches
            return { name: p.name, color: COLORS[idx % COLORS.length], history };
          });
          const matchdays = Array.from({ length: 10 }, (_, i) => `יום ${i + 1}`);
          return <LeaderboardRace data={raceData} matchdays={matchdays} />;
        })()}
      </div>

      {/* Points Sankey */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">מאיפה הנקודות שלך?</h2>
        {(() => {
          const me = PLAYERS.find((p) => p.isYou)!;
          return (
            <PointsSankey
              player={{
                name: me.name,
                toto: me.breakdown.totoGroup + me.breakdown.totoKnockout,
                exact: me.breakdown.exactGroup + me.breakdown.exactKnockout,
                groups: me.breakdown.groupAdvExact + me.breakdown.groupAdvPartial,
                knockout: me.breakdown.advQF + me.breakdown.advSF + me.breakdown.advFinal,
                specials: me.specPts,
                total: me.total,
              }}
            />
          );
        })()}
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
