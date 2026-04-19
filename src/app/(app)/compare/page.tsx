"use client";

import { useState, useMemo } from "react";
import { PredictionHeatmap } from "@/components/shared/PredictionHeatmap";
import { useSharedData } from "@/hooks/useSharedData";
import { GROUPS } from "@/lib/tournament/groups";

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

type View = "advancement" | "specials" | "groups" | "similarity" | "heatmap";

export default function ComparePage() {
  const [view, setView] = useState<View>("advancement");

  // Load real data from Supabase (after lock, uses server API to bypass RLS)
  const { brackets, specialBets, advancements, currentUserId, loading } = useSharedData();

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
          { key: "advancement" as View, label: "עולות + זוכה" },
          { key: "specials" as View, label: "הימורים מיוחדים" },
          { key: "groups" as View, label: "עולות מהבתים" },
          { key: "similarity" as View, label: "דמיון בין מהמרים" },
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
      {/* === ADVANCEMENT VIEW === */}
      {view === "advancement" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50 text-xs font-bold text-gray-600" style={{ fontFamily: "var(--font-inter)" }}>
                  <th className="py-3 px-2 text-start sticky start-0 bg-white z-10 border-e border-gray-100 w-16 max-w-[4rem]">מהמר</th>
                  <th className="py-3 px-2 text-center">זוכה</th>
                  <th className="py-3 px-2 text-center">גמר 1</th>
                  <th className="py-3 px-2 text-center">גמר 2</th>
                  <th className="py-3 px-2 text-center">חצי 1</th>
                  <th className="py-3 px-2 text-center">חצי 2</th>
                  <th className="py-3 px-2 text-center">חצי 3</th>
                  <th className="py-3 px-2 text-center">חצי 4</th>
                  <th className="py-3 px-2 text-center">רבע 1</th>
                  <th className="py-3 px-2 text-center">רבע 2</th>
                  <th className="py-3 px-2 text-center">רבע 3</th>
                  <th className="py-3 px-2 text-center">רבע 4</th>
                  <th className="py-3 px-2 text-center">רבע 5</th>
                  <th className="py-3 px-2 text-center">רבע 6</th>
                  <th className="py-3 px-2 text-center">רבע 7</th>
                  <th className="py-3 px-2 text-center">רבע 8</th>
                </tr>
              </thead>
              <tbody>
                {BETTORS.map(b => (
                  <tr key={b.name} className={`border-t border-gray-100 ${b.isYou ? "bg-blue-50/40" : "hover:bg-gray-50"}`}>
                    <td className="py-2 px-2 font-bold text-gray-900 sticky start-0 bg-inherit z-10 border-e border-gray-100 whitespace-nowrap w-16 max-w-[4rem] truncate text-xs">
                      {b.name} {b.isYou && <span className="text-[10px] text-blue-500 bg-blue-100 rounded px-1 ms-0.5">אתה</span>}
                    </td>
                    <td className={`py-2 px-2 text-center font-bold text-amber-700 text-xs ${getValueColor(b.winner, advColors)}`}>{F[b.winner]} {b.winner}</td>
                    <td className={`py-2 px-2 text-center text-xs ${getValueColor(b.finalist1, advColors)}`}>{F[b.finalist1]} {b.finalist1}</td>
                    <td className={`py-2 px-2 text-center text-xs ${getValueColor(b.finalist2, advColors)}`}>{F[b.finalist2]} {b.finalist2}</td>
                    {b.sf.map((t, i) => (
                      <td key={`sf${i}`} className={`py-2 px-2 text-center text-gray-600 text-xs ${getValueColor(t, advColors)}`}>{F[t]} {t}</td>
                    ))}
                    {b.qf.map((t, i) => (
                      <td key={`qf${i}`} className={`py-2 px-2 text-center text-gray-500 text-[10px] ${getValueColor(t, advColors)}`}>{F[t]} {t}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

      {/* === SPECIALS VIEW === */}
      {view === "specials" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50 text-xs font-bold text-gray-600" style={{ fontFamily: "var(--font-inter)" }}>
                  <th className="py-3 px-2 text-start sticky start-0 bg-white z-10 border-e border-gray-100 w-16 max-w-[4rem]">מהמר</th>
                  <th className="py-3 px-2 text-center">מלך שערים</th>
                  <th className="py-3 px-2 text-center">מלך בישולים</th>
                  <th className="py-3 px-2 text-center">התקפה</th>
                  <th className="py-3 px-2 text-center">כסחנית</th>
                  <th className="py-3 px-2 text-center">בית פורה</th>
                  <th className="py-3 px-2 text-center">בית יבש</th>
                  <th className="py-3 px-1 text-center text-[9px]">Mbappé<br/>vs Vinícius</th>
                  <th className="py-3 px-1 text-center text-[9px]">Bellingham<br/>vs Yamal</th>
                  <th className="py-3 px-1 text-center text-[9px]">Messi<br/>vs Ronaldo</th>
                  <th className="py-3 px-2 text-center">פנדלים</th>
                </tr>
              </thead>
              <tbody>
                {BETTORS.map(b => (
                  <tr key={b.name} className={`border-t border-gray-100 ${b.isYou ? "bg-blue-50/40" : "hover:bg-gray-50"}`}>
                    <td className="py-2 px-2 font-bold text-gray-900 sticky start-0 bg-inherit z-10 border-e border-gray-100 whitespace-nowrap w-16 max-w-[4rem] truncate text-xs">
                      {b.name} {b.isYou && <span className="text-[10px] text-blue-500 bg-blue-100 rounded px-1 ms-0.5">אתה</span>}
                    </td>
                    <td className={`py-2 px-2 text-center text-xs font-medium ${getValueColor(b.topScorer, specColors)}`}>{b.topScorer}</td>
                    <td className={`py-2 px-2 text-center text-xs font-medium ${getValueColor(b.topAssists, specColors)}`}>{b.topAssists}</td>
                    <td className={`py-2 px-2 text-center text-xs ${getValueColor(b.bestAttack, specColors)}`}>{F[b.bestAttack]} {b.bestAttack}</td>
                    <td className={`py-2 px-2 text-center text-xs ${getValueColor(b.dirtiestTeam, specColors)}`}>{F[b.dirtiestTeam]} {b.dirtiestTeam}</td>
                    <td className={`py-2 px-2 text-center text-xs ${getValueColor(b.prolificGroup, specColors)}`}>{b.prolificGroup}</td>
                    <td className={`py-2 px-2 text-center text-xs ${getValueColor(b.driestGroup, specColors)}`}>{b.driestGroup}</td>
                    <td className={`py-2 px-2 text-center text-xs ${getValueColor(b.matchup1, specColors)}`}>{b.matchup1}</td>
                    <td className={`py-2 px-2 text-center text-xs ${getValueColor(b.matchup2, specColors)}`}>{b.matchup2}</td>
                    <td className={`py-2 px-2 text-center text-xs ${getValueColor(b.matchup3, specColors)}`}>{b.matchup3}</td>
                    <td className={`py-2 px-2 text-center text-xs ${getValueColor(b.penalties, specColors)}`}>{b.penalties === "OVER" ? "מעל" : b.penalties === "UNDER" ? "מתחת" : b.penalties}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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

      {/* === SIMILARITY VIEW === */}
      {view === "similarity" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-l from-white via-purple-50/30 to-indigo-50/40 border-b border-purple-100/50">
              <h3 className="text-lg font-bold text-gray-900">דמיון בין מהמרים</h3>
              <p className="text-sm text-gray-500">כמה אחוז מהפיקים שלכם זהים? מי ה"תאום" ומי ה"נמסיס"?</p>
            </div>
            <div className="p-5">
              {/* Similarity matrix for "אמית" (you) vs everyone */}
              {(() => {
                const you = BETTORS.find(b => b.isYou);
                if (!you) return null;
                const similarities = BETTORS.filter(b => !b.isYou).map(b => {
                  // Simple similarity: count matching picks
                  let matches = 0, total = 0;
                  // Winner
                  total += 3; if (b.winner === you.winner) matches += 3;
                  // Finalists
                  total += 2; if ([b.finalist1,b.finalist2].includes(you.finalist1)) matches += 1;
                  if ([b.finalist1,b.finalist2].includes(you.finalist2)) matches += 1;
                  // SF
                  for (const t of you.sf) { total += 1; if (b.sf.includes(t)) matches += 1; }
                  // QF
                  for (const t of you.qf) { total += 0.5; if (b.qf.includes(t)) matches += 0.5; }
                  // Groups
                  for (const [g, picks] of Object.entries(you.groups)) {
                    const bp = b.groups[g as keyof typeof b.groups];
                    if (bp) { total += 2; if (picks[0] === bp[0]) matches += 1; if (picks[1] === bp[1]) matches += 1; }
                  }
                  const pct = Math.round((matches / total) * 100);
                  return { name: b.name, pct };
                }).sort((a, b) => b.pct - a.pct);

                const twin = similarities[0];
                const nemesis = similarities[similarities.length - 1];

                return (
                  <div className="space-y-4">
                    {/* Twin & Nemesis cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                        <p className="text-xs text-green-600 font-bold mb-1">התאום שלך</p>
                        <p className="text-lg font-black text-green-800">{twin.name}</p>
                        <p className="text-2xl font-black text-green-600" style={{ fontFamily: "var(--font-inter)" }}>{twin.pct}%</p>
                        <p className="text-xs text-green-600">פיקים דומים</p>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                        <p className="text-xs text-red-600 font-bold mb-1">הנמסיס שלך</p>
                        <p className="text-lg font-black text-red-800">{nemesis.name}</p>
                        <p className="text-2xl font-black text-red-600" style={{ fontFamily: "var(--font-inter)" }}>{nemesis.pct}%</p>
                        <p className="text-xs text-red-600">פיקים דומים</p>
                      </div>
                    </div>

                    {/* Full similarity list */}
                    <div className="space-y-2">
                      {similarities.map(s => (
                        <div key={s.name} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50">
                          <span className="font-bold text-sm text-gray-900 w-20">{s.name}</span>
                          <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${s.pct >= 70 ? "bg-green-500" : s.pct >= 50 ? "bg-blue-500" : s.pct >= 30 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${s.pct}%` }}
                            ></div>
                          </div>
                          <span className="font-black text-base w-12 text-end" style={{ fontFamily: "var(--font-inter)" }}>{s.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
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
