"use client";
import { LoadingPage } from "@/components/shared/LoadingAnimation";
import { useSharedData } from "@/hooks/useSharedData";
import { useBettingStore } from "@/stores/betting-store";
import { isLocked, revealAtFor, LOCK_DEADLINE } from "@/lib/constants";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import type { BettorSpecialBets, BettorAdvancement, BettorBracket } from "@/lib/supabase/shared-data";
import { matchPairIndex, normalizeGroupLetter, classifyHit } from "@/lib/results-hits";
import { MATCHUPS, parseMatchupPick } from "@/lib/matchups";
import { computeMatchDays, dayLockAtForKickoff, type MatchDay } from "@/lib/tournament/group-live-state";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toIsraelTimeShort, toIsraelDate, toIsraelDateKey } from "@/lib/timezone";
import { TeamLogo } from "@/components/shared/TeamLogo";

interface Referee { name: string; role: string; nationality: string | null }
interface Match {
  id: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  venue?: string | null;
  referees?: Referee[];
  homeTla: string;
  awayTla: string;
  group: string;
  stage: string;
  status?: string;
  homeGoals?: number | null;
  awayGoals?: number | null;
}

// For a knockout match, which advancement set its winner joins (= reaching the
// NEXT round). Both FD stage spellings are mapped. FINAL is handled separately
// against each bettor's champion pick. THIRD_PLACE has no "advance" notion.
const KO_ADVANCE_FIELD: Record<string, "advanceToR16" | "advanceToQF" | "advanceToSF" | "advanceToFinal"> = {
  LAST_32: "advanceToR16",
  ROUND_OF_32: "advanceToR16",
  LAST_16: "advanceToQF",
  ROUND_OF_16: "advanceToQF",
  QUARTER_FINAL: "advanceToSF",
  QUARTER_FINALS: "advanceToSF",
  SEMI_FINAL: "advanceToFinal",
  SEMI_FINALS: "advanceToFinal",
};

interface MatchBetsPanelProps {
  match: Match;
  brackets: BettorBracket[];
  specialBets: BettorSpecialBets[];
  advancements: BettorAdvancement[];
  matchDays: MatchDay[];
}

