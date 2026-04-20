"use client";

import { useState, useMemo, useEffect } from "react";
import { PredictionHeatmap } from "@/components/shared/PredictionHeatmap";
import { useSharedData } from "@/hooks/useSharedData";
import { GROUPS } from "@/lib/tournament/groups";
import { MATCHUPS } from "@/lib/matchups";
import { computeGroupHits, hitCounts, normalizeGroupLetter, type BettorHit, type FinishedMatch } from "@/lib/results-hits";
import { getFlag, getTeamNameHe } from "@/lib/flags";
import { SpecialTrackerView } from "./SpecialTrackerView";

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
  name: string;
  winner: string;
  finalist1: string;
  finalist2: string;
  sf: string[];
  qf: string[];
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


const F: Record<string,string> = {
  ARG:"🇦🇷",BRA:"🇧🇷",FRA:"🇫🇷",ENG:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",ESP:"🇪🇸",GER:"🇩🇪",POR:"🇵🇹",NED:"🇳🇱",
  ITA:"🇮🇹",BEL:"🇧🇪",CRO:"🇭🇷",URU:"🇺🇾",JPN:"🇯🇵",KOR:"🇰🇷",MAR:"🇲🇦",SEN:"🇸🇳",
  USA:"🇺🇸",MEX:"🇲🇽",COL:"🇨🇴",CAN:"🇨🇦",PER:"🇵🇪",UZB:"🇺🇿",HON:"🇭🇳",CMR:"🇨🇲",
  KSA:"🇸🇦",DEN:"🇩🇰",
};

