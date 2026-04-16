"use client";
import { LoadingPage } from "@/components/shared/LoadingAnimation";
import { useSharedData } from "@/hooks/useSharedData";
import { useBettingStore } from "@/stores/betting-store";
import { isLocked } from "@/lib/constants";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import type { BettorProfile, BettorSpecialBets, BettorAdvancement, MatchPrediction } from "@/lib/supabase/shared-data";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toIsraelTimeShort, toIsraelDate } from "@/lib/timezone";

// Mock bettor predictions — in production from Supabase
const MOCK_PREDICTIONS: Record<string, Record<string, string>> = {
  "דני": {},
  "יוני": {},
  "דור דסא": {},
  "אמית": {},
  "רון ב": {},
  "רון ג": {},
  "רועי": {},
  "עידן": {},
  "אוהד": {},
  "אורי": {},
};

// Mock special bets per bettor
const MOCK_SPECIAL_BETS: Record<string, {
  winner: string;
  topScorer: { team: string; player: string };
  topAssists: { team: string; player: string };
  bestAttack: string;
  dirtiestTeam: string;
}> = {
  "דני": { winner: "ARG", topScorer: { team: "ARG", player: "Lautaro" }, topAssists: { team: "FRA", player: "Griezmann" }, bestAttack: "BRA", dirtiestTeam: "URU" },
  "יוני": { winner: "FRA", topScorer: { team: "FRA", player: "Mbappé" }, topAssists: { team: "ESP", player: "Pedri" }, bestAttack: "ARG", dirtiestTeam: "MAR" },
  "דור דסא": { winner: "ARG", topScorer: { team: "BRA", player: "Vinícius Jr." }, topAssists: { team: "GER", player: "Musiala" }, bestAttack: "FRA", dirtiestTeam: "KSA" },
  "אמית": { winner: "ARG", topScorer: { team: "ARG", player: "Messi" }, topAssists: { team: "ARG", player: "Messi" }, bestAttack: "GER", dirtiestTeam: "MAR" },
  "רון ב": { winner: "BRA", topScorer: { team: "ENG", player: "Kane" }, topAssists: { team: "BRA", player: "Rodrygo" }, bestAttack: "ESP", dirtiestTeam: "IRN" },
  "רון ג": { winner: "FRA", topScorer: { team: "POR", player: "Ronaldo" }, topAssists: { team: "FRA", player: "Mbappé" }, bestAttack: "ARG", dirtiestTeam: "AUS" },
  "רועי": { winner: "ESP", topScorer: { team: "ESP", player: "Morata" }, topAssists: { team: "ENG", player: "Bellingham" }, bestAttack: "FRA", dirtiestTeam: "URU" },
  "עידן": { winner: "ARG", topScorer: { team: "ARG", player: "Álvarez" }, topAssists: { team: "POR", player: "B. Fernandes" }, bestAttack: "ARG", dirtiestTeam: "CRO" },
  "אוהד": { winner: "BRA", topScorer: { team: "GER", player: "Havertz" }, topAssists: { team: "NED", player: "Gakpo" }, bestAttack: "BRA", dirtiestTeam: "SEN" },
  "אורי": { winner: "ENG", topScorer: { team: "ENG", player: "Kane" }, topAssists: { team: "ENG", player: "Saka" }, bestAttack: "ENG", dirtiestTeam: "QAT" },
};

// Generate mock score predictions for each bettor per match
function getMockPrediction(bettor: string, matchId: number, homeTla: string, awayTla: string): string {
  // Deterministic pseudo-random based on bettor name + match id
  const seed = bettor.charCodeAt(0) + matchId * 7;
  const h = (seed % 4);
  const a = ((seed * 3 + 1) % 3);
  return `${h}-${a}`;
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
}

interface MatchBetsPanelProps {
  match: Match;
  profiles: BettorProfile[];
  specialBets: BettorSpecialBets[];
  advancements: BettorAdvancement[];
  predictions: MatchPrediction[];
}

