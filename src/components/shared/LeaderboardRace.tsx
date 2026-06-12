"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

/** One scored event for one player at one step (e.g. a finished match). */
export interface RaceContribution {
  /** Short event label, e.g. "מקסיקו 2-0 דרום אפריקה". */
  label: string;
  /** Points gained at this step (0 = miss/empty — still shown so hover explains the gap). */
  pts: number;
  /** Extra detail, e.g. "מדויקת (ניחש 2-0)" / "טוטו (ניחש 3-0)" / "פספס (ניחש 1-1)". */
  note?: string;
}

interface RaceEntry {
  name: string;
  color: string;
  history: number[]; // cumulative points at each step (aligned with matchdays)
  /** Per-step contribution, aligned with history. Drives the hover breakdown. */
  contributions?: (RaceContribution | null)[];
}

interface LeaderboardRaceProps {
  data: RaceEntry[];
  matchdays: string[]; // step labels, e.g. the finished matches
}

// Mock data (storybook/empty-state preview only)
const MOCK_DATA: RaceEntry[] = [
  { name: "דני", color: "#3B82F6", history: [6, 14, 25, 38, 52, 65, 78, 95, 112, 130] },
  { name: "יוני", color: "#10B981", history: [8, 18, 28, 35, 48, 60, 75, 88, 105, 122] },
  { name: "אמית", color: "#F59E0B", history: [4, 10, 20, 32, 50, 62, 74, 90, 108, 120] },
  { name: "דור", color: "#8B5CF6", history: [10, 20, 30, 40, 46, 55, 68, 82, 100, 115] },
  { name: "רון ב", color: "#EF4444", history: [5, 12, 22, 30, 42, 58, 70, 80, 96, 110] },
  { name: "עידן", color: "#EC4899", history: [7, 15, 18, 26, 36, 45, 55, 68, 85, 102] },
];

const MOCK_MATCHDAYS = ["יום 1", "יום 2", "יום 3", "יום 4", "יום 5", "יום 6", "יום 7", "יום 8", "יום 9", "יום 10"];

export function LeaderboardRace({
  data = MOCK_DATA,
  matchdays = MOCK_MATCHDAYS,
}: Partial<LeaderboardRaceProps>) {
  const [currentDay, setCurrentDay] = useState(Math.max(0, matchdays.length - 1));
  const [isPlaying, setIsPlaying] = useState(false);
  // Hover (desktop) or tap (mobile) opens the per-player breakdown.
  const [openPlayer, setOpenPlayer] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const maxPoints = Math.max(...data.flatMap((d) => d.history), 1);

  const currentSnapshot = data
    .map((d) => ({
      name: d.name,
      color: d.color,
      points: d.history[currentDay] ?? 0,
      contributions: (d.contributions || []).slice(0, currentDay + 1),
    }))
    .sort((a, b) => b.points - a.points);

  const stopPlaying = useCallback(() => {
    setIsPlaying(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPlaying = useCallback(() => {
    setIsPlaying(true);
    setCurrentDay((prev) => (prev >= matchdays.length - 1 ? 0 : prev));
  }, [matchdays.length]);

  useEffect(() => {
    if (!isPlaying) return;
    intervalRef.current = setInterval(() => {
      setCurrentDay((prev) => {
        if (prev >= matchdays.length - 1) {
          stopPlaying();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, matchdays.length, stopPlaying]);

  const goNext = () => {
    stopPlaying();
    setCurrentDay((prev) => Math.min(prev + 1, matchdays.length - 1));
  };

  const goPrev = () => {
    stopPlaying();
    setCurrentDay((prev) => Math.max(prev - 1, 0));
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-5" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">מירוץ הדירוג</h3>
          <p className="text-sm text-gray-500">
            {matchdays[currentDay]} ({currentDay + 1} מתוך {matchdays.length})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            disabled={currentDay === 0}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <button
            onClick={isPlaying ? stopPlaying : startPlaying}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
              isPlaying
                ? "bg-red-100 text-red-700 hover:bg-red-200"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {isPlaying ? "עצור" : "הפעל"}
          </button>
          <button
            onClick={goNext}
            disabled={currentDay === matchdays.length - 1}
            className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full mb-5 overflow-hidden">
        <motion.div
          className="h-full bg-blue-500 rounded-full"
          animate={{ width: `${((currentDay + 1) / matchdays.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Bars */}
      <div className="space-y-2">
        <AnimatePresence>
          {currentSnapshot.map((entry, rank) => {
            const barWidth = maxPoints > 0 ? (entry.points / maxPoints) * 100 : 0;
            const isOpen = openPlayer === entry.name;
            const scoredContribs = entry.contributions.filter((c): c is RaceContribution => !!c);
            return (
              <motion.div
                key={entry.name}
                layout
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="relative flex items-center gap-3"
                onMouseEnter={() => setOpenPlayer(entry.name)}
                onMouseLeave={() => setOpenPlayer((p) => (p === entry.name ? null : p))}
                onClick={() => setOpenPlayer(isOpen ? null : entry.name)}
              >
                <span className="w-14 text-sm font-bold text-gray-800 text-start shrink-0 truncate">
                  {entry.name}
                </span>
                <div className="flex-1 h-8 bg-gray-50 rounded-lg overflow-hidden relative cursor-pointer">
                  <motion.div
                    className="h-full rounded-lg flex items-center justify-end px-2"
                    style={{ backgroundColor: entry.color }}
                    animate={{ width: `${Math.max(barWidth, 3)}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  >
                    <span
                      className="text-xs font-bold text-white drop-shadow-sm"
                      style={{ fontFamily: "var(--font-inter)" }}
                    >
                      {entry.points}
                    </span>
                  </motion.div>
                </div>
                <span
                  className="w-6 text-xs font-bold text-gray-400 text-center shrink-0"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  #{rank + 1}
                </span>

                {/* Breakdown tooltip — where this player's points came from.
                    Capped to the last 10 events: by group-stage end there are
                    ~72, which would overflow the viewport (and the tooltip is
                    pointer-events-none, so it can't scroll). */}
                {isOpen && scoredContribs.length > 0 && (() => {
                  const visible = scoredContribs.slice(-10);
                  const hiddenCount = scoredContribs.length - visible.length;
                  return (
                    <div className="absolute z-30 bottom-full mb-1 start-14 max-w-[calc(100%-3.5rem)] bg-gray-900 text-white rounded-xl shadow-xl px-3 py-2 text-xs leading-relaxed pointer-events-none">
                      <p className="font-bold border-b border-white/20 pb-1 mb-1">
                        {entry.name} · {entry.points} נק׳
                      </p>
                      {hiddenCount > 0 && (
                        <p className="text-gray-400">+{hiddenCount} משחקים קודמים</p>
                      )}
                      {visible.map((c, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 whitespace-nowrap">
                          <span className="truncate">{c.label}</span>
                          <span className={`font-bold shrink-0 ${c.pts > 0 ? "text-green-300" : "text-red-300"}`} style={{ fontFamily: "var(--font-inter)" }}>
                            {c.pts > 0 ? `+${c.pts}` : "0"}
                            {c.note ? ` · ${c.note}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <p className="text-[11px] text-gray-400 mt-3 text-center">
        נקודות ממשחקי הבתים בלבד · ריחוף/לחיצה על שחקן מציג מאיפה הגיעו הנקודות
      </p>
    </div>
  );
}

export default LeaderboardRace;
