"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useBettingStore } from "@/stores/betting-store";
import { exportBetsToCSV, downloadFile } from "@/lib/backup";
import { shareLeaderboard, openWhatsApp } from "@/lib/share";
import { CompletionTracker, type PlayerCompletion } from "@/components/shared/CompletionTracker";
import { HeroRoast } from "@/components/shared/HeroRoast";
import { LeaderboardRace } from "@/components/shared/LeaderboardRace";
import { useSharedData } from "@/hooks/useSharedData";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { isLocked } from "@/lib/constants";
import { GROUPS } from "@/lib/tournament/groups";
import { TodayMatches } from "@/components/shared/TodayMatches";
import { computeLiveScores, computeTodayScores, computePlayerHistories } from "@/lib/scoring/live-scorer";
import { normalizeGroupLetter, type FinishedMatch } from "@/lib/results-hits";

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

// ============================================================================
// Missing-bets awareness banner — shows what the current user still needs to fill
// ============================================================================
function MissingBetsBanner() {
  const groups = useBettingStore((s) => s.getCompletedGroupsCount());
  const knockoutFilled = useBettingStore((s) => {
    return Object.values(s.knockout).filter((m) => m.winner).length;
  });
  const sb = useBettingStore((s) => s.specialBets);
  const specialsFilled = [sb.winner, sb.finalist1, sb.finalist2, ...sb.semifinalists, ...sb.quarterfinalists,
    sb.topScorerPlayer, sb.topAssistsPlayer, sb.bestAttack, sb.prolificGroup, sb.driestGroup,
    sb.dirtiestTeam, ...sb.matchups, sb.penaltiesOverUnder].filter(Boolean).length;

  const allDone = groups === 12 && knockoutFilled === 31 && specialsFilled === 25;

  // Find the first incomplete stage to link to
  const nextPage = groups < 12 ? "/groups" : knockoutFilled < 31 ? "/knockout" : "/special-bets";
  const nextLabel = groups < 12 ? "שלב הבתים" : knockoutFilled < 31 ? "עץ הטורניר" : "הימורים מיוחדים";

  return (
    <div className="mb-5">
      {!allDone && (
        <Link href={nextPage} className="block">
          <div className="bg-gradient-to-l from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl px-5 py-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <p className="text-base font-black text-amber-900">חסרים לך הימורים!</p>
              </div>
              <span className="text-sm font-bold text-amber-700 bg-amber-100 rounded-full px-3 py-1">
                המשך ל{nextLabel} ←
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className={`rounded-xl px-3 py-2 text-center ${groups === 12 ? "bg-green-100 border border-green-200" : "bg-white border border-amber-200"}`}>
                <p className="text-lg font-black" style={{ fontFamily: "var(--font-inter)" }}>
                  {groups === 12 ? "✓" : `${groups}/12`}
                </p>
                <p className={`text-[11px] font-bold ${groups === 12 ? "text-green-700" : "text-amber-800"}`}>בתים</p>
              </div>
              <div className={`rounded-xl px-3 py-2 text-center ${knockoutFilled === 31 ? "bg-green-100 border border-green-200" : "bg-white border border-amber-200"}`}>
                <p className="text-lg font-black" style={{ fontFamily: "var(--font-inter)" }}>
                  {knockoutFilled === 31 ? "✓" : `${knockoutFilled}/31`}
                </p>
                <p className={`text-[11px] font-bold ${knockoutFilled === 31 ? "text-green-700" : "text-amber-800"}`}>נוקאאוט</p>
              </div>
              <div className={`rounded-xl px-3 py-2 text-center ${specialsFilled === 25 ? "bg-green-100 border border-green-200" : "bg-white border border-amber-200"}`}>
                <p className="text-lg font-black" style={{ fontFamily: "var(--font-inter)" }}>
                  {specialsFilled === 25 ? "✓" : `${specialsFilled}/25`}
                </p>
                <p className={`text-[11px] font-bold ${specialsFilled === 25 ? "text-green-700" : "text-amber-800"}`}>מיוחדים</p>
          </div>
        </div>
      </div>
    </Link>
      )}
    </div>
  );
}

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

