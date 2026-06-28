"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import { TeamLogo } from "@/components/shared/TeamLogo";
import { toIsraelTimeShort, toIsraelDateShort, toIsraelDateKey, getTodayIsrael } from "@/lib/timezone";
import { useSharedData } from "@/hooks/useSharedData";
import { useBettingStore } from "@/stores/betting-store";
import { isLocked, revealAtFor, formatLockDeadline, LOCK_DEADLINE } from "@/lib/constants";
import { computeGroupHits, hitCounts, normalizeGroupLetter, matchPairIndex, classifyHit, type HitKind } from "@/lib/results-hits";
import { computeMatchDays, dayLockAtForKickoff, type MatchDay } from "@/lib/tournament/group-live-state";
import { anyMatchInPlayWindow, LIVE_REFRESH_MS } from "@/lib/live-window";
import { MATCHUPS, parseMatchupPick } from "@/lib/matchups";
import { resolveKnockoutTree } from "@/lib/scoring/knockout-resolver";
import { LIVE_FEEDERS } from "@/lib/tournament/knockout-derivation";
import { pairKey } from "@/lib/fixtures-client";

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
  homePenalties?: number | null;
  awayPenalties?: number | null;
  winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [matchDays, setMatchDays] = useState<MatchDay[]>([]);
  // Header toggle: "הבאים" (upcoming, default) ⇄ "אחרונים" (finished results).
  const [view, setView] = useState<"upcoming" | "finished">("upcoming");
  const { specialBets, brackets, advancements, refetch } = useSharedData();
  // The viewer's OWN picks (local store) — shown next to the edit-bet button.
  const myGroups = useBettingStore((s) => s.groups);
  const myKoLive = useBettingStore((s) => s.knockoutLive);
  const locked = isLocked();

  // Map each REAL knockout fixture (by team-pair) → its bracket slot key, so a
  // KO card can show the viewer's own pick from the real-data tree store
  // (keyed by slot, not by team pair). Resolved from the live results with the
  // same engine the knockout-live page uses (group stage must be complete for
  // R32 slots to carry teams).
  const koSlotByPair = useMemo(() => {
    const map = new Map<string, { key: string; team1: string; team2: string }>();
    const scored = allMatches
      .filter((m) => m.homeGoals != null && m.awayGoals != null)
      .map((m) => ({
        id: m.id, date: m.date, homeTla: m.homeTla, awayTla: m.awayTla,
        group: m.group ?? "", stage: m.stage ?? "",
        homeGoals: m.homeGoals as number, awayGoals: m.awayGoals as number,
        homePenalties: m.homePenalties ?? null, awayPenalties: m.awayPenalties ?? null,
        winner: m.winner ?? null,
      }));
    if (scored.length === 0) return map;
    try {
      const tree = resolveKnockoutTree(scored, null, undefined, LIVE_FEEDERS);
      for (const slot of Object.values(tree)) {
        if (slot.team1 && slot.team2) map.set(pairKey(slot.team1, slot.team2), { key: slot.key, team1: slot.team1, team2: slot.team2 });
      }
    } catch { /* ignore */ }
    return map;
  }, [allMatches]);

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
          return;
        }

        setMatches(DEMO_MATCHES);
      } catch {
        if (hasRealDataRef.current) return;
        setMatches(DEMO_MATCHES);
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

  // Two views, switched manually by the underline tabs in the header — the
  // SAME behavior at all hours, no time/lock-based auto-switching:
  //   • "הבאים" (default) — the next live + upcoming games, soonest first.
  //   • "אחרונים" — the most recent results.
  // The toggle only appears when both views have matches; otherwise the view
  // falls back to whichever has data (pre-tournament → upcoming, end → results).
  const byKickoff = (a: Match, b: Match) => new Date(a.date).getTime() - new Date(b.date).getTime();
  const todayKey = getTodayIsrael();
  const pool = allMatches.length > 0 ? allMatches : matches;
  const upcomingList = pool.filter((m) => m.status !== "FINISHED").sort(byKickoff).slice(0, 4);
  const finishedList = pool.filter((m) => m.status === "FINISHED").sort(byKickoff).slice(-4);
  const showToggle = upcomingList.length > 0 && finishedList.length > 0;
  const effectiveView = view === "finished"
    ? (finishedList.length > 0 ? "finished" : "upcoming")
    : (upcomingList.length > 0 ? "upcoming" : "finished");
  const featured = effectiveView === "finished" ? finishedList : upcomingList;

  // Build EVERY public special bet that touches this match — by team (champion,
  // top scorer/assists, best attack, dirtiest), by its group (most prolific /
  // driest group, group-stage only), or by a matchup duel whose player plays in
  // it. Mirrors (and extends) the schedule page's "related special bets" set.
  // Sorted by a fixed type order so same-type picks group together in the card.
  function getRelatedBets(homeTla: string, awayTla: string, matchGroup: string) {
    if (!locked) return [];
    const groupLetter = normalizeGroupLetter(matchGroup); // "" for knockout
    const isTeam = (t: string | null) => t === homeTla || t === awayTla;
    const mentionsTeam = (s: string | null) => !!s && (s.includes(homeTla) || s.includes(awayTla));
    const names = Array.from(new Set([
      ...specialBets.map((s) => s.displayName),
      ...advancements.map((a) => a.displayName),
    ]));
    const bets: { name: string; type: string; detail: string; order: number }[] = [];
    for (const name of names) {
      // אלוף (tournament champion) — lives in advancements, not specialBets.
      const adv = advancements.find((a) => a.displayName === name);
      if (adv && isTeam(adv.winner)) {
        bets.push({ name, type: "אלוף", detail: getFlag(adv.winner), order: 0 });
      }
      const sb = specialBets.find((s) => s.displayName === name);
      if (sb) {
        if (mentionsTeam(sb.topScorerPlayer)) {
          bets.push({ name, type: "מלך שערים", detail: sb.topScorerPlayer!, order: 1 });
        }
        if (mentionsTeam(sb.topAssistsPlayer)) {
          bets.push({ name, type: "מלך בישולים", detail: sb.topAssistsPlayer!, order: 2 });
        }
        if (isTeam(sb.bestAttackTeam)) {
          bets.push({ name, type: "התקפה פורייה", detail: getFlag(sb.bestAttackTeam!), order: 3 });
        }
        if (isTeam(sb.dirtiestTeam)) {
          bets.push({ name, type: "כסחנית", detail: getFlag(sb.dirtiestTeam!), order: 4 });
        }
        // Group-wide bets — relevant only on this match's own group-stage games.
        if (groupLetter && sb.prolificGroup === groupLetter) {
          bets.push({ name, type: "בית הכי פורה", detail: groupLetter, order: 5 });
        }
        if (groupLetter && sb.driestGroup === groupLetter) {
          bets.push({ name, type: "בית הכי יבש", detail: groupLetter, order: 6 });
        }
        // Matchup duels — shown when either duelist's team is playing here.
        const picks = parseMatchupPick(sb.matchupPick);
        for (let i = 0; i < MATCHUPS.length; i++) {
          const pick = picks[i];
          if (!pick) continue;
          const mu = MATCHUPS[i];
          if (!isTeam(mu.team1) && !isTeam(mu.team2)) continue;
          const backed = pick === "1" ? mu.p1Short : pick === "2" ? mu.p2Short : "תיקו";
          bets.push({ name, type: "מאצ'אפ", detail: `${mu.p1Short}-${mu.p2Short}: ${backed}`, order: 7 });
        }
      }
    }
    return bets.sort((a, b) => a.order - b.order);
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

  const displayed = featured;
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
        <h2 className="text-base font-bold text-gray-800">משחקים</h2>
        {showToggle ? (
          // Underline tabs (Option B): manual switch, identical at all hours.
          <div className="flex items-center gap-3 text-[13px] font-bold ms-auto">
            {([["finished", "אחרונים"], ["upcoming", "הבאים"]] as const).map(([v, label]) => (
              <button key={v} onClick={() => setView(v)} className="relative pb-1">
                <span className={effectiveView === v ? "text-gray-900" : "text-gray-400"}>{label}</span>
                {effectiveView === v && <span className="absolute -bottom-0.5 inset-x-0 h-0.5 rounded-full bg-blue-600" />}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-sm text-gray-400">{displayed.length} משחקים</span>
        )}
      </div>
      {/* 2×2 on mobile, 4-across on desktop — all matches visible, no scroll.
          items-start so expanding one card doesn't stretch its row-mates. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-start">
        {displayed.map((m) => {
          const isFinished = m.status === "FINISHED";
          const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
          const isExpanded = expandedId === m.id;
          const relatedBets = getRelatedBets(m.homeTla, m.awayTla, m.group);
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
            <div key={m.id} className="col-span-1">
              <div
                onClick={() => setExpandedId(isExpanded ? null : m.id)}
                className={`bg-white rounded-xl border shadow-sm p-3 text-center transition-all cursor-pointer flex flex-col h-full ${
                  isLive ? "border-red-300 bg-red-50/30" :
                  isFinished ? "border-green-200" :
                  isExpanded ? "border-blue-300 shadow-md" :
                  "border-gray-200 hover:border-gray-300 hover:shadow-md"
                }`}
              >
                {/* Header: status + group + (date) + expand chevron */}
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
                  <span className="text-[10px] font-bold text-gray-400">
                    {m.group ? `בית ${m.group.replace("GROUP_", "")}` : stageLabelHe(m.stage)}
                  </span>
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    className={`text-gray-300 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {/* Teams (centered, fills the height so all cards match) */}
                <div className="flex-1 flex items-center justify-between gap-1">
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

                {/* Footer — the viewer's OWN pick, emphasized, on EVERY group
                    card (so all cards share this row → equal height). Upcoming
                    matches also get a small edit button. mt-auto pins it to the
                    bottom so the team block stays vertically centered above. */}
                {groupLetter && (() => {
                  const betPair = matchPairIndex(groupLetter, m.homeTla, m.awayTla);
                  const stored = betPair ? myGroups[groupLetter]?.scores?.[betPair.pairIdx] : null;
                  // Canonical → real home/away, then shown away-home (home = right digit).
                  const myPick = stored && stored.home !== null && stored.away !== null
                    ? (betPair!.flipped ? { home: stored.away, away: stored.home } : { home: stored.home, away: stored.away })
                    : null;
                  const editable = !isFinished && !isLive && !!betPair;
                  // Grade the pick once there's a score to grade against.
                  const actual = (isLive || isFinished) && m.homeGoals !== null && m.awayGoals !== null
                    ? { home: m.homeGoals, away: m.awayGoals } : null;
                  const hit = myPick && actual ? classifyHit({ home: myPick.home, away: myPick.away }, actual) : null;
                  // Graded (live/finished) → colored. Upcoming (no result yet) →
                  // quiet gray, low emphasis: it's just a reminder of your pick.
                  const chip = hit === "exact" ? "bg-green-100 text-green-800 border-green-200"
                    : hit === "toto" ? "bg-amber-100 text-amber-800 border-amber-200"
                    : hit === "miss" ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-transparent text-gray-400 border-transparent";
                  return (
                    <div className="mt-auto pt-2 flex items-center justify-center gap-1.5 min-h-[28px]">
                      {myPick ? (
                        <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${chip}`}>
                          <span className="text-[8px] font-bold opacity-70">שלך</span>
                          <span dir="ltr" className={`text-[12px] tabular-nums ${hit ? "font-black" : "font-semibold"}`} style={{ fontFamily: "var(--font-inter)" }}>{myPick.away}-{myPick.home}</span>
                          {hit === "exact" && <span className="text-[10px]">🎯</span>}
                          {hit === "toto" && <span className="text-[10px]">✓</span>}
                          {hit === "miss" && <span className="text-[10px]">✗</span>}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-300">{editable ? "עוד לא הימרת" : "לא הימרת"}</span>
                      )}
                      {editable && (
                        <Link
                          href={`/groups?group=${groupLetter}&match=${betPair!.pairIdx}`}
                          onClick={(e) => e.stopPropagation()}
                          title="שנה הימור"
                          aria-label="שנה הימור"
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                        </Link>
                      )}
                    </div>
                  );
                })()}

                {/* Knockout cards have no group bet-pair — give them a direct
                    link to the real-data tree (עץ נתוני אמת) so EVERY match box
                    on the home page has a bet action. mt-auto + min-h match the
                    group footer so all cards keep equal height (mobile + desktop). */}
                {!groupLetter && (() => {
                  const isReal = !!m.homeTla && !!m.awayTla && m.homeTla !== "TBD" && m.awayTla !== "TBD";
                  const editable = !isFinished && !isLive && isReal;
                  // The viewer's OWN real-tree pick: map fixture → slot → store,
                  // then orient the slot's score1/score2 (team1/team2) to the
                  // card's home/away so the digits read correctly.
                  const slot = isReal ? koSlotByPair.get(pairKey(m.homeTla, m.awayTla)) : undefined;
                  const kp = slot ? myKoLive[slot.key] : undefined;
                  const myPick = kp && kp.score1 !== null && kp.score2 !== null && slot
                    ? (m.homeTla === slot.team1 ? { home: kp.score1, away: kp.score2 } : { home: kp.score2, away: kp.score1 })
                    : null;
                  const actual = (isLive || isFinished) && m.homeGoals !== null && m.awayGoals !== null
                    ? { home: m.homeGoals, away: m.awayGoals } : null;
                  const hit = myPick && actual ? classifyHit(myPick, actual) : null;
                  const chip = hit === "exact" ? "bg-green-100 text-green-800 border-green-200"
                    : hit === "toto" ? "bg-amber-100 text-amber-800 border-amber-200"
                    : hit === "miss" ? "bg-red-50 text-red-600 border-red-200"
                    : "bg-transparent text-gray-400 border-transparent";
                  return (
                    <div className="mt-auto pt-2 flex items-center justify-center gap-1.5 min-h-[28px]">
                      {myPick ? (
                        <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 ${chip}`}>
                          <span className="text-[8px] font-bold opacity-70">שלך</span>
                          <span dir="ltr" className={`text-[12px] tabular-nums ${hit ? "font-black" : "font-semibold"}`} style={{ fontFamily: "var(--font-inter)" }}>{myPick.away}-{myPick.home}</span>
                          {hit === "exact" && <span className="text-[10px]">🎯</span>}
                          {hit === "toto" && <span className="text-[10px]">✓</span>}
                          {hit === "miss" && <span className="text-[10px]">✗</span>}
                        </span>
                      ) : !editable && (
                        <span className="text-[10px] text-gray-300">{isReal ? "לא הימרת" : "ממתין ליריבה"}</span>
                      )}
                      {editable && (
                        <Link
                          href="/knockout-live"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5 hover:bg-emerald-100 transition-colors"
                        >
                          {myPick ? "✏️ שנה" : "✏️ מלאו הימור ←"}
                        </Link>
                      )}
                    </div>
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
                              {relatedBets.map((b, i) => (
                                <div key={i} className="flex flex-wrap items-center gap-x-1 text-[11px] text-gray-600">
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

                          {/* Full detail lives on the schedule page — group qualifiers
                              each bettor picked (group stage) and, from R32, who they
                              advanced. Deep-links straight to this match there. */}
                          {m.id > 0 && (
                            <Link
                              href={`/schedule?match=${m.id}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center justify-center gap-1.5 rounded-lg bg-white hover:bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-800 text-[11px] font-bold py-1.5 transition-colors"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <rect x="3" y="4" width="18" height="18" rx="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                              כל ההימורים על המשחק ←
                            </Link>
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
