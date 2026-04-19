"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import { toIsraelTimeShort, toIsraelDate, toIsraelDateKey, getTodayIsrael } from "@/lib/timezone";
import { useSharedData } from "@/hooks/useSharedData";
import { isLocked } from "@/lib/constants";
import { GROUPS } from "@/lib/tournament/groups";

// Positions (in GROUPS[letter] order) of the 6 group-stage matches
const GROUP_MATCH_PAIRS: Array<[number, number]> = [
  [0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2],
];

type HitKind = "exact" | "toto" | "miss";

function classifyHit(
  pred: { home: number | null; away: number | null },
  actual: { home: number; away: number }
): HitKind {
  if (pred.home === null || pred.away === null) return "miss";
  if (pred.home === actual.home && pred.away === actual.away) return "exact";
  const predOut = pred.home > pred.away ? "H" : pred.home < pred.away ? "A" : "D";
  const actOut = actual.home > actual.away ? "H" : actual.home < actual.away ? "A" : "D";
  return predOut === actOut ? "toto" : "miss";
}

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

// Demo matches shown before the tournament starts
const DEMO_MATCHES: Match[] = [
  { id: -1, date: "2026-06-11T16:00:00Z", homeTeam: "Mexico", awayTeam: "South Korea", homeTla: "MEX", awayTla: "KOR", group: "GROUP_A", stage: "GROUP_STAGE", status: "SCHEDULED", homeGoals: null, awayGoals: null },
  { id: -2, date: "2026-06-11T19:00:00Z", homeTeam: "Argentina", awayTeam: "Czech Republic", homeTla: "ARG", awayTla: "CZE", group: "GROUP_J", stage: "GROUP_STAGE", status: "SCHEDULED", homeGoals: null, awayGoals: null },
  { id: -3, date: "2026-06-11T22:00:00Z", homeTeam: "France", awayTeam: "Iraq", homeTla: "FRA", awayTla: "IRQ", group: "GROUP_I", stage: "GROUP_STAGE", status: "SCHEDULED", homeGoals: null, awayGoals: null },
];