function MatchBetsPanel({ match, brackets, specialBets, advancements, matchDays }: MatchBetsPanelProps) {
  const home = match.homeTla;
  const away = match.awayTla;
  const groupLetter = normalizeGroupLetter(match.group);
  const globalLocked = isLocked();

  // Per-match score reveal: a group match's score predictions are shown only
  // once its match-day has LOCKED (30 min before the day's first kickoff) plus
  // a 1-minute display grace (REVEAL_GRACE_MS) — saves are blocked at the lock
  // itself; the minute absorbs clock skew + the 30s cache so the UI never
  // claims "revealed" against still-redacted data. Until then scores stay
  // secret, even though advancement + special bets are already public (those
  // lock at the global June-10 lock). Knockout score picks aren't shown on
  // this page (they live on the live bracket); their own lock-gating is
  // enforced in /api/shared-bets.
  const scoreLockAt = groupLetter ? dayLockAtForKickoff(match.date, matchDays) : null;
  const scoreRevealAt = scoreLockAt ? revealAtFor(scoreLockAt) : null;
  const scoresRevealed = !!scoreRevealAt && Date.now() >= scoreRevealAt.getTime();

  // Each bettor's stored score prediction for THIS group match, oriented to the
  // displayed home/away. Built only once revealed; before that the redacted
  // server payload carries nulls anyway, so this is defense-in-depth.
  // Actual score for live grading of the revealed picks (real home/away order).
  const isLiveMatch = match.status === "IN_PLAY" || match.status === "PAUSED";
  const matchActual =
    (match.status === "FINISHED" || isLiveMatch) && match.homeGoals != null && match.awayGoals != null
      ? { home: match.homeGoals, away: match.awayGoals }
      : null;
  const pair = groupLetter ? matchPairIndex(groupLetter, home, away) : null;
  const scorePredictions = scoresRevealed && pair
    ? brackets.flatMap((b) => {
        const stored = b.groupPredictions?.[groupLetter]?.scores?.[pair.pairIdx];
        if (!stored || stored.home === null || stored.away === null) return [];
        const p = pair.flipped
          ? { home: stored.away as number, away: stored.home as number }
          : { home: stored.home as number, away: stored.away as number };
        return [{ userId: b.userId, name: b.displayName || "ללא שם", home: p.home, away: p.away }];
      })
    : [];

  // Real special bets available?
  const hasSpecialBets = specialBets.length > 0;
  const hasAdvancements = advancements.length > 0;

  // Find related special bets for this match's teams
  const relatedBets: { bettor: string; type: string; detail: string }[] = [];

  // Always include current user's local bets
  const myBets = useBettingStore.getState().specialBets;
  if (myBets.winner && (myBets.winner === home || myBets.winner === away)) {
    relatedBets.push({ bettor: "אתה", type: "אלוף", detail: `${getFlag(myBets.winner)} ${getTeamNameHe(myBets.winner)}` });
  }
  if (myBets.topScorerTeam && (myBets.topScorerTeam === home || myBets.topScorerTeam === away) && myBets.topScorerPlayer) {
    relatedBets.push({ bettor: "אתה", type: "מלך שערים", detail: `${myBets.topScorerPlayer} (${getFlag(myBets.topScorerTeam)} ${getTeamNameHe(myBets.topScorerTeam)})` });
  }
  if (myBets.topAssistsTeam && (myBets.topAssistsTeam === home || myBets.topAssistsTeam === away) && myBets.topAssistsPlayer) {
    relatedBets.push({ bettor: "אתה", type: "מלך בישולים", detail: `${myBets.topAssistsPlayer} (${getFlag(myBets.topAssistsTeam)} ${getTeamNameHe(myBets.topAssistsTeam)})` });
  }
  if (myBets.bestAttack && (myBets.bestAttack === home || myBets.bestAttack === away)) {
    relatedBets.push({ bettor: "אתה", type: "התקפה הכי טובה", detail: `${getFlag(myBets.bestAttack)} ${getTeamNameHe(myBets.bestAttack)}` });
  }
  if (myBets.dirtiestTeam && (myBets.dirtiestTeam === home || myBets.dirtiestTeam === away)) {
    relatedBets.push({ bettor: "אתה", type: "הכי כסחנית", detail: `${getFlag(myBets.dirtiestTeam)} ${getTeamNameHe(myBets.dirtiestTeam)}` });
  }
  if (groupLetter && myBets.prolificGroup === groupLetter) {
    relatedBets.push({ bettor: "אתה", type: "בית הכי פורה", detail: `בית ${groupLetter}` });
  }
  if (groupLetter && myBets.driestGroup === groupLetter) {
    relatedBets.push({ bettor: "אתה", type: "בית הכי יבש", detail: `בית ${groupLetter}` });
  }
  MATCHUPS.forEach((mu, i) => {
    const pick = myBets.matchups?.[i];
    if (!pick) return;
    if (mu.team1 !== home && mu.team1 !== away && mu.team2 !== home && mu.team2 !== away) return;
    const backed = pick === "1" ? mu.p1Short : pick === "2" ? mu.p2Short : "תיקו";
    relatedBets.push({ bettor: "אתה", type: "מאצ'אפ", detail: `${mu.p1Short}-${mu.p2Short}: ${backed}` });
  });

  // Add real Supabase data for all bettors
  if (hasSpecialBets || hasAdvancements) {
    // Build a unique name list from profiles for consistent display
    const allBettorNames = Array.from(new Set([
      ...specialBets.map(sb => sb.displayName),
      ...advancements.map(a => a.displayName),
    ]));

    for (const bettorName of allBettorNames) {
      // Winner bet (from advancements)
      if (hasAdvancements) {
        const adv = advancements.find(a => a.displayName === bettorName);
        if (adv?.winner && (adv.winner === home || adv.winner === away)) {
          relatedBets.push({ bettor: bettorName, type: "אלוף", detail: `${getFlag(adv.winner)} ${getTeamNameHe(adv.winner)}` });
        }
      }

      const sb = specialBets.find(s => s.displayName === bettorName);
      if (!sb) continue;

      // Top scorer — stored as "Player (TEAM)" or just a player name
      // The real data has topScorerPlayer as a string. We check if it mentions one of the teams.
      if (sb.topScorerPlayer) {
        const tsp = sb.topScorerPlayer;
        // Check if any team TLA appears in the field (e.g. "Kane (ENG)")
        if (tsp.includes(home) || tsp.includes(away)) {
          relatedBets.push({ bettor: bettorName, type: "מלך שערים", detail: tsp });
        }
      }

      // Top assists
      if (sb.topAssistsPlayer) {
        const tap = sb.topAssistsPlayer;
        if (tap.includes(home) || tap.includes(away)) {
          relatedBets.push({ bettor: bettorName, type: "מלך בישולים", detail: tap });
        }
      }

      // Best attack team
      if (sb.bestAttackTeam && (sb.bestAttackTeam === home || sb.bestAttackTeam === away)) {
        relatedBets.push({ bettor: bettorName, type: "התקפה הכי טובה", detail: `${getFlag(sb.bestAttackTeam)} ${getTeamNameHe(sb.bestAttackTeam)}` });
      }

      // Dirtiest team
      if (sb.dirtiestTeam && (sb.dirtiestTeam === home || sb.dirtiestTeam === away)) {
        relatedBets.push({ bettor: bettorName, type: "הכי כסחנית", detail: `${getFlag(sb.dirtiestTeam)} ${getTeamNameHe(sb.dirtiestTeam)}` });
      }

      // Most prolific / driest group — relevant only on this group's own matches
      if (groupLetter && sb.prolificGroup === groupLetter) {
        relatedBets.push({ bettor: bettorName, type: "בית הכי פורה", detail: `בית ${groupLetter}` });
      }
      if (groupLetter && sb.driestGroup === groupLetter) {
        relatedBets.push({ bettor: bettorName, type: "בית הכי יבש", detail: `בית ${groupLetter}` });
      }

      // Matchup duels — shown when either duelist's national team plays here
      const picks = parseMatchupPick(sb.matchupPick);
      for (let i = 0; i < MATCHUPS.length; i++) {
        const pick = picks[i];
        if (!pick) continue;
        const mu = MATCHUPS[i];
        if (mu.team1 !== home && mu.team1 !== away && mu.team2 !== home && mu.team2 !== away) continue;
        const backed = pick === "1" ? mu.p1Short : pick === "2" ? mu.p2Short : "תיקו";
        relatedBets.push({ bettor: bettorName, type: "מאצ'אפ", detail: `${mu.p1Short}-${mu.p2Short}: ${backed}` });
      }
    }
  }

  // Group related bets by type
  const groupedBets: Record<string, { bettor: string; detail: string }[]> = {};
  for (const rb of relatedBets) {
    if (!groupedBets[rb.type]) groupedBets[rb.type] = [];
    groupedBets[rb.type].push({ bettor: rb.bettor, detail: rb.detail });
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <div className="border-t border-gray-100 bg-gray-50/70 px-4 py-3 space-y-4">
        {!globalLocked && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <p className="text-xs font-bold text-amber-700">
              ניחושי התוצאה של כל משחק ייחשפו דקה אחרי נעילתו — הנעילה חצי שעה לפני תחילת יום המשחקים שלו.
            </p>
          </div>
        )}

        {/* Score predictions — revealed only once THIS match's bets lock (30 min
            before its match-day). Group stage only; knockout score picks live on
            the live bracket, and their reveal is gated in /api/shared-bets. */}
        {globalLocked && groupLetter && (
          scoresRevealed ? (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">
                ניחושי תוצאה
                {matchActual && (
                  <>
                    <span className="mx-1.5">·</span>
                    <span className={isLiveMatch ? "text-red-600" : "text-green-700"}>
                      {isLiveMatch ? "לפי התוצאה כרגע" : "התוצאה"}{" "}
                      <span dir="ltr" className="tabular-nums">{matchActual.away}-{matchActual.home}</span>
                    </span>
                  </>
                )}
              </p>
              {scorePredictions.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {scorePredictions.map((p) => {
                    // Color each pick vs the actual once there IS one (finished
                    // or live): exact=green, toto=amber, miss=red. Same away-home
                    // glyph order as the teams/score shown above the panel.
                    const hit = matchActual ? classifyHit({ home: p.home, away: p.away }, matchActual) : null;
                    const cls = hit === "exact" ? "bg-green-50 border-green-300"
                      : hit === "toto" ? "bg-amber-50 border-amber-300"
                      : hit === "miss" ? "bg-red-50 border-red-200"
                      : "bg-white border-gray-200";
                    const icon = hit === "exact" ? "🎯" : hit === "toto" ? "✓" : hit === "miss" ? "✗" : "";
                    return (
                      <div key={p.userId} className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs ${cls}`}>
                        <span className="font-bold text-gray-800 truncate">{p.name}</span>
                        <span className="flex items-center gap-1 shrink-0">
                          <span dir="ltr" className="font-black text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{p.away}-{p.home}</span>
                          {icon && <span>{icon}</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400">אף מהמר לא ניחש תוצאה למשחק זה.</p>
              )}
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-center">
              <p className="text-xs font-bold text-blue-700">
                🔒 ניחושי התוצאה ייחשפו ב-{scoreRevealAt ? `${toIsraelTimeShort(scoreRevealAt.toISOString())}, ${toIsraelDate(scoreRevealAt.toISOString())}` : "נעילת המשחק"} — דקה אחרי נעילת ההימורים ליום זה
              </p>
            </div>
          )
        )}

        {/* Related special bets — public after the global lock (they freeze then) */}
        {globalLocked && Object.keys(groupedBets).length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2">הימורים מיוחדים הקשורים למשחק</p>
            <div className="space-y-2">
              {Object.entries(groupedBets).map(([type, entries]) => (
                <div key={type} className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                  <p className="text-xs font-bold text-blue-600 mb-1.5">{type}</p>
                  <div className="space-y-1">
                    {entries.map((e, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-gray-700 font-medium">{e.bettor}</span>
                        <span className="text-gray-500">{e.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Group advancement (עולות) — public after the global lock (allowed) */}
        {globalLocked && groupLetter && hasAdvancements && (
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2">הימורים על בית {groupLetter}</p>
            <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {advancements.filter(a => {
                  const gq = a.groupQualifiers?.[groupLetter];
                  return gq && gq.length > 0;
                }).map((adv) => (
                  <div key={adv.userId} className="text-xs border border-gray-100 rounded-lg p-2">
                    <p className="font-bold text-gray-800 mb-1">{adv.displayName}</p>
                    <div className="space-y-0.5">
                      {(adv.groupQualifiers[groupLetter] || []).slice(0, 2).map((t, j) => (
                        <div key={j} className="flex items-center gap-1.5 text-green-700 font-medium">
                          <span className="text-[10px] w-3 shrink-0" style={{ fontFamily: "var(--font-inter)" }}>{j + 1}.</span>
                          <span>{getFlag(t)}</span>
                          <span className="truncate">{getTeamNameHe(t)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 mt-1.5 text-center">מקומות 1-2 = עולות מהבית</p>
            </div>
          </div>
        )}

        {/* Knockout advancement (R32 and on) — which of the two teams each bettor
            predicted to advance from THIS match. Stays hidden until the fixture
            has real teams (TBD codes won't match anyone's advancement set). */}
        {globalLocked && !groupLetter && hasAdvancements && (() => {
          const stage = match.stage || "";
          const field = KO_ADVANCE_FIELD[stage];
          const isFinal = stage === "FINAL";
          if (!field && !isFinal) return null;
          const rows = advancements.map((adv) => {
            const codes: string[] = [];
            if (isFinal) {
              if (adv.winner === home) codes.push(home);
              else if (adv.winner === away) codes.push(away);
            } else {
              // A past bug let some bettors advance BOTH teams of a future
              // matchup. Surface BOTH so the double-pick is visible (only one
              // of them can actually win this fixture).
              const set = adv[field] || [];
              if (set.includes(home)) codes.push(home);
              if (set.includes(away)) codes.push(away);
            }
            return { userId: adv.userId, name: adv.displayName, codes };
          });
          if (rows.length === 0) return null;
          // Show EVERY bettor — those who advanced one (or both) of these two
          // teams first, then those who advanced NEITHER (their pre-tournament
          // bracket had other teams in this slot), so it's clear who's who.
          rows.sort((a, b) => (b.codes.length > 0 ? 1 : 0) - (a.codes.length > 0 ? 1 : 0));
          return (
            <div>
              <p className="text-xs font-bold text-gray-500 mb-2">את מי כל מהמר העלה</p>
              <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {rows.map((r) => (
                    <div key={r.userId} className={`text-xs border rounded-lg p-2 ${r.codes.length === 0 ? "border-gray-100 bg-gray-50/60" : "border-gray-100"}`}>
                      <p className={`font-bold mb-1 truncate ${r.codes.length === 0 ? "text-gray-400" : "text-gray-800"}`}>
                        {r.name}
                        {r.codes.length > 1 && <span className="ms-1 text-[9px] text-amber-600 font-bold">(שתיים)</span>}
                      </p>
                      {r.codes.length === 0 ? (
                        <div className="flex items-center gap-1.5 text-gray-400 font-medium">
                          <span>—</span>
                          <span className="truncate text-[11px]">לא העלה אף אחת</span>
                        </div>
                      ) : r.codes.map((code) => (
                        <div key={code} className="flex items-center gap-1.5 text-green-700 font-medium">
                          <span>{getFlag(code)}</span>
                          <span className="truncate">{getTeamNameHe(code)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1.5 text-center">העולה מהמשחק לדעת כל מהמר</p>
              </div>
            </div>
          );
        })()}
      </div>
    </motion.div>
  );
}

export default function SchedulePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [expandedMatch, setExpandedMatch] = useState<number | null>(null);
  const { brackets, specialBets, advancements, refetch } = useSharedData();
  // The viewer's OWN picks — shown next to the edit-bet button per match.
  const myGroups = useBettingStore((s) => s.groups);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/matches");
        const data = await res.json();
        setMatches(data.matches || []);
      } catch {
        // Fallback — use static sample
      }
      setLoading(false);
    })();
  }, []);


  // Per-match-day lock instants (group stage) — drive the per-match score reveal
  // so a match's score predictions surface only once its day has locked.
  const matchDays = useMemo(
    () => computeMatchDays(matches.map((m) => ({ date: m.date, group: m.group, stage: m.stage }))),
    [matches],
  );

  // When the next reveal boundary (global lock or a match-day lock, + the
  // 1-min grace) passes while the page is open, force-refresh the shared data
  // and re-render, so picks appear on time without a manual reload.
  // `revealTick` re-arms the timer for the boundary after that.
  const [revealTick, setRevealTick] = useState(0);
  useEffect(() => {
    const now = Date.now();
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
      setRevealTick((t) => t + 1);
    }, next - now + 1_000);
    return () => clearTimeout(id);
  }, [matchDays, refetch, revealTick]);

  // Group matches by date
  const grouped: Record<string, Match[]> = {};
  const filtered = filter === "ALL" ? matches : matches.filter(m => m.group === `GROUP_${filter}` || m.stage === filter);
  for (const m of filtered) {
    // Group by Israel calendar date (matches the times we display) rather than
    // UTC, so a late-night kickoff lands under the day users actually see it.
    const date = toIsraelDateKey(m.date);
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(m);
  }
  // Within each day, order by real kickoff time. The /api/matches payload
  // appends DB-only rows at the end unsorted, so without this two matches on
  // the same day could appear out of chronological order.
  for (const date in grouped) {
    grouped[date].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // Day-groups whose matches ALL ended more than 24h ago start collapsed, so the
  // user lands near today's + upcoming matches without scrolling past a wall of
  // finished days. A match end is estimated as kickoff + 2h; a day is "old" once
  // its latest match ended before the 24h cutoff (captured once at mount).
  // Today's and future days never qualify (their end-times aren't in the past).
  // The default is derived during render off the full match set, so it's stable
  // across the group filter; `dayOverrides` records explicit user open/close
  // choices, which win over the default.
  const [mountNow] = useState(() => Date.now());
  const [dayOverrides, setDayOverrides] = useState<Record<string, boolean>>({});
  const isOldDay = (dayMatches: Match[]) => {
    let lastEnd = 0;
    for (const m of dayMatches) lastEnd = Math.max(lastEnd, new Date(m.date).getTime() + 2 * 60 * 60 * 1000);
    return lastEnd < mountNow - 24 * 60 * 60 * 1000;
  };
  const toggleDay = (date: string, currentlyCollapsed: boolean) =>
    setDayOverrides((prev) => ({ ...prev, [date]: !currentlyCollapsed }));

  // Deep link from the home page ("כל ההימורים על המשחק") — ?match=<id> opens
  // that match's detail, forces its (possibly collapsed) day open, and scrolls
  // to it. Runs once the target match is present in the fetched list. State is
  // set off the event loop so it doesn't fire synchronously during the effect.
  const deepLinkedRef = useRef(false);
  useEffect(() => {
    if (deepLinkedRef.current || matches.length === 0) return;
    const raw = new URLSearchParams(window.location.search).get("match");
    if (!raw) {
      deepLinkedRef.current = true;
      return;
    }
    const id = Number(raw);
    const target = Number.isFinite(id) ? matches.find((m) => m.id === id) : undefined;
    if (!target) {
      if (!Number.isFinite(id)) deepLinkedRef.current = true;
      return; // valid id not loaded yet — retry when matches change
    }
    deepLinkedRef.current = true;
    const dayKey = toIsraelDateKey(target.date);
    const t = setTimeout(() => {
      setExpandedMatch(id);
      setDayOverrides((prev) => ({ ...prev, [dayKey]: false }));
      setTimeout(() => {
        document.getElementById(`sched-match-${id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 80);
    }, 0);
    return () => clearTimeout(t);
  }, [matches]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24" dir="rtl">
      <div className="mb-5">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>לוח משחקים</h1>
        <p className="text-base text-gray-600 mt-1">כל 104 המשחקים בשעון ישראל · לחצו על משחק לפרטים</p>
      </div>

      {/* Filter */}
      <div className="mb-4 flex gap-1 flex-wrap">
        {[
          { key: "ALL", label: "הכל" },
          ...["A","B","C","D","E","F","G","H","I","J","K","L"].map(g => ({ key: g, label: `בית ${g}` })),
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === f.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <LoadingPage />
      ) : matches.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-500">לוח המשחקים יתעדכן מ-Football-Data.org כשיהיה זמין</p>
          <p className="text-sm text-gray-400 mt-2">בינתיים, מלאו את ההימורים שלכם בדפי ההימורים</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort().map(([date, dayMatches]) => {
            const collapsed = date in dayOverrides ? dayOverrides[date] : isOldDay(dayMatches);
            if (collapsed) {
              return (
                <div key={date}>
                  <button
                    onClick={() => toggleDay(date, true)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white/60 hover:bg-gray-50 transition-colors"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400 shrink-0 rotate-90" aria-hidden>
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                      <span className="text-sm font-bold text-gray-600 truncate">{toIsraelDate(dayMatches[0].date)}</span>
                    </span>
                    <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap">✓ {dayMatches.length} משחקים</span>
                  </button>
                </div>
              );
            }
            return (
            <div key={date}>
              <h2
                onClick={() => toggleDay(date, false)}
                className="text-base font-bold text-gray-800 mb-2 sticky top-28 bg-[#F8F9FB] py-1 z-10 flex items-center gap-2 cursor-pointer"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-400 shrink-0" aria-hidden>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                {toIsraelDate(dayMatches[0].date)}
              </h2>
              <div className="space-y-2">
                {dayMatches.map(m => {
                  const isExpanded = expandedMatch === m.id;
                  const isFinished = m.status === "FINISHED";
                  const isLive = m.status === "IN_PLAY" || m.status === "PAUSED";
                  const hasScore = (isFinished || isLive) && m.homeGoals != null && m.awayGoals != null;
                  return (
                    <div key={m.id} id={`sched-match-${m.id}`} className={`rounded-xl border shadow-sm overflow-hidden transition-all ${
                      isLive ? "bg-red-50/40 border-red-200" :
                      isFinished ? "bg-green-50/40 border-green-200" :
                      isExpanded ? "bg-white border-blue-300 shadow-md" : "bg-white border-gray-200 hover:border-gray-300"
                    }`}>
                      <div
                        onClick={() => setExpandedMatch(isExpanded ? null : m.id)}
                        className="px-4 py-3 grid grid-cols-[1fr_80px_1fr] items-center cursor-pointer"
                      >
                        <div className="flex items-center gap-2 justify-end">
                          <span className="font-bold text-sm text-end">{getTeamNameHe(m.homeTla) || m.homeTeam}</span>
                          <TeamLogo code={m.homeTla} size="sm" />
                        </div>
                        <div className="text-center">
                          {hasScore ? (
                            <>
                              {/* RTL: home team is on the RIGHT → home goals must
                                  be the right-hand digit (away-home glyph order). */}
                              <p dir="ltr" className="text-lg font-black text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
                                {m.awayGoals}-{m.homeGoals}
                              </p>
                              <p className={`text-[10px] font-bold ${isLive ? "text-red-600" : "text-green-700"}`}>
                                {isLive ? "● לייב" : "✓ נגמר"}
                              </p>
                            </>
                          ) : (
                            <p className="text-base font-black text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{toIsraelTimeShort(m.date)}</p>
                          )}
                          <p className="text-[10px] text-gray-400">{m.group?.replace("GROUP_", "בית ") || m.stage}</p>

                        </div>
                        <div className="flex items-center gap-2 justify-start">
                          <TeamLogo code={m.awayTla} size="sm" />
                          <span className="font-bold text-sm">{getTeamNameHe(m.awayTla) || m.awayTeam}</span>
                        </div>
                      </div>
                      {/* Edit-bet strip — below the row; the 80px center cell
                          can't fit the button on mobile. */}
                      {!isFinished && !isLive && (() => {
                        const letter = normalizeGroupLetter(m.group);
                        const betPair = letter ? matchPairIndex(letter, m.homeTla, m.awayTla) : null;
                        if (!betPair || !letter) return null;
                        // Stored pick is canonical-oriented; flip to the real
                        // home/away so it matches the row's team sides, then
                        // render away-home (home goals = right-hand digit).
                        const stored = myGroups[letter]?.scores?.[betPair.pairIdx];
                        const myPick = stored && stored.home !== null && stored.away !== null
                          ? (betPair.flipped ? { home: stored.away, away: stored.home } : { home: stored.home, away: stored.away })
                          : null;
                        return (
                          <div className="pb-2.5 -mt-1 flex items-center justify-center gap-2">
                            <Link
                              href={`/groups?group=${letter}&match=${betPair.pairIdx}`}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-700 text-[11px] font-bold px-2.5 py-1 transition-colors"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                              </svg>
                              שנה הימור
                            </Link>
                            {myPick && (
                              <span dir="ltr" className="text-[11px] font-bold text-gray-400 tabular-nums" style={{ fontFamily: "var(--font-inter)" }} title="ההימור שלך">
                                {myPick.away}-{myPick.home}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      {(m.venue || (m.referees && m.referees.length > 0)) && (
                        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/60 text-[11px] text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                          {m.venue && (
                            <span className="flex items-center gap-1">
                              <span aria-hidden>🏟️</span>
                              <span>{m.venue}</span>
                            </span>
                          )}
                          {m.referees && m.referees.length > 0 && (() => {
                            const main = m.referees.find((r) => r.role === "REFEREE" || r.role === "MAIN_REFEREE") || m.referees[0];
                            return main ? (
                              <span className="flex items-center gap-1">
                                <span aria-hidden>👨‍⚖️</span>
                                <span>שופט: {main.name}{main.nationality ? ` (${main.nationality})` : ""}</span>
                              </span>
                            ) : null;
                          })()}
                        </div>
                      )}
                      <AnimatePresence>
                        {isExpanded && (
                          <MatchBetsPanel
                            match={m}
                            brackets={brackets}
                            specialBets={specialBets}
                            advancements={advancements}
                            matchDays={matchDays}
                          />
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