type View = "results" | "advancement" | "specials" | "groups" | "whatif" | "alive" | "sim" | "heatmap";

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
  const [view, setView] = useState<View>("results");

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

      // Determine finalist pair: champion + the other finalist
      const finalist1 = champion;
      const finalist2 = advToFinal.find((t) => t !== champion) || advToFinal[0] || "";

      // Semi-finalists: those in advanceToSF (or advanceToFinal as fallback)
      const sf = advToSF.length > 0 ? advToSF.slice(0, 4) : advToFinal.slice(0, 4);

      // Quarter-finalists
      const qf = advToQF.length > 0 ? advToQF.slice(0, 8) : [];

      return {
        name: bracket.displayName,
        winner: champion,
        finalist1,
        finalist2,
        sf,
        qf,
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

  // Build color maps for each category
  const advColors = useMemo(() => buildColorMap([
    ...BETTORS.map(b=>b.winner), ...BETTORS.flatMap(b=>[b.finalist1,b.finalist2]),
    ...BETTORS.flatMap(b=>b.sf), ...BETTORS.flatMap(b=>b.qf),
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
  // DEMO MODE: using demo date. Real deadline (main): 2026-06-10T14:00:00Z
  const LOCK_DEADLINE = new Date("2026-04-18T17:00:00Z");
  const isLocked = new Date() >= LOCK_DEADLINE;

  return (
    <div className="max-w-full mx-auto px-4 py-6 pb-24">
      <div className="mb-5">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>השוואת הימורים</h1>
        <p className="text-base text-gray-600 mt-1">
          {isLocked ? "ראו מה כל מהמר בחר — השוואה מלאה" : "ההימורים ייחשפו אחרי הנעילה ב-18.04.2026 (דמו)"}
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
          { key: "results" as View, label: "תוצאות ותפיסות" },
          { key: "advancement" as View, label: "עולות + זוכה" },
          { key: "specials" as View, label: "הימורים מיוחדים" },
          { key: "groups" as View, label: "עולות מהבתים" },
          { key: "whatif" as View, label: "מה אם...?" },
          { key: "alive" as View, label: "מי חי?" },
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

      {isLocked && !loading && BETTORS.length > 0 && <>
      {/* === RESULTS VIEW === per-match who-hit-what */}
      {view === "results" && (
        <ResultsView
          matches={finishedGroupMatches}
          brackets={brackets}
          currentUserId={currentUserId}
          loading={loadingMatches}
        />
      )}

      {/* === ADVANCEMENT VIEW === transposed: bettors as columns, bet rows */}
      {view === "advancement" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <TransposedBetTable
            bettors={BETTORS}
            colorMap={advColors}
            rows={[
              { label: "זוכה", render: (b) => ({ val: b.winner, node: <span className="font-bold text-amber-700">{F[b.winner]} {b.winner}</span> }), highlight: true },
              { label: "גמר 1", render: (b) => ({ val: b.finalist1, node: <span className="text-gray-700">{F[b.finalist1]} {b.finalist1}</span> }) },
              { label: "גמר 2", render: (b) => ({ val: b.finalist2, node: <span className="text-gray-700">{F[b.finalist2]} {b.finalist2}</span> }) },
              ...[0, 1, 2, 3].map((i) => ({ label: `חצי ${i + 1}`, render: (b: Bettor) => ({ val: b.sf[i] || "", node: <span className="text-gray-700">{F[b.sf[i]]} {b.sf[i]}</span> }) })),
              ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ label: `רבע ${i + 1}`, render: (b: Bettor) => ({ val: b.qf[i] || "", node: <span className="text-gray-700">{F[b.qf[i]]} {b.qf[i]}</span> }) })),
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
            const topWinner = topPick(BETTORS.map(b => b.winner));
            const topFinalist = topPick(BETTORS.flatMap(b => [b.finalist1, b.finalist2]));
            const topScorer = topPick(BETTORS.map(b => b.topScorer));
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
          specialBets={specialBets}
          advancements={advancements}
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
                  {BETTORS.map(b => {
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

      {/* === WHATIF === placeholder (was on /live, moved here) === */}
      {view === "whatif" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-8 text-center">
          <span className="text-4xl mb-3 block">🔮</span>
          <h3 className="text-lg font-bold text-gray-900 mb-2">מה אם...?</h3>
          <p className="text-sm text-gray-500">זמין ברגע שהטורניר יתחיל — תוכלו לבדוק איך תוצאות משפיעות על הניקוד.</p>
        </div>
      )}

      {/* === ALIVE === placeholder (was on /live, moved here) === */}
      {view === "alive" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-8 text-center">
          <span className="text-4xl mb-3 block">🌳</span>
          <h3 className="text-lg font-bold text-gray-900 mb-2">מי חי?</h3>
          <p className="text-sm text-gray-500">עץ ההדחה של כל מהמר — זמין כשהטורניר יתחיל.</p>
        </div>
      )}

      {/* === SIM === placeholder (was on /live, moved here) === */}
      {view === "sim" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-8 text-center">
          <span className="text-4xl mb-3 block">🎮</span>
          <h3 className="text-lg font-bold text-gray-900 mb-2">סימולציה</h3>
          <p className="text-sm text-gray-500">תוכלו לסמלץ תוצאות ולראות מי מנצח — זמין כשהטורניר יתחיל.</p>
        </div>
      )}

      {/* === HEATMAP VIEW === */}
      {view === "heatmap" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="px-5 py-4 bg-gradient-to-l from-white via-amber-50/30 to-orange-50/40 border-b border-amber-100/50">
            <h3 className="text-lg font-bold text-gray-900">מפת חום — דיוק בבתים</h3>
            <p className="text-sm text-gray-500">כמה כל מהמר צדק בניחושי העולות מכל בית</p>
          </div>
          <div className="p-8 text-center">
            <span className="text-4xl mb-3 block">📊</span>
            <p className="text-sm text-gray-500 font-bold">מפת החום תהיה זמינה אחרי תחילת הטורניר</p>
            <p className="text-xs text-gray-400 mt-1">כאן תוכלו לראות כמה כל מהמר צדק בניחושים לכל בית</p>
          </div>
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
  brackets: { userId: string; displayName: string; groupPredictions: Record<string, { order: number[]; scores: { home: number | null; away: number | null }[] }>; knockoutTree: Record<string, { score1: number | null; score2: number | null; winner: string | null }>; champion: string | null; lockedAt: string | null }[];
  currentUserId: string | null;
  loading: boolean;
}

const EXACT_PTS = 3; // bol
const TOTO_PTS = 2;  // 1X2 only

function ResultsView({ matches, brackets, currentUserId, loading }: ResultsViewProps) {
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
    <div className="space-y-8">
      {Object.entries(byDate).map(([dateLabel, dayMatches]) => (
        <DayTable
          key={dateLabel}
          dateLabel={dateLabel}
          matches={dayMatches}
          brackets={brackets}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared transposed-table component (bettors as columns, bets as rows)
// Used by both the advancement and specials tabs so they look identical.
// ---------------------------------------------------------------------------

interface TransposedRow {
  label: string;
  render: (b: Bettor) => { val: string; node: React.ReactNode };
  highlight?: boolean;
}

function TransposedBetTable({
  bettors,
  rows,
  colorMap,
}: {
  bettors: Bettor[];
  rows: TransposedRow[];
  colorMap: Record<string, string>;
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
            <tr
              key={row.label}
              className={`border-t border-gray-100 ${
                row.highlight ? "bg-amber-50/40" : rowIdx % 2 ? "bg-gray-50/40" : ""
              }`}
            >
              <th
                scope="row"
                className={`py-1.5 px-3 text-start font-bold text-[11px] sticky start-0 z-10 border-e border-gray-100 whitespace-nowrap ${
                  row.highlight ? "bg-amber-50/90 text-amber-900" : "bg-white text-gray-700"
                }`}
              >
                {row.label}
              </th>
              {bettors.map((b) => {
                const { val, node } = row.render(b);
                return (
                  <td
                    key={b.name}
                    className={`py-1.5 px-2 text-center text-xs border-e border-gray-100 last:border-e-0 ${getValueColor(val, colorMap)} ${
                      b.isYou ? "ring-1 ring-inset ring-blue-200" : ""
                    }`}
                  >
                    {node}
                  </td>
                );
              })}
            </tr>
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
}: {
  dateLabel: string;
  matches: FinishedMatch[];
  brackets: ResultsViewProps["brackets"];
  currentUserId: string | null;
}) {
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
  }, [allBettors, matches, matchHits]);

  const perMatchCounts = matchHits.map(({ hits }) => hitCounts(hits));
  // Tie-aware day leader: only crown when a single bettor tops the day.
  const topPoints = rows.length > 0 ? rows[0].points : 0;
  const tiedAtTop = topPoints > 0 ? rows.filter((r) => r.points === topPoints) : [];
  const hasSoloLeader = tiedAtTop.length === 1;
  const totalBols = rows.reduce((s, r) => s + r.exacts, 0);
  const totalTotos = rows.reduce((s, r) => s + r.totos, 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
      {/* Day header with gradient, matching the rest of the site */}
      <div className="bg-gradient-to-l from-indigo-50/60 via-blue-50/40 to-white border-b border-blue-100/50 px-5 py-3.5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
            </span>
            <h3 className="text-base font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>{dateLabel}</h3>
            <span className="text-xs font-medium text-gray-500">· {matches.length} משחקים נגמרו</span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            {totalBols > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 font-bold">
                🎯 {totalBols} תוצאות מדויקות
              </span>
            )}
            {totalTotos > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 font-bold">
                ✓ {totalTotos} טוטו
              </span>
            )}
            {tiedAtTop.length === 1 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2.5 py-0.5 font-bold shadow-sm">
                👑 {tiedAtTop[0].name} · {tiedAtTop[0].points} נק׳
              </span>
            ) : tiedAtTop.length > 1 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-2.5 py-0.5 font-bold shadow-sm">
                🤝 תיקו · {tiedAtTop.slice(0, 3).map((r) => r.name).join(" · ")}{tiedAtTop.length > 3 ? ` +${tiedAtTop.length - 3}` : ""} · {topPoints} נק׳
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* Mobile: card-per-match layout (<md) */}
      <div className="md:hidden divide-y divide-gray-100">
        {matches.map((m, mi) => {
          const mHits = matchHits[mi].hits;
          const time = new Date(m.date).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
          return (
            <div key={m.id} className="px-3 py-3">
              {/* Single-line match header: meta (group + time) inline with teams + score */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {/* Team1 name + flag (RTL start) */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end text-end">
                  <span className="text-[13px] font-bold text-gray-900 truncate" style={{ fontFamily: "var(--font-secular)" }}>
                    {getTeamNameHe(m.homeTla)}
                  </span>
                  <span className="text-xl shrink-0">{getFlag(m.homeTla)}</span>
                </div>
                <span className="text-sm font-black tabular-nums bg-white rounded-md border-2 border-gray-200 px-2 py-0.5 shrink-0" style={{ fontFamily: "var(--font-inter)" }}>
                  {m.homeGoals}-{m.awayGoals}
                </span>
                {/* Team2 flag + name */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-xl shrink-0">{getFlag(m.awayTla)}</span>
                  <span className="text-[13px] font-bold text-gray-900 truncate" style={{ fontFamily: "var(--font-secular)" }}>
                    {getTeamNameHe(m.awayTla)}
                  </span>
                </div>
                {/* Meta chips (group + time) inline at the far end (RTL left) */}
                <div className="flex items-center gap-1 shrink-0 text-[10px] text-gray-500 font-medium">
                  <span className="bg-gray-100 rounded-md px-1.5 py-0.5 font-bold whitespace-nowrap">בית {m.group}</span>
                  <span className="tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{time}</span>
                </div>
              </div>
              <div className="space-y-1">
                {mHits.map((h) => {
                  const you = h.userId === currentUserId;
                  let badgeBg = "bg-gray-100 text-gray-300";
                  let bg = "bg-white";
                  let icon = "—";
                  let text = "text-gray-300";
                  let delta = 0;
                  if (h.hit === "exact") {
                    badgeBg = "bg-green-500 text-white"; bg = "bg-green-50"; icon = "🎯"; text = "text-green-900"; delta = EXACT_PTS;
                  } else if (h.hit === "toto") {
                    badgeBg = "bg-amber-500 text-white"; bg = "bg-amber-50"; icon = "✓"; text = "text-amber-900"; delta = TOTO_PTS;
                  } else if (h.hit === "miss") {
                    badgeBg = "bg-red-400 text-white"; bg = "bg-red-50/60"; icon = "✗"; text = "text-red-700";
                  }
                  return (
                    <div
                      key={h.userId}
                      className={`flex items-center justify-between px-3 py-1.5 rounded-lg border ${bg} ${you ? "border-blue-300 ring-1 ring-blue-200" : "border-gray-100"}`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold shrink-0 ${badgeBg}`}>
                          {icon}
                        </span>
                        <span className="text-sm font-bold text-gray-900 truncate" style={{ fontFamily: "var(--font-secular)" }}>
                          {h.name}
                        </span>
                        {you && <span className="text-[9px] bg-blue-100 text-blue-600 rounded px-1 font-bold">אתה</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {h.hit === "empty" ? (
                          <span className="text-[11px] text-gray-400">לא הימר/ה</span>
                        ) : (
                          <>
                            <span className={`text-sm font-black tabular-nums ${text}`} style={{ fontFamily: "var(--font-inter)" }}>
                              {h.pred.home}-{h.pred.away}
                            </span>
                            {delta > 0 && (
                              <span className="text-[11px] font-bold text-blue-700 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
                                +{delta}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {/* Mobile day totals */}
        <div className="px-4 py-3 bg-gradient-to-l from-blue-50/50 to-indigo-50/30">
          <p className="text-xs font-bold text-gray-700 mb-1.5">
            סה״כ היום
            {tiedAtTop.length > 1 && (
              <span className="ms-1 text-[10px] font-normal text-blue-700">· 🤝 תיקו בראש</span>
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {rows.filter(r => r.points > 0).map((r) => {
              const isYou = r.userId === currentUserId;
              const isTopTied = r.points === topPoints;
              const isSoloLeader = hasSoloLeader && isTopTied;
              return (
                <span key={r.userId} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  isSoloLeader ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white" :
                  isTopTied ? "bg-gradient-to-r from-blue-500/90 to-indigo-500/90 text-white" :
                  isYou ? "bg-blue-100 text-blue-700 border border-blue-200" :
                  "bg-white text-gray-700 border border-gray-200"
                }`}>
                  {isSoloLeader && <span>👑</span>}
                  {!isSoloLeader && isTopTied && <span>🤝</span>}
                  <span style={{ fontFamily: "var(--font-secular)" }}>{r.name}</span>
                  <span className="tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>· {r.points}</span>
                </span>
              );
            })}
            {rows.every(r => r.points === 0) && <span className="text-xs text-gray-500">אף מהמר עוד לא צבר נקודות</span>}
          </div>
        </div>
      </div>

      {/* Desktop: full table (≥md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-l from-white to-gray-50/50 border-b border-gray-200">
              <th className="py-3 px-3 text-start sticky start-0 bg-white z-10 border-e border-gray-100 min-w-[7rem]">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wide" style={{ fontFamily: "var(--font-inter)" }}>
                  מהמר
                </span>
              </th>
              {matches.map((m, i) => {
                const time = new Date(m.date).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
                const c = perMatchCounts[i];
                return (
                  <th key={m.id} className="py-2 px-2 text-center min-w-[12rem] border-e border-gray-100 last:border-e-0">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-medium">
                        <span className="bg-gray-100 rounded-md px-1.5 py-0.5 font-bold">בית {m.group}</span>
                        <span style={{ fontFamily: "var(--font-inter)" }}>{time}</span>
                      </div>
                      <div className="flex items-center gap-2" dir="ltr">
                        <div className="flex flex-col items-center gap-0.5 w-12">
                          <span className="text-3xl leading-none">{getFlag(m.homeTla)}</span>
                          <span
                            className="text-[11px] font-bold text-gray-800 text-center leading-tight"
                            style={{ fontFamily: "var(--font-secular)" }}
                            title={getTeamNameHe(m.homeTla) || m.homeTla}
                          >
                            {getTeamNameHe(m.homeTla) || m.homeTla}
                          </span>
                        </div>
                        <span
                          className="text-base font-black tabular-nums text-gray-900 bg-white rounded-lg border border-gray-200 px-2 py-0.5 shadow-sm"
                          style={{ fontFamily: "var(--font-inter)" }}
                        >
                          {m.homeGoals} - {m.awayGoals}
                        </span>
                        <div className="flex flex-col items-center gap-0.5 w-12">
                          <span className="text-3xl leading-none">{getFlag(m.awayTla)}</span>
                          <span
                            className="text-[11px] font-bold text-gray-800 text-center leading-tight"
                            style={{ fontFamily: "var(--font-secular)" }}
                            title={getTeamNameHe(m.awayTla) || m.awayTla}
                          >
                            {getTeamNameHe(m.awayTla) || m.awayTla}
                          </span>
                        </div>
                      </div>
                      {(c.exact + c.toto > 0) && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                          {c.exact > 0 && <span className="text-green-700 bg-green-50 rounded-full px-1.5 py-0.5 border border-green-200">🎯 {c.exact}</span>}
                          {c.toto > 0 && <span className="text-amber-700 bg-amber-50 rounded-full px-1.5 py-0.5 border border-amber-200">✓ {c.toto}</span>}
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="py-3 px-3 text-center bg-gradient-to-l from-blue-50 to-indigo-50 border-s border-blue-100 min-w-[5rem]">
                <span className="text-xs font-bold text-blue-700 uppercase tracking-wide" style={{ fontFamily: "var(--font-inter)" }}>
                  נק׳ היום
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => {
              const isYou = row.userId === currentUserId;
              // Crown only when there's a single outright leader for the day.
              const isLead = rowIdx === 0 && hasSoloLeader && row.points > 0;
              return (
                <tr
                  key={row.userId}
                  className={`border-t border-gray-100 transition-colors ${
                    isYou ? "bg-gradient-to-l from-blue-50/70 to-indigo-50/30" : "hover:bg-gray-50/60"
                  }`}
                >
                  <td
                    className={`py-2 px-2 font-bold sticky start-0 z-10 border-e border-gray-100 whitespace-nowrap ${
                      isYou ? "bg-blue-50/80" : "bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isLead && <span className="text-sm" title="מוביל יומי">👑</span>}
                      <span className="text-xs text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>
                        {row.name}
                      </span>
                      {isYou && (
                        <span className="text-[9px] font-bold bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5">
                          אתה
                        </span>
                      )}
                    </div>
                  </td>
                  {row.cells.map((cell, i) => {
                    let bg = "bg-white";
                    let text = "text-gray-300";
                    let badge = "";
                    let badgeBg = "";
                    if (cell.hit === "exact") {
                      bg = "bg-gradient-to-br from-green-50 to-emerald-50";
                      text = "text-green-900";
                      badge = "🎯";
                      badgeBg = "bg-green-500 text-white";
                    } else if (cell.hit === "toto") {
                      bg = "bg-gradient-to-br from-amber-50 to-yellow-50";
                      text = "text-amber-900";
                      badge = "✓";
                      badgeBg = "bg-amber-500 text-white";
                    } else if (cell.hit === "miss") {
                      bg = "bg-red-50/40";
                      text = "text-red-700";
                      badge = "✗";
                      badgeBg = "bg-red-400 text-white";
                    }
                    return (
                      <td
                        key={i}
                        className={`py-1.5 px-1.5 text-center border-e border-gray-100 last:border-e-0 ${bg}`}
                      >
                        {cell.hit === "empty" ? (
                          <span className="text-gray-300 text-[11px]">לא הימר/ה</span>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <span className={`font-black tabular-nums text-xs ${text}`} style={{ fontFamily: "var(--font-inter)" }}>
                              {cell.pred.home}-{cell.pred.away}
                            </span>
                            <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold ${badgeBg}`}>
                              {badge}
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="py-1.5 px-2 text-center bg-gradient-to-l from-blue-50/60 to-indigo-50/30 border-s border-blue-100">
                    <div className="inline-flex flex-col items-center">
                      <span
                        className={`text-base font-black tabular-nums ${row.points > 0 ? "text-blue-700" : "text-gray-300"}`}
                        style={{ fontFamily: "var(--font-inter)" }}
                      >
                        {row.points}
                      </span>
                      {(row.exacts + row.totos > 0) && (
                        <span className="text-[9px] font-bold text-gray-500">
                          {row.exacts > 0 && <span className="text-green-700">🎯{row.exacts}</span>}
                          {row.exacts > 0 && row.totos > 0 && " "}
                          {row.totos > 0 && <span className="text-amber-700">✓{row.totos}</span>}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2.5 bg-gray-50/50 border-t border-gray-100 flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-white text-[9px] font-bold">🎯</span>
          תוצאה מדויקת · <b className="text-gray-700">{EXACT_PTS} נק׳</b>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold">✓</span>
          טוטו (1X2) · <b className="text-gray-700">{TOTO_PTS} נק׳</b>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-400 text-white text-[9px] font-bold">✗</span>
          פספוס · 0
        </span>
      </div>
    </div>
  );
}