export function TodayMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [heading, setHeading] = useState("משחקים קרובים");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { predictions, specialBets, brackets, profiles } = useSharedData();
  const locked = isLocked();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/matches");
        const data = await res.json();
        if (!data.matches || data.matches.length === 0) {
          setMatches(DEMO_MATCHES);
          setHeading("משחקים קרובים — תצוגה מקדימה");
          return;
        }

        const allMatches = data.matches as Match[];
        const today = getTodayIsrael();

        const todayMatches = allMatches.filter((m) => toIsraelDateKey(m.date) === today);
        if (todayMatches.length > 0) {
          setMatches(todayMatches);
          setHeading("משחקים היום");
          return;
        }

        const upcoming = allMatches
          .filter((m) => m.status === "SCHEDULED" || m.status === "TIMED")
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 4);

        if (upcoming.length > 0) {
          setMatches(upcoming);
          const nextDate = toIsraelDate(upcoming[0].date);
          setHeading(`המשחקים הבאים — ${nextDate}`);
          return;
        }

        setMatches(DEMO_MATCHES);
        setHeading("משחקים קרובים — תצוגה מקדימה");
      } catch {
        setMatches(DEMO_MATCHES);
        setHeading("משחקים קרובים — תצוגה מקדימה");
      }
    })();
  }, []);

  if (matches.length === 0) return null;

  // Build bettors' special bets relevant to a match's teams
  function getRelatedBets(homeTla: string, awayTla: string) {
    if (!locked || specialBets.length === 0) return [];
    const bets: { name: string; type: string; detail: string }[] = [];
    for (const sb of specialBets) {
      if (sb.bestAttackTeam === homeTla || sb.bestAttackTeam === awayTla) {
        bets.push({ name: sb.displayName, type: "התקפה", detail: getFlag(sb.bestAttackTeam!) });
      }
      if (sb.dirtiestTeam === homeTla || sb.dirtiestTeam === awayTla) {
        bets.push({ name: sb.displayName, type: "כסחנית", detail: getFlag(sb.dirtiestTeam!) });
      }
    }
    return bets;
  }

  /**
   * Derive each bettor's predicted score for a finished group match from
   * their stored group_predictions. The store saves scores in a fixed
   * order (GROUP_MATCH_PAIRS) keyed by canonical team positions.
   */
  function getGroupPredictions(
    homeTla: string,
    awayTla: string,
    groupLetter: string,
    actualHome: number,
    actualAway: number
  ): Array<{ userId: string; name: string; pred: { home: number | null; away: number | null }; hit: HitKind }> {
    const teams = GROUPS[groupLetter];
    if (!teams) return [];
    const homeIdx = teams.findIndex((t) => t.code === homeTla);
    const awayIdx = teams.findIndex((t) => t.code === awayTla);
    if (homeIdx < 0 || awayIdx < 0) return [];

    // Find which of the 6 pairs matches this match, and whether it's flipped.
    let pairIdx = -1;
    let flipped = false;
    for (let i = 0; i < GROUP_MATCH_PAIRS.length; i++) {
      const [a, b] = GROUP_MATCH_PAIRS[i];
      if (a === homeIdx && b === awayIdx) { pairIdx = i; flipped = false; break; }
      if (a === awayIdx && b === homeIdx) { pairIdx = i; flipped = true; break; }
    }
    if (pairIdx < 0) return [];

    const out: Array<{ userId: string; name: string; pred: { home: number | null; away: number | null }; hit: HitKind }> = [];
    for (const b of brackets) {
      const stored = b.groupPredictions?.[groupLetter]?.scores?.[pairIdx];
      if (!stored || (stored.home === null && stored.away === null)) continue;
      const pred = flipped
        ? { home: stored.away, away: stored.home }
        : { home: stored.home, away: stored.away };
      out.push({
        userId: b.userId,
        name: b.displayName || "ללא שם",
        pred,
        hit: classifyHit(pred, { home: actualHome, away: actualAway }),
      });
    }
    // Sort: exact first, then toto, then miss. Within each, alphabetical.
    const rank: Record<HitKind, number> = { exact: 0, toto: 1, miss: 2 };
    return out.sort((a, b) => rank[a.hit] - rank[b.hit] || a.name.localeCompare(b.name, "he"));
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
        <h2 className="text-base font-bold text-gray-800">{heading}</h2>
        <span className="text-sm text-gray-400">{matches.length} משחקים</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {matches.map((m) => {
          const isFinished = m.status === "FINISHED";
          const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
          const isExpanded = expandedId === m.id;
          const relatedBets = getRelatedBets(m.homeTla, m.awayTla);
          const matchPredictions = locked ? predictions.filter(p => p.matchId === m.id) : [];
          // For finished GROUP matches, also build per-bettor hit/miss from stored bracket picks.
          const groupLetter = m.group ? m.group.replace(/^GROUP_/, "").trim() : "";
          const groupHits = (locked && isFinished && groupLetter && m.homeGoals !== null && m.awayGoals !== null)
            ? getGroupPredictions(m.homeTla, m.awayTla, groupLetter, m.homeGoals, m.awayGoals)
            : [];
          const exactCount = groupHits.filter(h => h.hit === "exact").length;
          const totoCount = groupHits.filter(h => h.hit === "toto").length;
          const missCount = groupHits.filter(h => h.hit === "miss").length;

          return (
            <div key={m.id} className="col-span-1">
              <div
                onClick={() => setExpandedId(isExpanded ? null : m.id)}
                className={`bg-white rounded-xl border shadow-sm p-3 text-center transition-all cursor-pointer ${
                  isLive ? "border-red-300 bg-red-50/30" :
                  isFinished ? "border-green-200" :
                  isExpanded ? "border-blue-300 shadow-md" :
                  "border-gray-200 hover:border-gray-300 hover:shadow-md"
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

                {/* Group + expand hint */}
                <div className="flex items-center justify-center gap-1 mt-1.5">
                  <p className="text-[10px] text-gray-400">
                    {m.group ? `בית ${m.group.replace("GROUP_", "")}` : m.stage}
                  </p>
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className={`text-gray-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Expanded panel — bettors' predictions */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-gray-50 rounded-b-xl border border-t-0 border-gray-200 px-3 py-2.5 mt-[-4px]">
                      {!locked ? (
                        <p className="text-[11px] text-amber-700 font-medium text-center py-1">
                          ההימורים ייחשפו אחרי הנעילה
                        </p>
                      ) : matchPredictions.length === 0 && relatedBets.length === 0 && groupHits.length === 0 ? (
                        <p className="text-[11px] text-gray-400 text-center py-1">
                          אין הימורים למשחק הזה
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {/* Group-stage predictions vs actual result (only for FINISHED group matches) */}
                          {groupHits.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 mb-1">
                                תוצאה: <span className="tabular-nums text-gray-700">{m.homeGoals}-{m.awayGoals}</span>
                                <span className="mx-1.5">·</span>
                                <span className="text-green-700">🎯 {exactCount} בול</span>
                                <span className="mx-1">·</span>
                                <span className="text-amber-700">✓ {totoCount} 1X2</span>
                                {missCount > 0 && (
                                  <>
                                    <span className="mx-1">·</span>
                                    <span className="text-red-600">✗ {missCount}</span>
                                  </>
                                )}
                              </p>
                              <div className="grid grid-cols-2 gap-1">
                                {groupHits.map((h) => {
                                  const bg =
                                    h.hit === "exact"
                                      ? "bg-green-50 border-green-300"
                                      : h.hit === "toto"
                                      ? "bg-amber-50 border-amber-300"
                                      : "bg-red-50 border-red-200";
                                  const icon = h.hit === "exact" ? "🎯" : h.hit === "toto" ? "✓" : "✗";
                                  return (
                                    <div
                                      key={h.userId}
                                      className={`flex items-center justify-between rounded-lg px-2 py-1 border ${bg}`}
                                    >
                                      <span className="text-[11px] font-bold text-gray-800 truncate">{h.name}</span>
                                      <span className="flex items-center gap-1 shrink-0">
                                        <span className="text-[11px] font-black tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
                                          {h.pred.home}-{h.pred.away}
                                        </span>
                                        <span className="text-xs">{icon}</span>
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Score predictions */}
                          {matchPredictions.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 mb-1">ניחושי תוצאה (live)</p>
                              <div className="grid grid-cols-2 gap-1">
                                {matchPredictions.map((p, i) => (
                                  <div key={i} className="flex items-center justify-between bg-white rounded-lg px-2 py-1 border border-gray-100">
                                    <span className="text-[11px] font-bold text-gray-700 truncate">{p.displayName}</span>
                                    <span className="text-[11px] font-black text-blue-600 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
                                      {p.predictedHomeGoals}-{p.predictedAwayGoals}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Related special bets */}
                          {relatedBets.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 mb-1">הימורים מיוחדים</p>
                              {relatedBets.slice(0, 4).map((b, i) => (
                                <div key={i} className="flex items-center gap-1 text-[11px] text-gray-600">
                                  <span className="font-bold">{b.name}</span>
                                  <span className="text-gray-400">·</span>
                                  <span>{b.type}</span>
                                  <span className="text-gray-400">{b.detail}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
