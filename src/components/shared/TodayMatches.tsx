"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import { TeamLogo } from "@/components/shared/TeamLogo";
import { toIsraelTimeShort, toIsraelDate, toIsraelDateShort, toIsraelDateKey, getTodayIsrael } from "@/lib/timezone";
import { useSharedData } from "@/hooks/useSharedData";
import { isLocked, revealAtFor, formatLockDeadline, LOCK_DEADLINE } from "@/lib/constants";
import { computeGroupHits, hitCounts, normalizeGroupLetter, matchPairIndex, classifyHit, type HitKind } from "@/lib/results-hits";
import { computeMatchDays, dayLockAtForKickoff, type MatchDay } from "@/lib/tournament/group-live-state";
import { anyMatchInPlayWindow, LIVE_REFRESH_MS } from "@/lib/live-window";

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
  venue?: string | null;
  referees?: { name: string; role: string; nationality: string | null }[];
}

// Demo matches shown before the tournament starts
const DEMO_MATCHES: Match[] = [
  { id: -1, date: "2026-06-11T16:00:00Z", homeTeam: "Mexico", awayTeam: "South Korea", homeTla: "MEX", awayTla: "KOR", group: "GROUP_A", stage: "GROUP_STAGE", status: "SCHEDULED", homeGoals: null, awayGoals: null },
  { id: -2, date: "2026-06-11T19:00:00Z", homeTeam: "Argentina", awayTeam: "Czech Republic", homeTla: "ARG", awayTla: "CZE", group: "GROUP_J", stage: "GROUP_STAGE", status: "SCHEDULED", homeGoals: null, awayGoals: null },
  { id: -3, date: "2026-06-11T22:00:00Z", homeTeam: "France", awayTeam: "Iraq", homeTla: "FRA", awayTla: "IRQ", group: "GROUP_I", stage: "GROUP_STAGE", status: "SCHEDULED", homeGoals: null, awayGoals: null },
];

// Human-readable Hebrew stage label (the API/FD stage codes look like "LAST_32").
const STAGE_LABEL_HE: Record<string, string> = {
  GROUP_STAGE: "שלב הבתים",
  LAST_32: "שלב 32 הגדולות",
  ROUND_OF_32: "שלב 32 הגדולות",
  LAST_16: "שמינית גמר",
  ROUND_OF_16: "שמינית גמר",
  QUARTER_FINALS: "רבע גמר",
  QUARTER_FINAL: "רבע גמר",
  SEMI_FINALS: "חצי גמר",
  SEMI_FINAL: "חצי גמר",
  THIRD_PLACE: "משחק על המקום ה-3",
  FINAL: "גמר",
};
function stageLabelHe(stage?: string): string {
  if (!stage) return "נוק-אאוט";
  return STAGE_LABEL_HE[stage] || "נוק-אאוט";
}

