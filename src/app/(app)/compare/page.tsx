"use client";

import { useState, useMemo } from "react";

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

// Mock data — in production comes from Supabase
const BETTORS = [
  { name: "דני", winner: "ARG", finalist1: "ARG", finalist2: "FRA", sf: ["ARG","FRA","BRA","GER"], qf: ["ARG","FRA","BRA","GER","ESP","POR","ENG","NED"], topScorer: "Mbappé", topAssists: "De Bruyne", bestAttack: "FRA", dirtiestTeam: "ARG", prolificGroup: "C", driestGroup: "G", matchup1: "1", matchup2: "2", matchup3: "1", penalties: "OVER", groups: { A: ["MEX","KOR"], B: ["SUI","CAN"], C: ["BRA","MAR"], D: ["USA","TUR"], E: ["GER","ECU"], F: ["NED","JPN"], G: ["BEL","IRN"], H: ["ESP","URU"], I: ["FRA","SEN"], J: ["ARG","AUT"], K: ["POR","COL"], L: ["ENG","CRO"] } },
  { name: "יוני", winner: "FRA", finalist1: "FRA", finalist2: "BRA", sf: ["FRA","BRA","ENG","ARG"], qf: ["FRA","BRA","ENG","ARG","GER","ESP","NED","POR"], topScorer: "Mbappé", topAssists: "Bellingham", bestAttack: "BRA", dirtiestTeam: "URU", prolificGroup: "K", driestGroup: "B", matchup1: "1", matchup2: "1", matchup3: "X", penalties: "UNDER", groups: { A: ["MEX","CZE"], B: ["SUI","CAN"], C: ["BRA","MAR"], D: ["USA","AUS"], E: ["GER","CIV"], F: ["NED","JPN"], G: ["BEL","EGY"], H: ["ESP","URU"], I: ["FRA","NOR"], J: ["ARG","AUT"], K: ["POR","COL"], L: ["ENG","CRO"] } },
  { name: "דור דסא", winner: "BRA", finalist1: "BRA", finalist2: "ARG", sf: ["BRA","ARG","ESP","GER"], qf: ["BRA","ARG","ESP","GER","FRA","ENG","NED","POR"], topScorer: "Vinícius", topAssists: "Messi", bestAttack: "ARG", dirtiestTeam: "MAR", prolificGroup: "J", driestGroup: "A", matchup1: "2", matchup2: "2", matchup3: "1", penalties: "OVER", groups: { A: ["KOR","MEX"], B: ["SUI","QAT"], C: ["BRA","MAR"], D: ["USA","TUR"], E: ["GER","ECU"], F: ["JPN","NED"], G: ["BEL","IRN"], H: ["ESP","URU"], I: ["FRA","SEN"], J: ["ARG","ALG"], K: ["POR","COL"], L: ["ENG","GHA"] } },
  { name: "אמית", winner: "ARG", finalist1: "ARG", finalist2: "GER", sf: ["ARG","GER","FRA","BRA"], qf: ["ARG","GER","FRA","BRA","ESP","ENG","NED","POR"], topScorer: "Messi", topAssists: "De Bruyne", bestAttack: "ARG", dirtiestTeam: "MAR", prolificGroup: "C", driestGroup: "G", matchup1: "1", matchup2: "2", matchup3: "1", penalties: "OVER", groups: { A: ["MEX","KOR"], B: ["SUI","CAN"], C: ["BRA","MAR"], D: ["USA","TUR"], E: ["GER","ECU"], F: ["NED","JPN"], G: ["BEL","IRN"], H: ["ESP","URU"], I: ["FRA","SEN"], J: ["ARG","AUT"], K: ["POR","COL"], L: ["ENG","CRO"] }, isYou: true },
  { name: "רון ב", winner: "ENG", finalist1: "ENG", finalist2: "FRA", sf: ["ENG","FRA","BRA","POR"], qf: ["ENG","FRA","BRA","POR","ARG","GER","ESP","NED"], topScorer: "Kane", topAssists: "Saka", bestAttack: "ENG", dirtiestTeam: "SEN", prolificGroup: "L", driestGroup: "B", matchup1: "2", matchup2: "1", matchup3: "2", penalties: "UNDER", groups: { A: ["MEX","CZE"], B: ["SUI","CAN"], C: ["BRA","SCO"], D: ["USA","AUS"], E: ["GER","ECU"], F: ["NED","JPN"], G: ["BEL","EGY"], H: ["ESP","URU"], I: ["FRA","SEN"], J: ["ARG","AUT"], K: ["POR","COL"], L: ["ENG","CRO"] } },
  { name: "רון ג", winner: "ESP", finalist1: "ESP", finalist2: "ARG", sf: ["ESP","ARG","FRA","BRA"], qf: ["ESP","ARG","FRA","BRA","GER","ENG","NED","POR"], topScorer: "Yamal", topAssists: "Pedri", bestAttack: "ESP", dirtiestTeam: "GHA", prolificGroup: "J", driestGroup: "A", matchup1: "1", matchup2: "2", matchup3: "X", penalties: "OVER", groups: { A: ["MEX","KOR"], B: ["SUI","BIH"], C: ["BRA","MAR"], D: ["USA","TUR"], E: ["GER","CIV"], F: ["NED","JPN"], G: ["BEL","IRN"], H: ["ESP","URU"], I: ["FRA","SEN"], J: ["ARG","ALG"], K: ["POR","COL"], L: ["ENG","CRO"] } },
  { name: "רועי", winner: "GER", finalist1: "GER", finalist2: "FRA", sf: ["GER","FRA","ARG","BRA"], qf: ["GER","FRA","ARG","BRA","ESP","ENG","NED","POR"], topScorer: "Musiala", topAssists: "Wirtz", bestAttack: "GER", dirtiestTeam: "KSA", prolificGroup: "E", driestGroup: "G", matchup1: "1", matchup2: "1", matchup3: "2", penalties: "UNDER", groups: { A: ["MEX","KOR"], B: ["SUI","CAN"], C: ["BRA","MAR"], D: ["USA","TUR"], E: ["GER","ECU"], F: ["NED","JPN"], G: ["BEL","IRN"], H: ["ESP","URU"], I: ["FRA","SEN"], J: ["ARG","AUT"], K: ["POR","COL"], L: ["ENG","CRO"] } },
  { name: "עידן", winner: "FRA", finalist1: "FRA", finalist2: "ARG", sf: ["FRA","ARG","BRA","ENG"], qf: ["FRA","ARG","BRA","ENG","GER","ESP","NED","POR"], topScorer: "Mbappé", topAssists: "Griezmann", bestAttack: "FRA", dirtiestTeam: "URU", prolificGroup: "C", driestGroup: "B", matchup1: "1", matchup2: "X", matchup3: "1", penalties: "OVER", groups: { A: ["MEX","CZE"], B: ["SUI","CAN"], C: ["BRA","MAR"], D: ["USA","AUS"], E: ["GER","ECU"], F: ["NED","JPN"], G: ["BEL","EGY"], H: ["ESP","URU"], I: ["FRA","NOR"], J: ["ARG","AUT"], K: ["POR","COL"], L: ["ENG","CRO"] } },
  { name: "אוהד", winner: "ARG", finalist1: "ARG", finalist2: "BRA", sf: ["ARG","BRA","FRA","ESP"], qf: ["ARG","BRA","FRA","ESP","GER","ENG","NED","POR"], topScorer: "Lautaro", topAssists: "Mac Allister", bestAttack: "ARG", dirtiestTeam: "GHA", prolificGroup: "K", driestGroup: "A", matchup1: "1", matchup2: "2", matchup3: "1", penalties: "OVER", groups: { A: ["MEX","KOR"], B: ["SUI","CAN"], C: ["BRA","MAR"], D: ["USA","TUR"], E: ["GER","ECU"], F: ["NED","JPN"], G: ["BEL","IRN"], H: ["ESP","URU"], I: ["FRA","SEN"], J: ["ARG","AUT"], K: ["POR","COL"], L: ["ENG","CRO"] } },
  { name: "אורי", winner: "BRA", finalist1: "BRA", finalist2: "FRA", sf: ["BRA","FRA","ARG","GER"], qf: ["BRA","FRA","ARG","GER","ESP","ENG","NED","POR"], topScorer: "Vinícius", topAssists: "Rodrygo", bestAttack: "BRA", dirtiestTeam: "MAR", prolificGroup: "C", driestGroup: "G", matchup1: "2", matchup2: "1", matchup3: "1", penalties: "UNDER", groups: { A: ["MEX","KOR"], B: ["SUI","CAN"], C: ["BRA","MAR"], D: ["USA","TUR"], E: ["GER","ECU"], F: ["NED","JPN"], G: ["BEL","IRN"], H: ["ESP","URU"], I: ["FRA","SEN"], J: ["ARG","AUT"], K: ["POR","COL"], L: ["ENG","GHA"] } },
];

