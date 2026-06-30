"use client";

import { Fragment, useState, useMemo, useEffect } from "react";
import { PredictionHeatmap } from "@/components/shared/PredictionHeatmap";
import { useSharedData } from "@/hooks/useSharedData";
import { useScoring } from "@/hooks/useScoring";
import { GROUPS } from "@/lib/tournament/groups";
import { MATCHUPS } from "@/lib/matchups";
import { computeGroupHits, hitCounts, normalizeGroupLetter, type BettorHit, type FinishedMatch } from "@/lib/results-hits";
import { FLAGS, getFlag, getTeamNameHe } from "@/lib/flags";
import { SpecialTrackerView } from "@/components/shared/SpecialTrackerView";
import { AgreementMatrix } from "@/components/shared/AgreementMatrix";
import WhosAlive from "@/components/shared/WhosAlive";
import { useEliminatedTeams } from "@/hooks/useEliminatedTeams";
import { useLiveSpecials } from "@/hooks/useLiveSpecials";
import { computeKnockoutCeiling } from "@/lib/scoring/live-scorer";
import { computeSpecialBetsPool, scoreSpecialBetsForUser } from "@/lib/scoring/special-bets-scorer";
import type { BettorAdvancement, BettorBracket, BettorSpecialBets } from "@/lib/supabase/shared-data";
import { formatLockDeadline } from "@/lib/constants";
import Link from "next/link";

// Color coding: each unique value gets a FIXED color — same pick = same color everywhere
const VALUE_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-amber-100 text-amber-800",
  "bg-purple-100 text-purple-800",
  "bg-pink-100 text-pink-800",
  "bg-cyan-100 text-cyan-800",
  "bg-orange-100 text-orange-800",
  "bg-indigo-100 text-indigo-800",
  "bg-lime-100 text-lime-800",
  "bg-rose-100 text-rose-800",
  "bg-teal-100 text-teal-800",
  "bg-sky-100 text-sky-800",
  "bg-emerald-100 text-emerald-800",
  "bg-violet-100 text-violet-800",
  "bg-fuchsia-100 text-fuchsia-800",
  "bg-yellow-100 text-yellow-800",
];

// Build a color map: each unique value that appears 2+ times gets a fixed color
function buildColorMap(allValues: string[]): Record<string, string> {
  const counts: Record<string, number> = {};
  for (const v of allValues) { if (v) counts[v] = (counts[v] || 0) + 1; }

  const map: Record<string, string> = {};
  let colorIdx = 0;
  // Sort by frequency (most popular first) so popular picks get the best colors
  const sorted = Object.entries(counts).filter(([,c]) => c >= 2).sort((a,b) => b[1] - a[1]);
  for (const [value] of sorted) {
    map[value] = VALUE_COLORS[colorIdx % VALUE_COLORS.length];
    colorIdx++;
  }
  return map;
}

function getValueColor(value: string, colorMap: Record<string, string>): string {
  if (!value) return "";
  return colorMap[value] || "";
}

interface Bettor {
  userId: string;
  name: string;
  winner: string;
  finalist1: string;
  finalist2: string;
  sf: string[];
  qf: string[];
  r16: string[];
  topScorer: string;
  topAssists: string;
  bestAttack: string;
  dirtiestTeam: string;
  prolificGroup: string;
  driestGroup: string;
  matchup1: string;
  matchup2: string;
  matchup3: string;
  penalties: string;
  groups: Record<string, string[]>;
  isYou?: boolean;
}


// Centralized flag map — the old local copy was missing several teams
// (TUR, SUI, CIV, AUS, QAT, ECU...), which rendered flagless.
const F: Record<string, string> = FLAGS;

type View = "results" | "advancement" | "specials" | "groups" | "whatif" | "alive" | "sim" | "heatmap" | "matrix";

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