export function TodayMatches() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [heading, setHeading] = useState("משחקים קרובים");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [matchDays, setMatchDays] = useState<MatchDay[]>([]);
  const { specialBets, brackets, refetch } = useSharedData();
  const locked = isLocked();

  // State-backed "now" so reveal gates stay pure during render; bumped by the
  // boundary timer below (and seeded once per mount).
  const [now, setNow] = useState(() => Date.now());

  // Re-render + force-refresh the shared data when the next reveal boundary
  // (global lock or a match-day lock, + the 1-min grace) passes while the
  // widget is on screen — picks appear on time without a manual reload.
  useEffect(() => {
    const boundaries = [
      revealAtFor(LOCK_DEADLINE).getTime(),
      ...matchDays.map((d) => revealAtFor(d.lockAtISO).getTime()),
    ].filter((t) => t > now);
    if (boundaries.length === 0) return;
    const next = Math.min(...boundaries);
    // Boundaries further than a day out are re-armed on the next page load.
    if (next - now > 24 * 60 * 60 * 1000) return;
    const id = setTimeout(() => {
      refetch();
      setNow(Date.now());
    }, next - now + 1_000);
    return () => clearTimeout(id);
  }, [matchDays, refetch, now]);

  // True once a real (non-demo) match list rendered — a later failed poll must
  // not replace live data with the demo placeholder (loadMatches is a stable
  // useCallback, so it can't read the matches state directly).
  const hasRealDataRef = useRef(false);

  const loadMatches = useCallback(async () => {
      try {
        const res = await fetch("/api/matches");
        const data = await res.json();
        if (!data.matches || data.matches.length === 0) {
          if (hasRealDataRef.current) return;
          setMatches(DEMO_MATCHES);
          setHeading("משחקים קרובים — תצוגה מקדימה");
          return;
        }
        hasRealDataRef.current = true;

        const allMatches = data.matches as Match[];
        setAllMatches(allMatches);
        // Match-day lock instants drive the per-match score reveal below.
        setMatchDays(
          computeMatchDays(allMatches.map((mm) => ({ date: mm.date, group: mm.group, stage: mm.stage, status: mm.status }))),
        );
        const today = getTodayIsrael();

        // 1. Matches ON today (by calendar date) — show them all regardless of status.
        //    Keeps live/finished matches visible during matchday instead of
        //    prematurely skipping to the next day.
        const todayMatches = allMatches.filter((m) => toIsraelDateKey(m.date) === today);
        if (todayMatches.length > 0) {
          todayMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          setMatches(todayMatches);
          setHeading("משחקים היום");
          return;
        }

        // 2. No matches today → find the earliest DATE with any match >= today,
        //    then show ALL matches on that date (finished included). Switching
        //    to a by-status filter here is wrong: a full matchday can have some
        //    matches already marked FINISHED (via admin entry) while the rest
        //    are still SCHEDULED — we still want to show the whole day together.
        const futureOrToday = allMatches.filter((m) => toIsraelDateKey(m.date) >= today);
        if (futureOrToday.length > 0) {
          const earliestDate = futureOrToday
            .map((m) => toIsraelDateKey(m.date))
            .sort()[0];
          const matchesOnDate = allMatches
            .filter((m) => toIsraelDateKey(m.date) === earliestDate)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
          setMatches(matchesOnDate);
          setHeading(`המשחקים הבאים — ${toIsraelDate(matchesOnDate[0].date)}`);
          return;
        }

        setMatches(DEMO_MATCHES);
        setHeading("משחקים קרובים — תצוגה מקדימה");
      } catch {
        if (hasRealDataRef.current) return;
        setMatches(DEMO_MATCHES);
        setHeading("משחקים קרובים — תצוגה מקדימה");
      }
  }, []);

  useEffect(() => {
    loadMatches();
  }, [loadMatches]);

  // Live refresh: while any match is in its play window, re-pull the schedule
  // every 60s so scores/statuses move without a manual reload.
  // (The FD fetch behind /api/matches revalidates every 60s too.)
  useEffect(() => {
    const pool = allMatches.length > 0 ? allMatches : matches;
    if (pool.length === 0 || !anyMatchInPlayWindow(pool)) return;
    const id = setInterval(loadMatches, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [allMatches, matches, loadMatches]);

  if (matches.length === 0) return null;

  // Featured selection (collapsed view): ALWAYS the 2 most recently finished
  // matches + the next 2 not-yet-finished (live counts as "next") — across the
  // whole schedule, not just today, so the widget never shrinks to 2 cards on
  // a thin matchday. Backfills from either bucket up to 4.
  const byKickoff = (a: Match, b: Match) => new Date(a.date).getTime() - new Date(b.date).getTime();
  const pool = allMatches.length > 0 ? allMatches : matches;
  const finishedAll = pool.filter((m) => m.status === "FINISHED").sort(byKickoff);
  const upcomingAll = pool.filter((m) => m.status !== "FINISHED").sort(byKickoff);
  const upTake = Math.min(2, upcomingAll.length);
  const finTake = Math.min(finishedAll.length, 4 - upTake);
  const featured = [...finishedAll.slice(-finTake), ...upcomingAll.slice(0, Math.min(upcomingAll.length, 4 - finTake))]
    .sort(byKickoff);
  const todayKey = getTodayIsrael();

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

  function getGroupPredictions(
    homeTla: string,
    awayTla: string,
    groupLetter: string,
    actualHome: number,
    actualAway: number,
    matchId: number
  ) {
    return computeGroupHits(
      {
        id: matchId,
        date: "",
        homeTla,
        awayTla,
        group: groupLetter,
        stage: "GROUP_STAGE",
        homeGoals: actualHome,
        awayGoals: actualAway,
      },
      brackets
    ).filter((h) => h.hit !== "empty");
  }

  const displayed = showAll ? matches : featured;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
        <h2 className="text-base font-bold text-gray-800">{showAll ? heading : "משחקים — אחרונים והבאים"}</h2>
        <span className="text-sm text-gray-400">{displayed.length} משחקים</span>
      </div>
      {/* Mobile: horizontal snap carousel so all 4 cards are reachable without
          shrinking them; desktop: 4-column grid. */}
      <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-4 md:overflow-visible md:pb-0">
        {displayed.map((m) => {
          const isFinished = m.status === "FINISHED";
          const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
          const isExpanded = expandedId === m.id;
          const relatedBets = getRelatedBets(m.homeTla, m.awayTla);
          // Score predictions are shown only for FINISHED group matches (below),
          // built from the redacted bracket data — never from an un-lock-gated
          // source, so an upcoming match's picks can't leak before it locks.
          // For finished GROUP matches, build per-bettor hit/miss from stored bracket picks.
          const groupLetter = normalizeGroupLetter(m.group);
          const groupHits = (locked && isFinished && groupLetter && m.homeGoals !== null && m.awayGoals !== null)
            ? getGroupPredictions(m.homeTla, m.awayTla, groupLetter, m.homeGoals, m.awayGoals, m.id)
            : [];
          const counts = hitCounts(groupHits);
          const exactCount = counts.exact;
          const totoCount = counts.toto;
          const missCount = counts.miss;

          // Upcoming/live group matches: everyone's raw picks, revealed once
          // the match-day locks + 1-min grace. The server already redacts
          // pre-lock scores; this client gate just keeps the display honest
          // against clock skew and the 30s shared-data cache.
          const dayLockISO = groupLetter ? dayLockAtForKickoff(m.date, matchDays) : null;
          const revealAt = dayLockISO ? revealAtFor(dayLockISO) : null;
          const scoresRevealed = locked && !!revealAt && now >= revealAt.getTime();
          const pair = !isFinished && scoresRevealed && groupLetter
            ? matchPairIndex(groupLetter, m.homeTla, m.awayTla)
            : null;
          const revealedPicks = pair
            ? brackets.flatMap((b) => {
                const stored = b.groupPredictions?.[groupLetter]?.scores?.[pair.pairIdx];
                if (!stored || stored.home === null || stored.away === null) return [];
                const p = pair.flipped
                  ? { home: stored.away as number, away: stored.home as number }
                  : { home: stored.home as number, away: stored.away as number };
                return [{ userId: b.userId, name: b.displayName || "ללא שם", home: p.home, away: p.away }];
              })
            : [];
          // During play, grade each pick against the CURRENT score.
          const liveActual = isLive && m.homeGoals !== null && m.awayGoals !== null
            ? { home: m.homeGoals, away: m.awayGoals }
            : null;
          const hitRank: Record<HitKind, number> = { exact: 0, toto: 1, miss: 2, empty: 3 };
          revealedPicks.sort((a, b) =>
            (liveActual
              ? hitRank[classifyHit({ home: a.home, away: a.away }, liveActual)] -
                hitRank[classifyHit({ home: b.home, away: b.away }, liveActual)]
              : 0) || a.name.localeCompare(b.name, "he"),
          );
          // Consensus strip — the top 2 genuinely-common picks ("2-1 ×4 · 1-0 ×3").
          // A score only one bettor chose isn't "popular"; with no repeats at
          // all the strip is hidden.
          const consensusLine = (() => {
            if (revealedPicks.length < 2) return "";
            const tally: Record<string, number> = {};
            for (const p of revealedPicks) {
              // Away-home glyph order — matches every other score string here.
              const k = `${p.away}-${p.home}`;
              tally[k] = (tally[k] || 0) + 1;
            }
            return Object.entries(tally)
              .filter(([, n]) => n > 1)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 2)
              .map(([k, n]) => `${k} ×${n}`)
              .join(" · ");
          })();

          return (
            // Fixed width (not just min-) — inside the horizontal scroll
            // container a flex item otherwise grows to fit its longest
            // unwrapped line (e.g. the reveal-time caption) and smears the
            // page sideways instead of wrapping.
            <div key={m.id} className="w-[46%] sm:w-[30%] shrink-0 snap-start md:w-auto md:shrink md:col-span-1">
              <div
                onClick={() => setExpandedId(isExpanded ? null : m.id)}
                className={`bg-white rounded-xl border shadow-sm p-3 text-center transition-all cursor-pointer ${
                  isLive ? "border-red-300 bg-red-50/30" :
                  isFinished ? "border-green-200" :
                  isExpanded ? "border-blue-300 shadow-md" :
                  "border-gray-200 hover:border-gray-300 hover:shadow-md"
                }`}
              >
                {/* Status badge (+ date when the card isn't from today) */}
                <div className="mb-2 flex items-center justify-center gap-1.5">
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
                  {toIsraelDateKey(m.date) !== todayKey && (
                    <span className="text-[10px] font-bold text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5" style={{ fontFamily: "var(--font-inter)" }}>
                      {toIsraelDateShort(m.date)}
                    </span>
                  )}
                </div>

                {/* Teams */}
                <div className="flex items-center justify-between gap-1">
                  <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                    <TeamLogo code={m.homeTla} size="md" />
                    <span className="text-[11px] font-bold text-gray-800 truncate max-w-full">
                      {getTeamNameHe(m.homeTla) || m.homeTla}
                    </span>
                  </div>
                  <div className="shrink-0 px-1">
                    {(isLive || isFinished) && m.homeGoals !== null ? (
                      // RTL: the home team renders on the RIGHT, so the home
                      // goals must be the RIGHT digit — i.e. away-home in glyph
                      // order. Rendering "{home}-{away}" put the home score next
                      // to the AWAY team and read as a reversed result.
                      <span className="text-xl font-black tabular-nums text-gray-900" dir="ltr" style={{ fontFamily: "var(--font-inter)" }}>
                        {m.awayGoals}-{m.homeGoals}
                      </span>
                    ) : (
                      <span className="text-sm font-bold text-gray-300">vs</span>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
                    <TeamLogo code={m.awayTla} size="md" />
                    <span className="text-[11px] font-bold text-gray-800 truncate max-w-full">
                      {getTeamNameHe(m.awayTla) || m.awayTla}
                    </span>
                  </div>
                </div>

                {/* Group + expand hint */}
                <div className="flex items-center justify-center gap-1 mt-1.5">
                  <p className="text-[10px] text-gray-400">
                    {m.group ? `בית ${m.group.replace("GROUP_", "")}` : stageLabelHe(m.stage)}
                  </p>
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className={`text-gray-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {/* Direct link to this match's betting row — upcoming group
                    matches only (once it kicks off there's nothing to edit). */}
                {!isFinished && !isLive && groupLetter && (() => {
                  const betPair = matchPairIndex(groupLetter, m.homeTla, m.awayTla);
                  if (!betPair) return null;
                  return (
                    <Link
                      href={`/groups?group=${groupLetter}&match=${betPair.pairIdx}`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold px-3 py-1 transition-colors"
                    >
                      🎯 הימור על המשחק
                    </Link>
                  );
                })()}

                {/* Venue + referee (populated automatically ~24-48h pre-kickoff via the cron) */}
                {(m.venue || (m.referees && m.referees.length > 0)) && (
                  <div className="mt-1.5 pt-1.5 border-t border-gray-100 text-[9px] text-gray-500 leading-tight space-y-0.5">
                    {m.venue && <p className="truncate">🏟️ {m.venue}</p>}
                    {m.referees && m.referees.length > 0 && (() => {
                      const main = m.referees.find((r) => r.role === "REFEREE" || r.role === "MAIN_REFEREE") || m.referees[0];
                      return main ? <p className="truncate">👨‍⚖️ {main.name}</p> : null;
                    })()}
                  </div>
                )}
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
                          ההימורים ייחשפו אחרי הנעילה — {formatLockDeadline()}
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {/* Upcoming/live group match — everyone's picks (revealed at day-lock + 1 min) */}
                          {!isFinished && groupLetter && scoresRevealed && (
                            revealedPicks.length > 0 ? (
                              <div>
                                <p className="text-[10px] font-bold text-gray-500 mb-1">
                                  ניחושי התוצאה
                                  {liveActual && (
                                    <>
                                      <span className="mx-1.5">·</span>
                                      <span className="text-blue-700">
                                        לפי התוצאה כרגע (<span dir="ltr" className="tabular-nums">{liveActual.away}-{liveActual.home}</span>)
                                      </span>
                                    </>
                                  )}
                                </p>
                                {consensusLine && (
                                  <p className="text-[10px] text-gray-500 mb-1">
                                    הניחוש הנפוץ:{" "}
                                    <span className="font-bold tabular-nums text-gray-700" style={{ fontFamily: "var(--font-inter)" }}>
                                      {consensusLine}
                                    </span>
                                  </p>
                                )}
                                {/* One pick per row — 2 columns squeezed the
                                    bettor name out entirely on mobile. */}
                                <div className="grid grid-cols-1 gap-1">
                                  {revealedPicks.map((p) => {
                                    const hit = liveActual ? classifyHit({ home: p.home, away: p.away }, liveActual) : null;
                                    const bg =
                                      hit === "exact"
                                        ? "bg-green-50 border-green-300"
                                        : hit === "toto"
                                        ? "bg-amber-50 border-amber-300"
                                        : hit === "miss"
                                        ? "bg-red-50 border-red-200"
                                        : "bg-white border-gray-200";
                                    const icon = hit === "exact" ? "🎯" : hit === "toto" ? "✓" : hit === "miss" ? "✗" : "";
                                    return (
                                      <div
                                        key={p.userId}
                                        className={`flex items-center justify-between rounded-lg px-2 py-1 border ${bg}`}
                                      >
                                        <span className="text-[11px] font-bold text-gray-800 truncate">{p.name}</span>
                                        <span className="flex items-center gap-1 shrink-0">
                                          <span dir="ltr" className="text-[11px] font-black tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
                                            {p.away}-{p.home}
                                          </span>
                                          {icon && <span className="text-xs">{icon}</span>}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <p className="text-[11px] text-gray-400 text-center py-1">
                                אף מהמר לא ניחש תוצאה למשחק זה
                              </p>
                            )
                          )}

                          {/* Group match whose day hasn't locked yet — explicit reveal date+time */}
                          {!isFinished && groupLetter && !scoresRevealed && (
                            <p className="text-[11px] text-blue-700 font-medium text-center py-1">
                              🔒 ניחושי התוצאה ייחשפו ב-{revealAt ? `${toIsraelDateShort(revealAt.toISOString())} בשעה ${toIsraelTimeShort(revealAt.toISOString())}` : "—"} (דקה אחרי נעילת ההימורים)
                            </p>
                          )}
                          {/* Group-stage predictions vs actual result (only for FINISHED group matches) */}
                          {groupHits.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-gray-500 mb-1">
                                {/* Same away-home glyph order as the card score above */}
                                תוצאה: <span dir="ltr" className="tabular-nums text-gray-700">{m.awayGoals}-{m.homeGoals}</span>
                                <span className="mx-1.5">·</span>
                                <span className="text-green-700">🎯 {exactCount} תפסו תוצאה</span>
                                <span className="mx-1">·</span>
                                <span className="text-amber-700">✓ {totoCount} תפסו טוטו</span>
                                {missCount > 0 && (
                                  <>
                                    <span className="mx-1">·</span>
                                    <span className="text-red-600">✗ {missCount} פספסו</span>
                                  </>
                                )}
                              </p>
                              <div className="grid grid-cols-1 gap-1">
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
                                        <span dir="ltr" className="text-[11px] font-black tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
                                          {h.pred.away}-{h.pred.home}
                                        </span>
                                        <span className="text-xs">{icon}</span>
                                      </span>
                                    </div>
                                  );
                                })}
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

                          {/* Nothing to show at all — KO match with no related bets,
                              or a finished group match nobody predicted. Upcoming
                              group matches always render a reveal/lock section above. */}
                          {relatedBets.length === 0 && groupHits.length === 0 && (isFinished || !groupLetter) && (
                            <p className="text-[11px] text-gray-400 text-center py-1">
                              אין הימורים למשחק הזה
                            </p>
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
      <button
        onClick={() => setShowAll((v) => !v)}
        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 bg-white text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
      >
        {showAll ? "הצג אחרונים והבאים" : `הצג את כל משחקי היום (${matches.length})`}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          className={`transition-transform ${showAll ? "rotate-180" : ""}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
    </div>
  );
}
