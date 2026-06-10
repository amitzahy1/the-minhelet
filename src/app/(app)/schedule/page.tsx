"use client";
import { LoadingPage } from "@/components/shared/LoadingAnimation";
import { useSharedData } from "@/hooks/useSharedData";
import { useBettingStore } from "@/stores/betting-store";
import { isLocked, revealAtFor, LOCK_DEADLINE } from "@/lib/constants";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import type { BettorSpecialBets, BettorAdvancement, BettorBracket } from "@/lib/supabase/shared-data";
import { matchPairIndex, normalizeGroupLetter } from "@/lib/results-hits";
import { computeMatchDays, dayLockAtForKickoff, type MatchDay } from "@/lib/tournament/group-live-state";

import { useState, useEffect, useMemo } from "react";
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
}

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
              <p className="text-xs font-bold text-gray-500 mb-2">ניחושי תוצאה</p>
              {scorePredictions.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {scorePredictions.map((p) => (
                    <div key={p.userId} className="flex items-center justify-between px-2.5 py-1.5 bg-white rounded-lg border border-gray-200 text-xs">
                      <span className="font-bold text-gray-800">{p.name}</span>
                      <span className="font-black text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{p.home}-{p.away}</span>
                    </div>
                  ))}
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
          {Object.entries(grouped).sort().map(([date, dayMatches]) => (
            <div key={date}>
              <h2 className="text-base font-bold text-gray-800 mb-2 sticky top-28 bg-[#F8F9FB] py-1 z-10">
                {toIsraelDate(dayMatches[0].date)}
              </h2>
              <div className="space-y-2">
                {dayMatches.map(m => {
                  const isExpanded = expandedMatch === m.id;
                  return (
                    <div key={m.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
                      isExpanded ? "border-blue-300 shadow-md" : "border-gray-200 hover:border-gray-300"
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
                          <p className="text-base font-black text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{toIsraelTimeShort(m.date)}</p>
                          <p className="text-[10px] text-gray-400">{m.group?.replace("GROUP_", "בית ") || m.stage}</p>
                        </div>
                        <div className="flex items-center gap-2 justify-start">
                          <TeamLogo code={m.awayTla} size="sm" />
                          <span className="font-bold text-sm">{getTeamNameHe(m.awayTla) || m.awayTeam}</span>
                        </div>
                      </div>
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
          ))}
        </div>
      )}
    </div>
  );
}