export default function ComparePage() {
  const [view, setView] = useState<View>("specials");

  // Load real data from Supabase (after lock, uses server API to bypass RLS)
  const { brackets, specialBets, advancements, currentUserId, loading } = useSharedData();

  // Finished matches for the "תוצאות" tab
  const [allMatches, setAllMatches] = useState<MatchApi[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/matches");
        const data = await res.json();
        if (alive) setAllMatches((data.matches as MatchApi[]) || []);
      } catch {
        if (alive) setAllMatches([]);
      }
      if (alive) setLoadingMatches(false);
    })();
    return () => { alive = false; };
  }, []);

  const finishedGroupMatches: FinishedMatch[] = useMemo(() => {
    return allMatches
      .filter(
        (m) =>
          m.status === "FINISHED" &&
          m.homeGoals !== null && m.homeGoals !== undefined &&
          m.awayGoals !== null && m.awayGoals !== undefined &&
          (m.stage === "GROUP_STAGE" || !m.stage) // group stage only for now
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
      }))
      .filter((m) => !!m.group) // must have a group letter
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allMatches]);

  // Heatmap: per-bettor × per-group score-prediction accuracy from finished
  // group matches. value = % of that group's finished matches the bettor hit
  // (exact or toto). Groups with no finished match yet are omitted (rendered
  // as a neutral "—" cell, not a misleading red 0%).
  const heatmapData = useMemo(() => {
    if (finishedGroupMatches.length === 0 || brackets.length === 0) return [];
    const byGroup: Record<string, FinishedMatch[]> = {};
    for (const m of finishedGroupMatches) (byGroup[m.group] ||= []).push(m);
    return brackets.map((b) => {
      const groups: Record<string, number | null> = {};
      for (const [letter, ms] of Object.entries(byGroup)) {
        let hit = 0;
        for (const m of ms) {
          const h = computeGroupHits(m, [b])[0];
          if (h && (h.hit === "exact" || h.hit === "toto")) hit++;
        }
        groups[letter] = Math.round((hit / ms.length) * 100);
      }
      return { name: b.displayName || "ללא שם", groups };
    });
  }, [finishedGroupMatches, brackets]);

  // Finished-match count per group — the denominator behind each heatmap cell.
  // Surfaced in the header ("N/6") + cell tooltips so a 0% over 2 games doesn't
  // read the same as a 0% over 4.
  const groupMatchCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const m of finishedGroupMatches) counts[m.group] = (counts[m.group] || 0) + 1;
    return counts;
  }, [finishedGroupMatches]);

  // Build real bettors from Supabase data
  const realBettors = useMemo((): Bettor[] => {
    if (brackets.length === 0) return [];

    return brackets.map((bracket) => {
      // Find matching special bets and advancement picks for this user
      const sb = specialBets.find((s) => s.userId === bracket.userId);
      const adv = advancements.find((a) => a.userId === bracket.userId);

      // Extract group qualifiers (top-2 from each group)
      const groups: Record<string, string[]> = {};
      const hasGroupQualifiers = adv?.groupQualifiers && Object.keys(adv.groupQualifiers).length > 0;
      if (hasGroupQualifiers) {
        for (const [groupId, teams] of Object.entries(adv!.groupQualifiers)) {
          groups[groupId] = (teams || []).slice(0, 2);
        }
      } else if (bracket.groupPredictions) {
        // Fallback: derive team codes from group predictions order indices
        for (const [groupId, pred] of Object.entries(bracket.groupPredictions)) {
          if (pred?.order && GROUPS[groupId]) {
            const teamCodes = pred.order
              .slice(0, 2)
              .map((idx: number) => GROUPS[groupId][idx]?.code || "")
              .filter(Boolean);
            if (teamCodes.length > 0) groups[groupId] = teamCodes;
          }
        }
      }

      // Extract knockout picks from advancement data
      const champion = bracket.champion || adv?.winner || "";
      const advToFinal = adv?.advanceToFinal || [];
      const advToSF = adv?.advanceToSF || [];
      const advToQF = adv?.advanceToQF || [];
      const advToR16 = adv?.advanceToR16 || [];

      // Determine finalist pair: champion + the other finalist
      const finalist1 = champion;
      const finalist2 = advToFinal.find((t) => t !== champion) || advToFinal[0] || "";

      // Semi-finalists: those in advanceToSF (or advanceToFinal as fallback)
      const sf = advToSF.length > 0 ? advToSF.slice(0, 4) : advToFinal.slice(0, 4);

      // Quarter-finalists
      const qf = advToQF.length > 0 ? advToQF.slice(0, 8) : [];

      return {
        userId: bracket.userId,
        name: bracket.displayName,
        winner: champion,
        finalist1,
        finalist2,
        sf,
        qf,
        r16: advToR16.slice(0, 16),
        topScorer: sb?.topScorerPlayer || "",
        topAssists: sb?.topAssistsPlayer || "",
        bestAttack: sb?.bestAttackTeam || "",
        dirtiestTeam: sb?.dirtiestTeam || "",
        prolificGroup: sb?.prolificGroup || "",
        driestGroup: sb?.driestGroup || "",
        matchup1: sb?.matchupPick?.split(",")[0] || "",
        matchup2: sb?.matchupPick?.split(",")[1] || "",
        matchup3: sb?.matchupPick?.split(",")[2] || "",
        penalties: sb?.penaltiesOverUnder || "",
        groups,
        isYou: bracket.userId === currentUserId,
      };
    });
  }, [brackets, specialBets, advancements, currentUserId]);

  const BETTORS = realBettors;

  // Bettor filter — empty set = show everyone. Applied at the DATA level so
  // every tab (advancement, specials, groups, results, matrix, alive) shows
  // only the selected bettors without per-tab logic.
  const [filterIds, setFilterIds] = useState<Set<string>>(new Set());
  const filterActive = filterIds.size > 0;
  const fBettors = filterActive ? BETTORS.filter((b) => filterIds.has(b.userId)) : BETTORS;
  const fBrackets = filterActive ? brackets.filter((b) => filterIds.has(b.userId)) : brackets;
  const fSpecialBets = filterActive ? specialBets.filter((s) => filterIds.has(s.userId)) : specialBets;
  const fAdvancements = filterActive ? advancements.filter((a) => filterIds.has(a.userId)) : advancements;
  const toggleFilter = (userId: string) =>
    setFilterIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });

  // Team filter for the advancement view — highlights one team's cells across
  // the table and dims the rest. Options are every team anyone advanced/picked,
  // sorted by Hebrew name (א→ת).
  const [advTeamFilter, setAdvTeamFilter] = useState("");
  const advTeamOptions = useMemo(() => {
    const set = new Set<string>();
    for (const b of BETTORS) {
      if (b.winner) set.add(b.winner);
      if (b.finalist1) set.add(b.finalist1);
      if (b.finalist2) set.add(b.finalist2);
      for (const t of [...b.sf, ...b.qf, ...b.r16]) if (t) set.add(t);
    }
    return [...set].sort((a, b) => (getTeamNameHe(a) || a).localeCompare(getTeamNameHe(b) || b, "he"));
  }, [BETTORS]);

  // Build color maps for each category
  const advColors = useMemo(() => buildColorMap([
    ...BETTORS.map(b=>b.winner), ...BETTORS.flatMap(b=>[b.finalist1,b.finalist2]),
    ...BETTORS.flatMap(b=>b.sf), ...BETTORS.flatMap(b=>b.qf), ...BETTORS.flatMap(b=>b.r16),
  ]), [BETTORS]);
  const specColors = useMemo(() => buildColorMap([
    ...BETTORS.map(b=>b.topScorer), ...BETTORS.map(b=>b.topAssists),
    ...BETTORS.map(b=>b.bestAttack), ...BETTORS.map(b=>b.dirtiestTeam),
    ...BETTORS.map(b=>b.prolificGroup), ...BETTORS.map(b=>b.driestGroup),
    ...BETTORS.map(b=>b.matchup1), ...BETTORS.map(b=>b.matchup2),
    ...BETTORS.map(b=>b.matchup3), ...BETTORS.map(b=>b.penalties),
  ]), [BETTORS]);
  const groupColors = useMemo(() => {
    const all: string[] = [];
    BETTORS.forEach(b => Object.values(b.groups).forEach(g => all.push(...g)));
    return buildColorMap(all);
  }, [BETTORS]);

  // Lock check — hide ALL predictions until deadline. No exceptions.
  // Uses the single-source-of-truth constant from lib/constants.
  const isLocked = new Date() >= new Date("2026-06-10T14:00:00Z");

  return (
    <div className="max-w-full mx-auto px-4 py-6 pb-24">
      <div className="mb-5">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>השוואת הימורים</h1>
        <p className="text-base text-gray-600 mt-1">
          {isLocked ? "ראו מה כל מהמר בחר — השוואה מלאה" : `ההימורים ייחשפו אחרי הנעילה ב-${formatLockDeadline()}`}
        </p>
      </div>

      {!isLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center mb-6">
          <span className="text-4xl mb-3 block">🔒</span>
          <h2 className="text-xl font-bold text-amber-800 mb-2">ההימורים עדיין סודיים!</h2>
          <p className="text-sm text-amber-700">הניחושים של כל המהמרים ייחשפו רק אחרי נעילת ההימורים ב-10 ביוני 2026, 17:00.</p>
          <p className="text-sm text-amber-600 mt-2">בינתיים — השלימו את ההימורים שלכם!</p>
        </div>
      )}

      {isLocked && loading && (
        <div className="text-center py-12">
          <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
          <p className="text-sm text-gray-500 font-bold">טוען את ההימורים של כולם...</p>
        </div>
      )}

      {isLocked && !loading && BETTORS.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center">
          <p className="text-sm text-gray-500">אין עדיין הימורים להצגה</p>
        </div>
      )}

      {/* View tabs — only visible after lock + data loaded */}
      {isLocked && !loading && BETTORS.length > 0 && <div className="mb-5 flex gap-2 flex-wrap">
        {[
          { key: "specials" as View, label: "הימורים מיוחדים" },
          { key: "advancement" as View, label: "עולות + זוכה" },
          { key: "alive" as View, label: "מי חי?" },
          { key: "results" as View, label: "תוצאות ותפיסות" },
          { key: "groups" as View, label: "עולות מהבתים" },
          { key: "matrix" as View, label: "מטריצה" },
          { key: "whatif" as View, label: "מה אם...?" },
          { key: "sim" as View, label: "סימולציה" },
          { key: "heatmap" as View, label: "מפת חום" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setView(tab.key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              view === tab.key ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:bg-gray-200 border border-gray-200"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>}

      {/* Bettor filter — applies to every tab's data */}
      {isLocked && !loading && BETTORS.length > 0 && (
        <div className="mb-5 flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-gray-500 me-1">מהמרים:</span>
          <button
            onClick={() => setFilterIds(new Set())}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              !filterActive ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
            }`}
          >
            הכל
          </button>
          {currentUserId && (
            <button
              onClick={() => setFilterIds(new Set([currentUserId]))}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                filterActive && filterIds.size === 1 && filterIds.has(currentUserId)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"
              }`}
            >
              רק אני
            </button>
          )}
          {BETTORS.map((b) => (
            <button
              key={b.userId}
              onClick={() => toggleFilter(b.userId)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                filterIds.has(b.userId)
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {isLocked && !loading && BETTORS.length > 0 && <>
      {/* === RESULTS VIEW === per-match who-hit-what */}
      {view === "results" && (
        <ResultsView
          matches={finishedGroupMatches}
          brackets={fBrackets}
          currentUserId={currentUserId}
          loading={loadingMatches}
        />
      )}

      {/* === MATRIX VIEW === pairwise agreement heatmaps: total (all bets) +
          score-prediction agreement, side by side on wide screens */}
      {view === "matrix" && (
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 items-start">
          <AgreementMatrix
            mode="total"
            brackets={fBrackets}
            specialBets={fSpecialBets}
            currentUserId={currentUserId}
          />
          <AgreementMatrix mode="scores" brackets={fBrackets} currentUserId={currentUserId} />
        </div>
      )}

      {/* === ADVANCEMENT VIEW === transposed: bettors as columns, bet rows */}
      {view === "advancement" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-gray-500">סנן לפי נבחרת:</span>
            <select
              value={advTeamFilter}
              onChange={(e) => setAdvTeamFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">כל הנבחרות</option>
              {advTeamOptions.map((t) => (
                <option key={t} value={t}>{getTeamNameHe(t) || t} ({t})</option>
              ))}
            </select>
            {advTeamFilter && (
              <button onClick={() => setAdvTeamFilter("")} className="text-xs font-bold text-blue-600 hover:text-blue-800">
                נקה סינון ✕
              </button>
            )}
          </div>
          <TransposedBetTable
            bettors={fBettors}
            colorMap={advColors}
            highlightTeam={advTeamFilter}
            rows={[
              { label: "זוכה", section: "winner" as const, render: (b) => ({ val: b.winner, node: <span className="font-bold text-amber-700">{F[b.winner]} {b.winner}</span> }), highlight: true },
              { label: "גמר 1", section: "final" as const, render: (b) => ({ val: b.finalist1, node: <span className="text-gray-700">{F[b.finalist1]} {b.finalist1}</span> }) },
              { label: "גמר 2", section: "final" as const, render: (b) => ({ val: b.finalist2, node: <span className="text-gray-700">{F[b.finalist2]} {b.finalist2}</span> }) },
              ...[0, 1, 2, 3].map((i) => ({ label: `חצי ${i + 1}`, section: "semi" as const, render: (b: Bettor) => ({ val: b.sf[i] || "", node: <span className="text-gray-700">{F[b.sf[i]]} {b.sf[i]}</span> }) })),
              ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ label: `רבע ${i + 1}`, section: "quarter" as const, render: (b: Bettor) => ({ val: b.qf[i] || "", node: <span className="text-gray-700">{F[b.qf[i]]} {b.qf[i]}</span> }) })),
              ...Array.from({ length: 16 }, (_, i) => ({ label: `שמינית ${i + 1}`, section: "r16" as const, render: (b: Bettor) => ({ val: b.r16[i] || "", node: <span className="text-gray-700">{F[b.r16[i]]} {b.r16[i]}</span> }) })),
            ]}
          />
          {/* Popular picks — computed from real data */}
          {(() => {
            function topPick(arr: string[]): { value: string; count: number } | null {
              const counts: Record<string, number> = {};
              for (const v of arr) { if (v) counts[v] = (counts[v] || 0) + 1; }
              const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
              return top ? { value: top[0], count: top[1] } : null;
            }
            const topWinner = topPick(fBettors.map(b => b.winner));
            const topFinalist = topPick(fBettors.flatMap(b => [b.finalist1, b.finalist2]));
            const topScorer = topPick(fBettors.map(b => b.topScorer));
            if (!topWinner && !topFinalist && !topScorer) return null;
            return (
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
                <p className="text-sm font-bold text-gray-700 mb-2">הבחירות הפופולריות:</p>
                <div className="flex gap-4 text-sm flex-wrap">
                  {topWinner && <span>זוכה: <strong className="text-amber-700">{F[topWinner.value] || ""} {topWinner.value} ({topWinner.count} מהמרים)</strong></span>}
                  {topFinalist && <span>עולה לגמר: <strong>{F[topFinalist.value] || ""} {topFinalist.value} ({topFinalist.count} מהמרים)</strong></span>}
                  {topScorer && <span>מלך שערים: <strong>{topScorer.value} ({topScorer.count})</strong></span>}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* === SPECIALS VIEW === Live tracker (new) — card-per-category with real
          actual leaders from /api/tournament-stats + per-bettor on-track badges */}
      {view === "specials" && (
        <SpecialTrackerView
          specialBets={fSpecialBets}
          advancements={fAdvancements}
          currentUserId={currentUserId}
        />
      )}


      {/* === GROUPS VIEW === */}
      {view === "groups" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {["A","B","C","D","E","F","G","H","I","J","K","L"].map(groupId => (
            <div key={groupId} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-3 py-2 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
                <h3 className="text-sm font-bold text-gray-800">בית {groupId}</h3>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-gray-400 font-semibold border-b border-gray-100">
                    <th className="py-1.5 px-2 text-start">מהמר</th>
                    <th className="py-1.5 px-2 text-center">1</th>
                    <th className="py-1.5 px-2 text-center">2</th>
                  </tr>
                </thead>
                <tbody>
                  {fBettors.map(b => {
                    const picks = b.groups[groupId as keyof typeof b.groups];
                    if (!picks) return null;
                    return (
                      <tr key={b.name} className={`border-t border-gray-50 ${b.isYou ? "bg-blue-50/40" : ""}`}>
                        <td className="py-1.5 px-2 font-bold text-gray-800 truncate max-w-[4rem]">{b.name}</td>
                        <td className={`py-1.5 px-2 text-center ${getValueColor(picks[0], groupColors)}`}>{F[picks[0]]} {picks[0]}</td>
                        <td className={`py-1.5 px-2 text-center ${getValueColor(picks[1], groupColors)}`}>{F[picks[1]]} {picks[1]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* === WHATIF === placeholder with link to /live for the full widget === */}
      {view === "whatif" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-8 text-center">
          <span className="text-4xl mb-3 block">🔮</span>
          <h3 className="text-lg font-bold text-gray-900 mb-2">מה אם...?</h3>
          <p className="text-sm text-gray-500 mb-4">
            תציבו תוצאה לכל משחק ותראו איזה מהמר מקבל הכי הרבה נקודות מהתרחיש הזה.
            הווידג׳ט המלא יהיה זמין כשהטורניר יתחיל — בינתיים אפשר לעקוב אחרי עץ
            הגביע הלייב.
          </p>
          <Link href="/live" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors">
            🌳 צפו בעץ הגביע הלייב ←
          </Link>
        </div>
      )}

      {/* === ALIVE === "Who is still alive" — derived from bettors' advancement picks === */}
      {view === "alive" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
            <h3 className="text-lg font-bold text-gray-900">מי עוד חי אצל כל מהמר?</h3>
            <p className="text-xs text-gray-500 mt-0.5">הנבחרות שכל מהמר ניחש שיעלו — כמה עדיין בטורניר וכמה יצאו</p>
          </div>
          <div className="p-4">
            <WhosAliveFromAdvancements advancements={fAdvancements} brackets={fBrackets} specialBets={specialBets} />
          </div>
        </div>
      )}

      {/* === SIM === placeholder with link to /live === */}
      {view === "sim" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-8 text-center">
          <span className="text-4xl mb-3 block">🎮</span>
          <h3 className="text-lg font-bold text-gray-900 mb-2">סימולציה</h3>
          <p className="text-sm text-gray-500 mb-4">
            סמלצו תוצאות של המשחקים הקרובים וראו את תזוזת הטבלה לפי המהמרים. הכלי
            יופיע ברגע שהטורניר יתחיל והיו נתוני משחקים זמינים.
          </p>
          <Link href="/live" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors">
            ⚽ צפו במשחקים הקרובים ←
          </Link>
        </div>
      )}

      {/* === HEATMAP VIEW === */}
      {view === "heatmap" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h3 className="text-lg font-bold text-gray-900">מפת חום — דיוק בניחושי התוצאות</h3>
            <p className="text-sm text-gray-500">אחוז הפגיעות (טוטו/מדויקת) של כל מהמר בכל בית, לפי המשחקים שנגמרו. המספר בכותרת (למשל 2/6) הוא כמה משחקים כבר הסתיימו בבית.</p>
          </div>
          {heatmapData.length > 0 ? (
            <div className="p-4">
              <PredictionHeatmap data={heatmapData} groupCounts={groupMatchCounts} />
            </div>
          ) : (
            <div className="p-8 text-center">
              <span className="text-4xl mb-3 block">📊</span>
              <p className="text-sm text-gray-500 font-bold">עוד אין משחקים שנגמרו</p>
              <p className="text-xs text-gray-400 mt-1">המפה תתמלא ככל שמשחקי הבתים יסתיימו</p>
            </div>
          )}
        </div>
      )}
      </>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results view — per-day TABLE: rows = bettors, columns = matches of that day
// Each cell: bettor's prediction + icon. Points column = sum of 3/2/0 pts.
// Compact, scannable, shows "who picked what" side by side.
// ---------------------------------------------------------------------------

interface ResultsViewProps {
  matches: FinishedMatch[];
  brackets: { userId: string; displayName: string; groupPredictions: Record<string, { order: number[]; scores: { home: number | null; away: number | null }[] }>; knockoutTree: Record<string, { score1: number | null; score2: number | null; winner: string | null }>; knockoutTreeLive: Record<string, { score1: number | null; score2: number | null; winner: string | null }>; champion: string | null; lockedAt: string | null }[];
  currentUserId: string | null;
  loading: boolean;
}

function ResultsView({ matches, brackets, currentUserId, loading }: ResultsViewProps) {
  const scoring = useScoring();
  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
        <div className="inline-block w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin mb-2" />
        <p className="text-sm text-gray-500">טוען תוצאות...</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
        <span className="text-4xl mb-3 block">📋</span>
        <p className="text-sm text-gray-600 font-bold mb-1">עדיין אין תוצאות להצגה</p>
        <p className="text-xs text-gray-400">
          ברגע שמנהל יזין תוצאה של משחק (או שסינכרון אוטומטי יביא תוצאה חיה),
          תראו פה את כל המשחקים שהסתיימו ומי תפס את התוצאה.
        </p>
      </div>
    );
  }

  // Group matches by Israel date label; within each day sort matches by time asc.
  const byDate: Record<string, FinishedMatch[]> = {};
  for (const m of matches) {
    const d = new Date(m.date);
    const key = d.toLocaleDateString("he-IL", { weekday: "long", day: "2-digit", month: "long" });
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(m);
  }
  for (const key of Object.keys(byDate)) {
    byDate[key].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 md:space-y-0 md:grid md:grid-cols-2 md:gap-4 md:items-start">
      {Object.entries(byDate).map(([dateLabel, dayMatches]) => (
        <DayTable
          key={dateLabel}
          dateLabel={dateLabel}
          matches={dayMatches}
          brackets={brackets}
          currentUserId={currentUserId}
        />
      ))}
      <p className="md:col-span-2 text-center text-[11px] text-gray-400 pt-1">
        🎯 תוצאה מדויקת ({scoring.toto.GROUP + scoring.exact.GROUP} נק׳) · ✓ טוטו 1X2 ({scoring.toto.GROUP} נק׳) · ✗ פספוס (0)
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WhosAliveFromAdvancements
// Wraps the existing WhosAlive component, building its props from each
// bettor's advancement picks. Diffs every pick against the teams actually
// eliminated from the real bracket, so a knocked-out pick (incl. the champion)
// reads dead rather than everyone showing fully alive.
// ---------------------------------------------------------------------------

function WhosAliveFromAdvancements({
  advancements,
  brackets,
  specialBets,
}: {
  advancements: BettorAdvancement[];
  brackets: BettorBracket[];
  specialBets: BettorSpecialBets[];
}) {
  const { eliminated, tree } = useEliminatedTeams();
  const scoring = useScoring();
  const { actuals, playerStats } = useLiveSpecials();

  // KO match-points: only what's still CATCHABLE — the set-but-unplayed matchups
  // (c.open), which everyone can bet, so it's identical for every bettor. Points
  // already CAUGHT on played matches are banked in the total/leaderboard, not
  // here ("alive" is about what you can still grab, not what you already have).
  const koByUser = useMemo(() => {
    const m: Record<string, { alive: number; pot: number }> = {};
    if (tree) for (const br of brackets) {
      const c = computeKnockoutCeiling(br, tree, scoring);
      m[br.userId] = { alive: c.open, pot: c.open };
    }
    return m;
  }, [brackets, tree, scoring]);

  // Special-bet points: alive = currently on track (tentative + final); pot =
  // the full value of the categories they picked (max if every one came true).
  const specByUser = useMemo(() => {
    const sp = scoring.specials;
    const potOf = (sb: BettorSpecialBets): number =>
      (sb.topScorerPlayer ? sp.top_scorer_exact : 0) +
      (sb.topAssistsPlayer ? sp.top_assists_exact : 0) +
      (sb.bestAttackTeam ? sp.best_attack : 0) +
      (sb.prolificGroup ? sp.prolific_group : 0) +
      (sb.driestGroup ? sp.driest_group : 0) +
      (sb.dirtiestTeam ? sp.dirtiest_team : 0) +
      (sb.penaltiesOverUnder ? sp.penalties_over_under : 0) +
      (sb.matchupPick || "").split(",").filter(Boolean).length * sp.matchup;
    const m: Record<string, { alive: number; pot: number }> = {};
    const pool = computeSpecialBetsPool(specialBets, actuals, playerStats, scoring);
    for (const sb of specialBets) {
      m[sb.userId] = {
        alive: scoreSpecialBetsForUser(sb, actuals, playerStats, scoring, pool.relative).total,
        pot: potOf(sb),
      };
    }
    return m;
  }, [specialBets, actuals, playerStats, scoring]);

  const bettors = useMemo(
    () =>
      advancements.map((a) => ({
        name: a.displayName || "ללא שם",
        champion: a.winner,
        r16: a.advanceToR16,
        qf: a.advanceToQF,
        sf: a.advanceToSF,
        final: a.advanceToFinal,
        koPoints: koByUser[a.userId]?.alive ?? 0,
        koPot: koByUser[a.userId]?.pot ?? 0,
        specialPoints: specByUser[a.userId]?.alive ?? 0,
        specialPot: specByUser[a.userId]?.pot ?? 0,
      })),
    [advancements, koByUser, specByUser],
  );

  if (bettors.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-6 text-center">
        אין עדיין מהמרים עם הימורי עולות. ההימורים ייחשפו אחרי הנעילה.
      </p>
    );
  }
  return <WhosAlive bettors={bettors} eliminated={eliminated} tree={tree} weights={scoring.advancement} />;
}

// ---------------------------------------------------------------------------
// Shared transposed-table component (bettors as columns, bets as rows)
// Used by both the advancement and specials tabs so they look identical.
// ---------------------------------------------------------------------------

interface TransposedRow {
  label: string;
  render: (b: Bettor) => { val: string; node: React.ReactNode };
  highlight?: boolean;
  /** Stage group — a tinted divider row is rendered whenever it changes. */
  section?: "winner" | "final" | "semi" | "quarter" | "r16";
}

/** Stage titles for the advancement table. The divider design is NEUTRAL
 *  (uniform dark-gray band) — colored bands competed with the pick colors
 *  in the cells and read as data instead of structure. */
const SECTION_META: Record<NonNullable<TransposedRow["section"]>, { title: string }> = {
  winner:  { title: "🏆 הזוכה" },
  final:   { title: "עולות לגמר" },
  semi:    { title: "חצי גמר" },
  quarter: { title: "רבע גמר" },
  r16:     { title: "עולות לשמינית הגמר" },
};

function TransposedBetTable({
  bettors,
  rows,
  colorMap,
  highlightTeam = "",
}: {
  bettors: Bettor[];
  rows: TransposedRow[];
  colorMap: Record<string, string>;
  /** When set, cells matching this team code are ringed and the rest dimmed. */
  highlightTeam?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr
            className="bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50 text-xs font-bold text-gray-600"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            <th className="py-3 px-3 text-start sticky start-0 bg-white z-10 border-e border-gray-100 min-w-[7rem] w-[7rem]">
              הימור
            </th>
            {bettors.map((b) => (
              <th
                key={b.name}
                className={`py-3 px-2 text-center whitespace-nowrap min-w-[5.5rem] w-[5.5rem] border-e border-gray-100 last:border-e-0 ${
                  b.isYou ? "bg-blue-50/60" : ""
                }`}
              >
                <div className="font-bold text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>
                  {b.name}
                </div>
                {b.isYou && (
                  <div className="mt-0.5 inline-block text-[9px] text-blue-600 bg-blue-100 rounded px-1">
                    אתה
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <Fragment key={row.label}>
              {/* Stage divider — uniform neutral band when a new section starts */}
              {row.section && rows[rowIdx - 1]?.section !== row.section && (
                <tr>
                  <td
                    colSpan={bettors.length + 1}
                    className="py-1.5 px-3 text-[10px] font-black tracking-wider bg-gray-700 text-white"
                  >
                    {SECTION_META[row.section].title}
                  </td>
                </tr>
              )}
            <tr
              className={`border-t border-gray-100 ${rowIdx % 2 ? "bg-gray-50/40" : ""}`}
            >
              <th
                scope="row"
                className="py-1.5 px-3 text-start font-bold text-[11px] sticky start-0 z-10 border-e border-gray-100 whitespace-nowrap bg-white text-gray-600"
              >
                {row.label}
              </th>
              {bettors.map((b) => {
                const { val, node } = row.render(b);
                const isHit = highlightTeam !== "" && val === highlightTeam;
                const isDim = highlightTeam !== "" && val !== highlightTeam;
                return (
                  <td
                    key={b.name}
                    className={`py-1.5 px-2 text-center text-xs border-e border-gray-100 last:border-e-0 ${getValueColor(val, colorMap)} ${
                      b.isYou ? "ring-1 ring-inset ring-blue-200" : ""
                    } ${isHit ? "ring-2 ring-inset ring-amber-500 font-black" : ""} ${isDim ? "opacity-25" : ""}`}
                  >
                    {node}
                  </td>
                );
              })}
            </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayTable({
  dateLabel,
  matches,
  brackets,
  currentUserId,
  defaultOpenMatchId = null,
}: {
  dateLabel: string;
  matches: FinishedMatch[];
  brackets: ResultsViewProps["brackets"];
  currentUserId: string | null;
  /** The single match (across all days) that starts expanded. */
  defaultOpenMatchId?: number | null;
}) {
  // This view is group-stage only (see the GROUP_STAGE filter upstream), so a
  // "bol" (exact hit) is worth the toto points plus the exact bonus.
  const scoring = useScoring();
  const TOTO_PTS = scoring.toto.GROUP;
  const EXACT_PTS = scoring.toto.GROUP + scoring.exact.GROUP;

  // Collapsible matches — everything starts closed except the most recent one.
  const [openIds, setOpenIds] = useState<Set<number>>(
    () => new Set(defaultOpenMatchId != null && matches.some((m) => m.id === defaultOpenMatchId) ? [defaultOpenMatchId] : [])
  );
  const toggleMatch = (id: number) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const matchHits = useMemo(() =>
    matches.map((m) => ({ match: m, hits: computeGroupHits(m, brackets) })),
    [matches, brackets]
  );

  const allBettors = useMemo(() => {
    const seen = new Map<string, string>();
    for (const b of brackets) seen.set(b.userId, b.displayName || "ללא שם");
    for (const { hits } of matchHits) {
      for (const h of hits) if (!seen.has(h.userId)) seen.set(h.userId, h.name);
    }
    return Array.from(seen.entries()).map(([userId, name]) => ({ userId, name }));
  }, [brackets, matchHits]);

  type Row = {
    userId: string;
    name: string;
    cells: Array<{ pred: { home: number | null; away: number | null }; hit: BettorHit["hit"] }>;
    points: number;
    exacts: number;
    totos: number;
  };

  const rows: Row[] = useMemo(() => {
    const byUser: Record<string, Row> = {};
    for (const { userId, name } of allBettors) {
      byUser[userId] = {
        userId,
        name,
        cells: matches.map(() => ({ pred: { home: null, away: null }, hit: "empty" })),
        points: 0,
        exacts: 0,
        totos: 0,
      };
    }
    matchHits.forEach(({ hits }, matchIdx) => {
      for (const h of hits) {
        const row = byUser[h.userId];
        if (!row) continue;
        row.cells[matchIdx] = { pred: h.pred, hit: h.hit };
        if (h.hit === "exact") { row.points += EXACT_PTS; row.exacts += 1; }
        else if (h.hit === "toto") { row.points += TOTO_PTS; row.totos += 1; }
      }
    });
    return Object.values(byUser).sort(
      (a, b) => b.points - a.points || b.exacts - a.exacts || a.name.localeCompare(b.name, "he")
    );
  }, [allBettors, matches, matchHits, TOTO_PTS, EXACT_PTS]);

  const perMatchCounts = matchHits.map(({ hits }) => hitCounts(hits));
  // Tie-aware day leader: only crown when a single bettor tops the day.
  const topPoints = rows.length > 0 ? rows[0].points : 0;
  const tiedAtTop = topPoints > 0 ? rows.filter((r) => r.points === topPoints) : [];
  const hasSoloLeader = tiedAtTop.length === 1;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
      {/* Day header — quiet: date + facts in one muted line */}
      <div className="border-b border-gray-200 px-5 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-base font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>{dateLabel}</h3>
          <p className="text-xs text-gray-500">
            {matches.length} משחקים
            {tiedAtTop.length === 1 && <> · מוביל היום: <span className="font-bold text-gray-900">{tiedAtTop[0].name}</span></>}
            {tiedAtTop.length > 1 && <> · מובילים: <span className="font-bold text-gray-900">{tiedAtTop.slice(0, 3).map((r) => r.name).join(", ")}{tiedAtTop.length > 3 ? ` +${tiedAtTop.length - 3}` : ""}</span></>}
          </p>
        </div>
      </div>

      {/* Unified collapsible match list (all breakpoints). Finished matches
          are collapsed by default; only the most recent one (defaultOpenMatchId,
          chosen across all days) starts open. */}
      <div className="divide-y divide-gray-100">
        {matches.map((m, mi) => {
          const mHits = matchHits[mi].hits;
          const c = perMatchCounts[mi];
          const isOpen = openIds.has(m.id);
          const time = new Date(m.date).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
          const hitRank: Record<BettorHit["hit"], number> = { exact: 0, toto: 1, miss: 2, empty: 3 };
          const sortedHits = [...mHits].sort(
            (a, b) => hitRank[a.hit] - hitRank[b.hit] || a.name.localeCompare(b.name, "he")
          );
          return (
            <div key={m.id}>
              <button
                onClick={() => toggleMatch(m.id)}
                className={`w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 text-start transition-colors ${
                  isOpen ? "bg-blue-50/40" : "hover:bg-gray-50/70"
                }`}
              >
                {/* Home (right in RTL) */}
                <span className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                  <span className="text-[13px] font-bold text-gray-900 truncate" style={{ fontFamily: "var(--font-secular)" }}>
                    {getTeamNameHe(m.homeTla) || m.homeTla}
                  </span>
                  <span className="text-xl shrink-0">{getFlag(m.homeTla)}</span>
                </span>
                {/* Score — home goals = right-hand digit (RTL) */}
                <span dir="ltr" className="text-sm font-black tabular-nums bg-white rounded-md border-2 border-gray-200 px-2 py-0.5 shrink-0" style={{ fontFamily: "var(--font-inter)" }}>
                  {m.awayGoals}-{m.homeGoals}
                </span>
                {/* Away */}
                <span className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-xl shrink-0">{getFlag(m.awayTla)}</span>
                  <span className="text-[13px] font-bold text-gray-900 truncate" style={{ fontFamily: "var(--font-secular)" }}>
                    {getTeamNameHe(m.awayTla) || m.awayTla}
                  </span>
                </span>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  className={`shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {isOpen && (
                <div className="px-3 sm:px-5 pb-3">
                  <p className="text-[11px] text-gray-400 mb-1.5">
                    בית {m.group} · {time}
                    <span className="mx-1.5 text-gray-200">|</span>
                    <span className="text-green-700 font-bold">🎯 {c.exact}</span>
                    <span className="mx-1 text-gray-600 font-bold">✓ {c.toto}</span>
                    <span className="font-bold">✗ {c.miss}</span>
                  </p>
                  <div className="rounded-lg border border-gray-100 overflow-hidden sm:columns-2 md:columns-1 sm:gap-0 [column-fill:balance]">
                    {sortedHits.map((h) => {
                      const you = h.userId === currentUserId;
                      let icon = "·";
                      let iconColor = "text-gray-300";
                      let delta = 0;
                      if (h.hit === "exact") { icon = "🎯"; iconColor = "text-green-600"; delta = EXACT_PTS; }
                      else if (h.hit === "toto") { icon = "✓"; iconColor = "text-green-600"; delta = TOTO_PTS; }
                      else if (h.hit === "miss") { icon = "✗"; iconColor = "text-gray-400"; }
                      return (
                        <div
                          key={h.userId}
                          className={`flex items-center justify-between gap-2 px-3 py-1.5 border-b border-gray-50 break-inside-avoid ${you ? "bg-blue-50/50" : "bg-white"}`}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className={`w-4 text-center text-[12px] font-bold shrink-0 ${iconColor}`}>{icon}</span>
                            <span className={`text-[13px] truncate ${h.hit === "exact" ? "font-bold text-gray-900" : "text-gray-700"}`} style={{ fontFamily: "var(--font-secular)" }}>
                              {h.name}
                            </span>
                            {you && <span className="text-[9px] text-blue-600 font-bold shrink-0">אתה</span>}
                          </span>
                          <span className="flex items-center gap-2 shrink-0 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
                            {h.hit === "empty" ? (
                              <span className="text-[11px] text-gray-300">לא הימר/ה</span>
                            ) : (
                              <>
                                {/* Same away-home glyph order as the result chip above */}
                                <span dir="ltr" className={`text-[13px] font-bold ${h.hit === "miss" ? "text-gray-400" : "text-gray-900"}`}>
                                  {h.pred.away}-{h.pred.home}
                                </span>
                                <span className={`text-[11px] font-bold w-6 text-start ${delta > 0 ? "text-green-700" : "text-gray-300"}`}>
                                  {delta > 0 ? `+${delta}` : "0"}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Day totals — quiet ranked line */}
      <div className="px-5 py-2.5 bg-gray-50/60 border-t border-gray-100">
        <p className="text-xs text-gray-500 leading-relaxed">
          <span className="font-bold text-gray-700">סה״כ היום:</span>{" "}
          {rows.filter(r => r.points > 0).map((r, i) => {
            const isTopTied = r.points === topPoints && topPoints > 0;
            return (
              <span key={r.userId}>
                {i > 0 && " · "}
                <span className={isTopTied ? "font-bold text-gray-900" : ""}>
                  {r.name} <span className="tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{r.points}</span>
                </span>
              </span>
            );
          })}
          {rows.every(r => r.points === 0) && "אף מהמר עוד לא צבר נקודות"}
        </p>
      </div>
    </div>
  );
}