const F: Record<string,string> = {
  ARG:"🇦🇷",BRA:"🇧🇷",FRA:"🇫🇷",ENG:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",ESP:"🇪🇸",GER:"🇩🇪",POR:"🇵🇹",NED:"🇳🇱",
  ITA:"🇮🇹",BEL:"🇧🇪",CRO:"🇭🇷",URU:"🇺🇾",JPN:"🇯🇵",KOR:"🇰🇷",MAR:"🇲🇦",SEN:"🇸🇳",
  USA:"🇺🇸",MEX:"🇲🇽",COL:"🇨🇴",CAN:"🇨🇦",PER:"🇵🇪",UZB:"🇺🇿",HON:"🇭🇳",CMR:"🇨🇲",
  KSA:"🇸🇦",DEN:"🇩🇰",
};

type View = "advancement" | "specials" | "groups";

export default function ComparePage() {
  const [view, setView] = useState<View>("advancement");

  // Build color maps for each category
  const advColors = useMemo(() => buildColorMap([
    ...BETTORS.map(b=>b.winner), ...BETTORS.flatMap(b=>[b.finalist1,b.finalist2]),
    ...BETTORS.flatMap(b=>b.sf), ...BETTORS.flatMap(b=>b.qf),
  ]), []);
  const specColors = useMemo(() => buildColorMap([
    ...BETTORS.map(b=>b.topScorer), ...BETTORS.map(b=>b.topAssists),
    ...BETTORS.map(b=>b.bestAttack), ...BETTORS.map(b=>b.dirtiestTeam),
    ...BETTORS.map(b=>b.prolificGroup), ...BETTORS.map(b=>b.driestGroup),
    ...BETTORS.map(b=>b.matchup1), ...BETTORS.map(b=>b.matchup2),
    ...BETTORS.map(b=>b.matchup3), ...BETTORS.map(b=>b.penalties),
  ]), []);
  const groupColors = useMemo(() => {
    const all: string[] = [];
    BETTORS.forEach(b => Object.values(b.groups).forEach(g => all.push(...g)));
    return buildColorMap(all);
  }, []);

  return (
    <div className="max-w-full mx-auto px-4 py-6 pb-24">
      <div className="mb-5">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>השוואת הימורים</h1>
        <p className="text-base text-gray-600 mt-1">ראו מה כל מהמר בחר — השוואה מלאה בין כל המשתתפים</p>
      </div>

      {/* View tabs */}
      <div className="mb-5 flex gap-2">
        {[
          { key: "advancement" as View, label: "עולות + זוכה" },
          { key: "specials" as View, label: "הימורים מיוחדים" },
          { key: "groups" as View, label: "עולות מהבתים" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setView(tab.key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              view === tab.key ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:bg-gray-200 border border-gray-200"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

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
          {/* Popular picks */}
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-200">
            <p className="text-sm font-bold text-gray-700 mb-2">הבחירות הפופולריות:</p>
            <div className="flex gap-4 text-sm">
              <span>זוכה: <strong className="text-amber-700">{F["ARG"]} ARG (4 מהמרים)</strong></span>
              <span>גמרנית: <strong>{F["FRA"]} FRA (7 מהמרים)</strong></span>
              <span>מלך שערים: <strong>Mbappé (3)</strong></span>
            </div>
          </div>
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
        <div className="space-y-4">
          {["A","B","C","D","E","F","G","H","I","J","K","L"].map(groupId => (
            <div key={groupId} className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
                <h3 className="text-base font-bold text-gray-800">בית {groupId} — מי העלה את מי?</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-500 font-semibold border-b border-gray-200">
                      <th className="py-2 px-2 text-start sticky start-0 bg-white z-10 border-e border-gray-100 w-16 max-w-[4rem]">מהמר</th>
                      <th className="py-2 px-3 text-center">מקום 1</th>
                      <th className="py-2 px-3 text-center">מקום 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {BETTORS.map(b => {
                      const picks = b.groups[groupId as keyof typeof b.groups];
                      if (!picks) return null;
                      return (
                        <tr key={b.name} className={`border-t border-gray-100 ${b.isYou ? "bg-blue-50/40" : "hover:bg-gray-50"}`}>
                          <td className="py-2.5 px-2 font-bold text-gray-900 sticky start-0 bg-inherit z-10 border-e border-gray-100 whitespace-nowrap w-16 max-w-[4rem] truncate text-xs">{b.name}</td>
                          <td className={`py-2.5 px-3 text-center font-medium ${getValueColor(picks[0], groupColors)}`}>{F[picks[0]]} {picks[0]}</td>
                          <td className={`py-2.5 px-3 text-center font-medium ${getValueColor(picks[1], groupColors)}`}>{F[picks[1]]} {picks[1]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="text-sm text-gray-400 text-center">כל 12 הבתים — מקומות 1 ו-2 שכל מהמר בחר</p>
        </div>
      )}
    </div>
  );
}