function MatchBetsPanel({ match, profiles, specialBets, advancements, predictions }: MatchBetsPanelProps) {
  const home = match.homeTla;
  const away = match.awayTla;
  const groupLetter = match.group?.replace("GROUP_", "") || "";
  const locked = isLocked();

  // Real predictions for this match
  const realPredictions = predictions.filter(p => p.matchId === match.id);
  const hasPredictions = realPredictions.length > 0;

  // Real special bets available?
  const hasSpecialBets = specialBets.length > 0;
  const hasAdvancements = advancements.length > 0;

  // Bettor list: use real profiles if available, else mock
  const bettors = hasPredictions
    ? realPredictions.map(p => p.displayName)
    : Object.keys(MOCK_PREDICTIONS);

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

  // Always show mock bettors' special bets (until real Supabase data replaces them)
  {
    const mockBettors = Object.keys(MOCK_SPECIAL_BETS);
    for (const bettor of mockBettors) {
      const sb = MOCK_SPECIAL_BETS[bettor];
      if (!sb) continue;
      if (sb.winner === home || sb.winner === away) {
        relatedBets.push({ bettor, type: "אלוף", detail: `${getFlag(sb.winner)} ${getTeamNameHe(sb.winner)}` });
      }
      if (sb.topScorer.team === home || sb.topScorer.team === away) {
        relatedBets.push({ bettor, type: "מלך שערים", detail: `${sb.topScorer.player} (${getFlag(sb.topScorer.team)} ${getTeamNameHe(sb.topScorer.team)})` });
      }
      if (sb.topAssists.team === home || sb.topAssists.team === away) {
        relatedBets.push({ bettor, type: "מלך בישולים", detail: `${sb.topAssists.player} (${getFlag(sb.topAssists.team)} ${getTeamNameHe(sb.topAssists.team)})` });
      }
      if (sb.bestAttack === home || sb.bestAttack === away) {
        relatedBets.push({ bettor, type: "התקפה הכי טובה", detail: `${getFlag(sb.bestAttack)} ${getTeamNameHe(sb.bestAttack)}` });
      }
      if (sb.dirtiestTeam === home || sb.dirtiestTeam === away) {
        relatedBets.push({ bettor, type: "הכי כסחנית", detail: `${getFlag(sb.dirtiestTeam)} ${getTeamNameHe(sb.dirtiestTeam)}` });
      }
    }
  }

  // Also add real Supabase data if available (will override/supplement mock)
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
        {!locked && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
            <p className="text-xs font-bold text-amber-700">הניחושים ייחשפו אחרי נעילת ההימורים (18.04.2026, 20:00 · דמו)</p>
          </div>
        )}
        {/* Score predictions — only after lock */}
        {locked && <div>
          <p className="text-xs font-bold text-gray-500 mb-2">ניחושי תוצאה</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {hasPredictions
              ? realPredictions.map(p => (
                <div key={p.userId} className="flex items-center justify-between px-2.5 py-1.5 bg-white rounded-lg border border-gray-200 text-xs">
                  <span className="font-bold text-gray-800">{p.displayName}</span>
                  <span className="font-black text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{p.predictedHomeGoals}-{p.predictedAwayGoals}</span>
                </div>
              ))
              : bettors.map(bettor => {
                const pred = getMockPrediction(bettor, match.id, home, away);
                return (
                  <div key={bettor} className="flex items-center justify-between px-2.5 py-1.5 bg-white rounded-lg border border-gray-200 text-xs">
                    <span className="font-bold text-gray-800">{bettor}</span>
                    <span className="font-black text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{pred}</span>
                  </div>
                );
              })
            }
          </div>
        </div>}

        {/* Related special bets — only after lock */}
        {locked && Object.keys(groupedBets).length > 0 && (
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

        {/* Group info — only after lock */}
        {locked && groupLetter && (
          <div>
            <p className="text-xs font-bold text-gray-500 mb-2">הימורים על בית {groupLetter}</p>
            <div className="bg-white rounded-lg border border-gray-200 px-3 py-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {bettors.slice(0, 6).map((bettor, i) => {
                  const mockOrder = i % 2 === 0
                    ? [home, away, "---", "---"]
                    : [away, home, "---", "---"];
                  return (
                    <div key={bettor} className="text-xs border border-gray-100 rounded-lg p-2">
                      <p className="font-bold text-gray-800 mb-1">{bettor}</p>
                      <div className="space-y-0.5">
                        {mockOrder.map((t, j) => (
                          <div key={j} className={`flex items-center gap-1.5 ${j < 2 ? "text-green-700 font-medium" : "text-gray-400"}`}>
                            <span className="text-[10px] w-3 shrink-0" style={{ fontFamily: "var(--font-inter)" }}>{j + 1}.</span>
                            {t !== "---" ? (
                              <>
                                <span>{getFlag(t)}</span>
                                <span className="truncate">{getTeamNameHe(t)}</span>
                              </>
                            ) : (
                              <span className="text-gray-300">...</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
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
  const { profiles, specialBets, advancements, predictions, loading: dataLoading } = useSharedData();

  useEffect(() => {
    fetchMatches();
  }, []);

  async function fetchMatches() {
    try {
      const res = await fetch("/api/matches");
      const data = await res.json();
      setMatches(data.matches || []);
    } catch {
      // Fallback — use static sample
    }
    setLoading(false);
  }


  // Group matches by date
  const grouped: Record<string, Match[]> = {};
  const filtered = filter === "ALL" ? matches : matches.filter(m => m.group === `GROUP_${filter}` || m.stage === filter);
  for (const m of filtered) {
    const date = new Date(m.date).toISOString().split("T")[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(m);
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
                          <span className="text-lg shrink-0">{getFlag(m.homeTla)}</span>
                        </div>
                        <div className="text-center">
                          <p className="text-base font-black text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{toIsraelTimeShort(m.date)}</p>
                          <p className="text-[10px] text-gray-400">{m.group?.replace("GROUP_", "בית ") || m.stage}</p>
                        </div>
                        <div className="flex items-center gap-2 justify-start">
                          <span className="text-lg shrink-0">{getFlag(m.awayTla)}</span>
                          <span className="font-bold text-sm">{getTeamNameHe(m.awayTla) || m.awayTeam}</span>
                        </div>
                      </div>
                      <AnimatePresence>
                        {isExpanded && (
                          <MatchBetsPanel
                            match={m}
                            profiles={profiles}
                            specialBets={specialBets}
                            advancements={advancements}
                            predictions={predictions}
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
