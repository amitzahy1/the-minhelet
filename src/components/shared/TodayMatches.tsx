"use client";

import { useState, useEffect } from "react";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import { toIsraelTimeShort, toIsraelDateKey, getTodayIsrael } from "@/lib/timezone";

interface Match {
  id: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeTla: string;
  awayTla: string;
  group: string;
  stage: string;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
}

export function TodayMatches() {
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/matches");
        const data = await res.json();
        if (!data.matches) return;
        const today = getTodayIsrael();
        const todayMatches = (data.matches as Match[]).filter(
          (m) => toIsraelDateKey(m.date) === today
        );
        setMatches(todayMatches);
      } catch { /* silent — component gracefully hides */ }
    })();
  }, []);

  if (matches.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
        <h2 className="text-lg font-bold text-gray-800">משחקים היום</h2>
        <span className="text-sm text-gray-400">{matches.length} משחקים</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
        {matches.map((m) => {
          const isFinished = m.status === "FINISHED";
          const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
          return (
            <div
              key={m.id}
              className={`shrink-0 w-44 bg-white rounded-xl border shadow-sm p-3 text-center transition-colors ${
                isLive ? "border-red-300 bg-red-50/30" : isFinished ? "border-green-200" : "border-gray-200"
              }`}
            >
              {/* Status badge */}
              <div className="mb-2">
                {isLive && (
                  <span className="text-[10px] font-bold text-red-600 bg-red-100 rounded-full px-2 py-0.5 inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />LIVE
                  </span>
                )}
                {isFinished && <span className="text-[10px] font-bold text-green-600 bg-green-100 rounded-full px-2 py-0.5">הסתיים</span>}
                {!isLive && !isFinished && (
                  <span className="text-xs font-bold text-gray-500" style={{ fontFamily: "var(--font-inter)" }}>
                    {toIsraelTimeShort(m.date)}
                  </span>
                )}
              </div>

              {/* Teams */}
              <div className="flex items-center justify-between gap-1">
                <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                  <span className="text-xl">{getFlag(m.homeTla)}</span>
                  <span className="text-[11px] font-bold text-gray-800 truncate max-w-full">
                    {getTeamNameHe(m.homeTla) || m.homeTla}
                  </span>
                </div>

                {/* Score or VS */}
                <div className="shrink-0 px-1">
                  {(isLive || isFinished) && m.homeGoals !== null ? (
                    <span className="text-lg font-black tabular-nums text-gray-900" style={{ fontFamily: "var(--font-inter)" }}>
                      {m.homeGoals}-{m.awayGoals}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-gray-300">vs</span>
                  )}
                </div>

                <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                  <span className="text-xl">{getFlag(m.awayTla)}</span>
                  <span className="text-[11px] font-bold text-gray-800 truncate max-w-full">
                    {getTeamNameHe(m.awayTla) || m.awayTla}
                  </span>
                </div>
              </div>

              {/* Group / Stage info */}
              <p className="text-[10px] text-gray-400 mt-1.5">
                {m.group ? `בית ${m.group.replace("GROUP_", "")}` : m.stage}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
