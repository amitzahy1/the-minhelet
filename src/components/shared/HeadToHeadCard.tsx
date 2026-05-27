"use client";

// ============================================================================
// HeadToHeadCard — fetches /api/match-h2h on mount and renders the last
// ~10 meetings between the two teams + the aggregate wins/draws/losses.
// Pure read; cheap; uses 1 API call per match (cached for 10 min upstream).
// ============================================================================

import { useEffect, useState } from "react";
import { TeamLogo } from "./TeamLogo";
import { toIsraelDate } from "@/lib/timezone";

interface H2HMatch {
  id: number;
  date: string;
  competition: string;
  homeTla: string;
  awayTla: string;
  homeGoals: number | null;
  awayGoals: number | null;
  winner: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
}
interface H2HResponse {
  total: number;
  home: { tla: string; wins: number; draws: number; losses: number } | null;
  away: { tla: string; wins: number; draws: number; losses: number } | null;
  matches: H2HMatch[];
  error?: string;
}

export function HeadToHeadCard({ matchId, homeTla, awayTla }: { matchId: number; homeTla: string; awayTla: string }) {
  const [data, setData] = useState<H2HResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/match-h2h?id=${matchId}`)
      .then((r) => r.json())
      .then((j: H2HResponse) => { if (alive) setData(j); })
      .catch(() => { /* swallow — show empty card */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [matchId]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 text-xs text-gray-400">
        טוען היסטוריית מפגשים...
      </div>
    );
  }
  // Aggregates-only fallback — FD's free tier sometimes returns aggregate
  // counts (numberOfMatches > 0) but the matches[] array is empty. Show the
  // summary so the card still has value, instead of "no history available".
  if (data && data.total > 0 && data.matches.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden" dir="rtl">
        <div className="px-4 py-2 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/30 border-b border-blue-100/40">
          <h4 className="text-xs font-bold text-gray-700">📈 היסטוריית מפגשים</h4>
        </div>
        <div className="px-4 py-3 text-xs text-gray-600 leading-relaxed">
          הנבחרות נפגשו <b>{data.total}</b> פעמים בעבר.{" "}
          {data.home && (
            <span>
              <b className="text-blue-700">{homeTla}</b>: {data.home.wins}W · {data.home.draws}D · {data.home.losses}L.
            </span>
          )}
          {" "}פירוט המשחקים לא זמין במנוי החינמי של Football-Data.
        </div>
      </div>
    );
  }
  if (!data || data.matches.length === 0 || data.error) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 px-4 py-3 text-xs text-gray-500">
        זהו מפגש ראשון בין הנבחרות (לפי Football-Data).
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden" dir="rtl">
      <div className="px-4 py-2 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/30 border-b border-blue-100/40 flex items-center justify-between">
        <h4 className="text-xs font-bold text-gray-700">📈 {data.matches.length} המפגשים האחרונים</h4>
        {data.home && data.away && (
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <span><b className="text-blue-700">{homeTla}</b> {data.home.wins}W</span>
            <span>·</span>
            <span>{data.home.draws}D</span>
            <span>·</span>
            <span>{data.home.losses}L vs <b className="text-blue-700">{awayTla}</b></span>
          </div>
        )}
      </div>
      <ul className="divide-y divide-gray-100">
        {data.matches.slice(0, 6).map((m) => {
          const homeWon = m.winner === "HOME_TEAM";
          const awayWon = m.winner === "AWAY_TEAM";
          return (
            <li key={m.id} className="px-4 py-1.5 flex items-center gap-2 text-xs">
              <span className="w-16 text-[10px] text-gray-400 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
                {toIsraelDate(m.date)?.slice(0, 7) || ""}
              </span>
              <span className="flex-1 flex items-center gap-1.5 justify-end">
                <span className={`font-bold ${homeWon ? "text-green-700" : awayWon ? "text-gray-400" : "text-gray-700"}`}>{m.homeTla}</span>
                <TeamLogo code={m.homeTla} size="sm" flagOnly />
              </span>
              <span className="font-black tabular-nums text-gray-800 px-2" style={{ fontFamily: "var(--font-inter)" }}>
                {m.homeGoals ?? "-"}-{m.awayGoals ?? "-"}
              </span>
              <span className="flex-1 flex items-center gap-1.5">
                <TeamLogo code={m.awayTla} size="sm" flagOnly />
                <span className={`font-bold ${awayWon ? "text-green-700" : homeWon ? "text-gray-400" : "text-gray-700"}`}>{m.awayTla}</span>
              </span>
              <span className="w-20 text-[9px] text-gray-400 truncate">{m.competition}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
