"use client";

import { useState } from "react";

// Mock data — in production comes from Supabase
const BETTORS = [
  { name: "דני", winner: "ARG", finalist1: "ARG", finalist2: "FRA", sf: ["ARG","FRA","BRA","GER"], topScorer: "Mbappé", topAssists: "De Bruyne", bestAttack: "FRA", dirtiestTeam: "ARG", groups: { A: ["MAR","PER"], B: ["FRA","COL"], C: ["ARG","MEX"], I: ["GER","USA"] } },
  { name: "יוני", winner: "FRA", finalist1: "FRA", finalist2: "BRA", sf: ["FRA","BRA","ENG","ARG"], topScorer: "Mbappé", topAssists: "Bellingham", bestAttack: "BRA", dirtiestTeam: "URU", groups: { A: ["MAR","CAN"], B: ["FRA","COL"], C: ["ARG","MEX"], I: ["GER","URU"] } },
  { name: "דור דסא", winner: "BRA", finalist1: "BRA", finalist2: "ARG", sf: ["BRA","ARG","ESP","GER"], topScorer: "Vinícius", topAssists: "Messi", bestAttack: "ARG", dirtiestTeam: "MAR", groups: { A: ["MAR","PER"], B: ["FRA","HON"], C: ["ARG","UZB"], I: ["USA","GER"] } },
  { name: "אמית", winner: "ARG", finalist1: "ARG", finalist2: "GER", sf: ["ARG","GER","FRA","BRA"], topScorer: "Messi", topAssists: "De Bruyne", bestAttack: "ARG", dirtiestTeam: "MAR", groups: { A: ["MAR","PER"], B: ["FRA","COL"], C: ["ARG","MEX"], I: ["GER","USA"] }, isYou: true },
  { name: "רון ב", winner: "ENG", finalist1: "ENG", finalist2: "FRA", sf: ["ENG","FRA","BRA","POR"], topScorer: "Kane", topAssists: "Saka", bestAttack: "ENG", dirtiestTeam: "SEN", groups: { A: ["MAR","CAN"], B: ["FRA","COL"], C: ["ARG","MEX"], I: ["GER","USA"] } },
  { name: "רון ג", winner: "ESP", finalist1: "ESP", finalist2: "ARG", sf: ["ESP","ARG","FRA","BRA"], topScorer: "Yamal", topAssists: "Pedri", bestAttack: "ESP", dirtiestTeam: "CMR", groups: { A: ["MAR","PER"], B: ["FRA","COL"], C: ["MEX","ARG"], I: ["GER","URU"] } },
  { name: "רועי", winner: "GER", finalist1: "GER", finalist2: "FRA", sf: ["GER","FRA","ARG","BRA"], topScorer: "Musiala", topAssists: "Wirtz", bestAttack: "GER", dirtiestTeam: "KSA", groups: { A: ["MAR","PER"], B: ["FRA","COL"], C: ["ARG","MEX"], I: ["GER","USA"] } },
  { name: "עידן", winner: "FRA", finalist1: "FRA", finalist2: "ARG", sf: ["FRA","ARG","BRA","ENG"], topScorer: "Mbappé", topAssists: "Griezmann", bestAttack: "FRA", dirtiestTeam: "URU", groups: { A: ["MAR","CAN"], B: ["FRA","COL"], C: ["ARG","MEX"], I: ["GER","USA"] } },
  { name: "אוהד", winner: "ARG", finalist1: "ARG", finalist2: "BRA", sf: ["ARG","BRA","FRA","ESP"], topScorer: "Lautaro", topAssists: "Mac Allister", bestAttack: "ARG", dirtiestTeam: "CMR", groups: { A: ["MAR","PER"], B: ["FRA","COL"], C: ["ARG","MEX"], I: ["GER","USA"] } },
  { name: "אורי", winner: "BRA", finalist1: "BRA", finalist2: "FRA", sf: ["BRA","FRA","ARG","GER"], topScorer: "Vinícius", topAssists: "Rodrygo", bestAttack: "BRA", dirtiestTeam: "MAR", groups: { A: ["MAR","PER"], B: ["FRA","COL"], C: ["ARG","MEX"], I: ["GER","URU"] } },
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
                  <th className="py-3 px-3 text-center">זוכה</th>
                  <th className="py-3 px-3 text-center">עולה לגמר 1</th>
                  <th className="py-3 px-3 text-center">עולה לגמר 2</th>
                  <th className="py-3 px-3 text-center">חצי 1</th>
                  <th className="py-3 px-3 text-center">חצי 2</th>
                  <th className="py-3 px-3 text-center">חצי 3</th>
                  <th className="py-3 px-3 text-center">חצי 4</th>
                </tr>
              </thead>
              <tbody>
                {BETTORS.map(b => (
                  <tr key={b.name} className={`border-t border-gray-100 ${b.isYou ? "bg-blue-50/40" : "hover:bg-gray-50"}`}>
                    <td className="py-3 px-2 font-bold text-gray-900 sticky start-0 bg-inherit z-10 border-e border-gray-100 whitespace-nowrap w-16 max-w-[4rem] truncate text-xs">
                      {b.name} {b.isYou && <span className="text-[10px] text-blue-500 bg-blue-100 rounded px-1 ms-0.5">אתה</span>}
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-amber-700">{F[b.winner]} {b.winner}</td>
                    <td className="py-3 px-3 text-center">{F[b.finalist1]} {b.finalist1}</td>
                    <td className="py-3 px-3 text-center">{F[b.finalist2]} {b.finalist2}</td>
                    {b.sf.map((t, i) => (
                      <td key={i} className="py-3 px-3 text-center text-gray-600">{F[t]} {t}</td>
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
                  <th className="py-3 px-3 text-center">מלך שערים</th>
                  <th className="py-3 px-3 text-center">מלך בישולים</th>
                  <th className="py-3 px-3 text-center">התקפה טובה</th>
                  <th className="py-3 px-3 text-center">כסחנית</th>
                </tr>
              </thead>
              <tbody>
                {BETTORS.map(b => (
                  <tr key={b.name} className={`border-t border-gray-100 ${b.isYou ? "bg-blue-50/40" : "hover:bg-gray-50"}`}>
                    <td className="py-3 px-2 font-bold text-gray-900 sticky start-0 bg-inherit z-10 border-e border-gray-100 whitespace-nowrap w-16 max-w-[4rem] truncate text-xs">
                      {b.name} {b.isYou && <span className="text-[10px] text-blue-500 bg-blue-100 rounded px-1 ms-0.5">אתה</span>}
                    </td>
                    <td className="py-3 px-3 text-center font-medium">{b.topScorer}</td>
                    <td className="py-3 px-3 text-center font-medium">{b.topAssists}</td>
                    <td className="py-3 px-3 text-center">{F[b.bestAttack]} {b.bestAttack}</td>
                    <td className="py-3 px-3 text-center">{F[b.dirtiestTeam]} {b.dirtiestTeam}</td>
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
          {["A", "B", "C", "I"].map(groupId => (
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
                          <td className="py-2.5 px-3 text-center font-medium">{F[picks[0]]} {picks[0]}</td>
                          <td className="py-2.5 px-3 text-center font-medium">{F[picks[1]]} {picks[1]}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="text-sm text-gray-400 text-center">* מוצגים בתים לדוגמה — כל 12 הבתים יוצגו לאחר נעילת ההימורים</p>
        </div>
      )}
    </div>
  );
}