// Tooltip — mobile: bottom sheet with close button, desktop: hover popup
function PlayerTooltip({ player, visible, onClose }: { player: typeof MOCK_PLAYERS[0]; visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  const b = player.breakdown;
  return (
    <>
      <div className="fixed inset-0 z-[55] bg-black/20 sm:bg-transparent" onClick={onClose} />
      <div className="fixed z-[60] inset-x-3 bottom-20 sm:bottom-auto sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-72 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 text-sm max-h-[70vh] overflow-y-auto" dir="rtl">
      <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
        <p className="font-bold text-base text-gray-900">{player.name} — {player.total} נק׳</p>
        <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 shrink-0 transition-colors" aria-label="סגור">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
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
    </>
  );
}

type SortKey = "total" | "matchPts" | "advPts" | "specPts";

function SortableHeader({
  label,
  sortKey,
  activeTab,
  setActiveTab,
  width,
}: {
  label: string;
  sortKey: SortKey;
  activeTab: SortKey;
  setActiveTab: (k: SortKey) => void;
  width: string;
}) {
  const isActive = activeTab === sortKey;
  return (
    <button
      type="button"
      onClick={() => setActiveTab(sortKey)}
      className={`${width} text-center font-semibold transition-colors ${
        isActive ? "text-blue-600" : "text-gray-500 hover:text-gray-800"
      }`}
      title="לחצו למיון"
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {isActive && <span className="text-[9px]">▼</span>}
      </span>
    </button>
  );
}
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

interface MatchApi {
  id: number;
  date: string;
  homeTla: string;
  awayTla: string;
  group?: string;
  stage?: string;
  status?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
}

export default function StandingsPage() {
  const totalFilled = useBettingStore((s) => s.getTotalFilledMatches());
  const [hoveredPlayer, setHoveredPlayer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SortKey>("total");
  const currentUserId = useCurrentUser();
  // Load real data from Supabase (falls back to empty arrays if not configured)
  const { profiles, scoringLog, brackets, specialBets, advancements } = useSharedData();

  // Load finished matches for live scoring
  const [finishedMatches, setFinishedMatches] = useState<FinishedMatch[]>([]);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/matches");
        const data = await res.json();
        const all: MatchApi[] = data.matches || [];
        const finished = all
          .filter(
            (m) =>
              m.status === "FINISHED" &&
              m.homeGoals !== null && m.homeGoals !== undefined &&
              m.awayGoals !== null && m.awayGoals !== undefined
          )
          .map((m) => ({
            id: m.id,
            date: m.date,
            homeTla: m.homeTla,
            awayTla: m.awayTla,
            group: normalizeGroupLetter(m.group),
            stage: m.stage || "GROUP_STAGE",
            homeGoals: m.homeGoals as number,
            awayGoals: m.awayGoals as number,
          }));
        if (alive) setFinishedMatches(finished);
      } catch {
        if (alive) setFinishedMatches([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Live-computed scores (from finished matches + brackets, fills the gap
  // left by an empty scoring_log table in the demo).
  const liveScores = useMemo(
    () => computeLiveScores(brackets, finishedMatches),
    [brackets, finishedMatches]
  );
  const todayScores = useMemo(
    () => computeTodayScores(brackets, finishedMatches),
    [brackets, finishedMatches]
  );
  // Cumulative points per bettor across all finished matches — drives the sparkline.
  const playerHistories = useMemo(
    () => computePlayerHistories(brackets, finishedMatches),
    [brackets, finishedMatches]
  );

  // Build real players from Supabase profiles + live scoring
  const realPlayers = useMemo(() => {
    if (profiles.length === 0) return [];

    return profiles.map((profile) => {
      if (!profile.id) return null;
      const userEntries = scoringLog.filter((e) => e.userId === profile.id);
      const live = liveScores[profile.id];

      // Start from scoring_log aggregates (historic/server scoring, if any)
      const breakdown = {
        totoGroup: 0, exactGroup: 0, totoKnockout: 0, exactKnockout: 0,
        groupAdvExact: 0, groupAdvPartial: 0, advQF: 0, advSF: 0,
        advFinal: 0, winner: 0, topScorer: 0, topAssists: 0,
        bestAttack: 0, specials: 0,
      };
      for (const entry of userEntries) {
        const bucket = REASON_TO_BUCKET[entry.reason];
        if (bucket) breakdown[bucket] += entry.points;
      }

      // Overlay live-computed match scoring (group stage — replaces whatever was in
      // scoring_log for match rows, since the live computation is authoritative).
      if (live) {
        breakdown.totoGroup = live.totoGroup;
        breakdown.exactGroup = live.exactGroup;
        breakdown.totoKnockout = live.totoKnockout;
        breakdown.exactKnockout = live.exactKnockout;
      }

      // Totals by bucket
      const matchPts = breakdown.totoGroup + breakdown.exactGroup + breakdown.totoKnockout + breakdown.exactKnockout;
      const advPts = breakdown.groupAdvExact + breakdown.groupAdvPartial + breakdown.advQF + breakdown.advSF + breakdown.advFinal + breakdown.winner;
      const specPts = breakdown.topScorer + breakdown.topAssists + breakdown.bestAttack + breakdown.specials;
      const total = matchPts + advPts + specPts;

      // Stats
      const exactHits = live?.exactHits ?? 0;
      const totoHits = live?.totoHits ?? 0;
      const played = live?.totalFinished ?? 0;
      const totoPct = played > 0 ? Math.round((totoHits / played) * 100) : 0;
      const todayPts = todayScores[profile.id] ?? 0;

      return {
        id: profile.id,
        name: profile.displayName || "ללא שם",
        matchPts,
        advPts,
        specPts,
        total,
        today: todayPts > 0 ? `+${todayPts}` : "0",
        delta: 0,
        toto: `${totoPct}%`,
        exact: exactHits,
        streak: 0,
        bestDay: `+${Math.max(todayPts, 0)}`,
        isYou: profile.id === currentUserId,
        breakdown,
      };
    }).filter(Boolean) as typeof MOCK_PLAYERS;
  }, [profiles, scoringLog, liveScores, todayScores, currentUserId]);

  // Always use real data — never fall back to mock (prevents flash of fake names)
  const PLAYERS = realPlayers;
  const COMPLETION_DATA = MOCK_COMPLETION_DATA; // TODO: build from real data when available

  const handleExportCSV = () => {
    const state = useBettingStore.getState();
    const csv = exportBetsToCSV(state);
    downloadFile(csv, `wc2026-bets-${new Date().toISOString().split("T")[0]}.csv`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
      {/* Today's matches — auto-hides when no matches today */}
      <TodayMatches />

      {/* Smart missing-bets banner */}
      <MissingBetsBanner />

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>טבלה</h1>
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
        </div>
      </div>

      {/* Main leaderboard — FIRST and most prominent */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-visible hover:shadow-lg transition-all mb-6">
        <div className="px-5 py-3 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
          <h2 className="text-base font-bold text-gray-800">טבלת דירוג</h2>
          <p className="text-xs text-gray-400 mt-0.5">לחצו על כותרת עמודה כדי למיין לפיה</p>
        </div>

        {/* Table header — mobile (clickable) */}
        <div className="flex sm:hidden items-center px-4 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200 font-semibold" style={{ fontFamily: "var(--font-inter)" }}>
          <span className="w-8 text-center">#</span>
          <span className="w-9 me-2"></span>
          <span className="me-3 flex-1 text-start">שחקן</span>
          <SortableHeader label={TABS.find(t => t.key === activeTab)?.label || ""} sortKey={activeTab} activeTab={activeTab} setActiveTab={setActiveTab} width="w-12" />
          <span className="w-12 text-center">היום</span>
          <SortableHeader label="סה״כ" sortKey="total" activeTab={activeTab} setActiveTab={setActiveTab} width="w-16" />
          <span className="w-8 text-center">שינוי</span>
        </div>
        {/* Table header — desktop (clickable) */}
        <div className="hidden sm:flex items-center px-4 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200 font-semibold" style={{ fontFamily: "var(--font-inter)" }}>
          <span className="w-8 text-center">#</span>
          <span className="w-10 me-2"></span>
          <span className="me-3 flex-1 text-start">שחקן</span>
          <SortableHeader label="משחקים" sortKey="matchPts" activeTab={activeTab} setActiveTab={setActiveTab} width="w-14" />
          <SortableHeader label="עולות" sortKey="advPts" activeTab={activeTab} setActiveTab={setActiveTab} width="w-14" />
          <SortableHeader label="מיוחדים" sortKey="specPts" activeTab={activeTab} setActiveTab={setActiveTab} width="w-14" />
          <span className="w-20 text-center">מגמה</span>
          <span className="w-12 text-center">היום</span>
          <SortableHeader label="סה״כ" sortKey="total" activeTab={activeTab} setActiveTab={setActiveTab} width="w-16" />
          <span className="w-8 text-center">שינוי</span>
        </div>

        {[...PLAYERS].sort((a, b) => b[activeTab] - a[activeTab]).map((p, i) => {
          // Real cumulative history from finished matches. Fallback to a flat
          // [0, total] when no matches are finished yet so the line renders.
          const realHistory = playerHistories[p.id];
          const history = realHistory && realHistory.length >= 2
            ? realHistory
            : [0, p.total || 0];
          return (
            <div key={p.id}
              className={`relative flex items-center px-4 py-3 border-b border-gray-100 last:border-0 transition-colors ${
                p.isYou ? "bg-blue-50/50" : "hover:bg-gray-50/50"
              }`}
              onClick={() => setHoveredPlayer(hoveredPlayer === p.id ? null : p.id)}
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
                <PlayerTooltip player={p} visible={hoveredPlayer === p.id} onClose={() => setHoveredPlayer(null)} />
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

      {/* מצטיין היום / חולשת היום — only when real scoring data exists */}
      {PLAYERS.length >= 2 && PLAYERS[0]?.total > 0 && (() => {
        const sorted = [...PLAYERS].sort((a, b) => parseInt(b.today || "0") - parseInt(a.today || "0"));
        const heroPlayer = sorted[0];
        const roastPlayer = sorted[sorted.length - 1];
        if (!heroPlayer?.name || !roastPlayer?.name) return null;
        return (
          <HeroRoast
            hero={{ name: heroPlayer.name, points: parseInt(heroPlayer.today || "0"), highlight: `${heroPlayer.exact} מדויקות!` }}
            roast={{ name: roastPlayer.name, points: parseInt(roastPlayer.today || "0"), highlight: `רק ${roastPlayer.today || "0"} — יום קשה` }}
            matchday=""
          />
        );
      })()}

      {/* מירוץ הנקודות — only when real scoring data exists */}
      {PLAYERS.length >= 2 && PLAYERS[0]?.total > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">מירוץ הנקודות</h2>
          {(() => {
            const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#EC4899", "#06B6D4", "#F97316", "#6366F1", "#14B8A6", "#E11D48"];
            const raceData = PLAYERS.map((p, idx) => {
              const steps = 10;
              const history = Array.from({ length: steps }, (_, i) =>
                Math.round((p.total / steps) * (i + 1) + (Math.sin(idx + i) * 8))
              );
              history[steps - 1] = p.total;
              return { name: p.name, color: COLORS[idx % COLORS.length], history };
            });
            const matchdays = Array.from({ length: 10 }, (_, i) => `יום ${i + 1}`);
            return <LeaderboardRace data={raceData} matchdays={matchdays} />;
          })()}
        </div>
      )}

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

      {/* Post-lock completion summary moved to admin only, per product decision.
          Kept this block wrapped in `false` so it can be revived without having
          to rewrite the computation. Admin sees the same info in
          /admin → "סטטוס מילוי" tab. */}
      {false && isLocked() && profiles.length > 0 && (
        <div className="mt-8 bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-l from-white via-amber-50/30 to-orange-50/40 border-b border-amber-100/50">
            <h3 className="text-lg font-bold text-gray-900">סטטוס מילוי הימורים</h3>
            <p className="text-sm text-gray-500">מי מילא ומי עוד לא — תמונת מצב</p>
          </div>
          <div className="p-4 space-y-2">
            {profiles.map((profile) => {
              const b = brackets.find((br) => br.userId === profile.id);
              const sb = specialBets.find((s) => s.userId === profile.id);
              const adv = advancements.find((a) => a.userId === profile.id);

              // Count completed groups
              let groupsDone = 0;
              if (b?.groupPredictions) {
                for (const letter of ["A","B","C","D","E","F","G","H","I","J","K","L"]) {
                  const g = (b.groupPredictions as Record<string, { scores?: { home: number | null; away: number | null }[] }>)[letter];
                  if (g?.scores) {
                    const filled = g.scores.filter((s) => s.home !== null && s.away !== null).length;
                    if (filled === 6) groupsDone++;
                  }
                }
              }

              // Count knockout
              const koFilled = b?.knockoutTree
                ? Object.values(b.knockoutTree as Record<string, { winner?: string | null }>).filter((m) => m?.winner).length
                : 0;

              // Count specials + advancement
              let specFilled = 0;
              if (sb) {
                if (sb.topScorerPlayer) specFilled++;
                if (sb.topAssistsPlayer) specFilled++;
                if (sb.bestAttackTeam) specFilled++;
                if (sb.prolificGroup) specFilled++;
                if (sb.driestGroup) specFilled++;
                if (sb.dirtiestTeam) specFilled++;
                if (sb.matchupPick) specFilled += sb.matchupPick.split(",").filter(Boolean).length;
                if (sb.penaltiesOverUnder) specFilled++;
              }
              if (adv) {
                specFilled += (adv.advanceToQF || []).filter(Boolean).length;
                specFilled += (adv.advanceToSF || []).filter(Boolean).length;
                specFilled += (adv.advanceToFinal || []).filter(Boolean).length;
                if (adv.winner) specFilled++;
              }

              const total = groupsDone + koFilled + specFilled;
              const pct = Math.round((total / 68) * 100);
              const isComplete = pct === 100;
              const isMe = profile.id === currentUserId;

              return (
                <div key={profile.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isMe ? "bg-blue-50" : "bg-gray-50"}`}>
                  <span className="font-bold text-sm text-gray-900 w-20 truncate">
                    {profile.displayName || "ללא שם"}
                    {isMe && <span className="text-[10px] text-blue-500 ms-1">אתה</span>}
                  </span>
                  <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isComplete ? "bg-green-500" : pct >= 50 ? "bg-amber-500" : "bg-red-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className={`font-black text-sm w-12 text-end ${isComplete ? "text-green-600" : pct >= 50 ? "text-amber-600" : "text-red-500"}`} style={{ fontFamily: "var(--font-inter)" }}>
                    {pct}%
                  </span>
                  {isComplete && <span className="text-green-600 text-sm">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
