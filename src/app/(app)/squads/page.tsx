"use client";

import { useState } from "react";
import { ALL_TEAMS } from "@/lib/tournament/groups";

const F: Record<string,string> = {
  MEX:"🇲🇽",KOR:"🇰🇷",CZE:"🇨🇿",RSA:"🇿🇦",CAN:"🇨🇦",QAT:"🇶🇦",SUI:"🇨🇭",BIH:"🇧🇦",
  BRA:"🇧🇷",MAR:"🇲🇦",SCO:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",HAI:"🇭🇹",USA:"🇺🇸",PAR:"🇵🇾",TUR:"🇹🇷",AUS:"🇦🇺",
  GER:"🇩🇪",ECU:"🇪🇨",CIV:"🇨🇮",CUR:"🇨🇼",NED:"🇳🇱",JPN:"🇯🇵",SWE:"🇸🇪",TUN:"🇹🇳",
  BEL:"🇧🇪",IRN:"🇮🇷",EGY:"🇪🇬",NZL:"🇳🇿",ESP:"🇪🇸",URU:"🇺🇾",KSA:"🇸🇦",CPV:"🇨🇻",
  FRA:"🇫🇷",SEN:"🇸🇳",NOR:"🇳🇴",IRQ:"🇮🇶",ARG:"🇦🇷",AUT:"🇦🇹",ALG:"🇩🇿",JOR:"🇯🇴",
  POR:"🇵🇹",COL:"🇨🇴",UZB:"🇺🇿",COD:"🇨🇩",ENG:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",CRO:"🇭🇷",GHA:"🇬🇭",PAN:"🇵🇦",
};

interface Player { name: string; nameEn: string; num: number; club: string; pos: string }

const SQUADS: Record<string, { coach: string; formation: string; players: Player[]; bench: Player[] }> = {
  ARG: { coach: "ליאונל סקאלוני", formation: "4-3-3", players: [
    { pos: "GK", name: "א. מרטינס", nameEn: "E. Martínez", num: 23, club: "אסטון וילה" },
    { pos: "DEF", name: "מולינה", nameEn: "Molina", num: 26, club: "אתלטיקו" },
    { pos: "DEF", name: "רומרו", nameEn: "Romero", num: 13, club: "טוטנהאם" },
    { pos: "DEF", name: "ל. מרטינס", nameEn: "L. Martínez", num: 6, club: "אינטר" },
    { pos: "DEF", name: "אקוניה", nameEn: "Acuña", num: 8, club: "סביליה" },
    { pos: "MID", name: "דה פאול", nameEn: "De Paul", num: 7, club: "אתלטיקו" },
    { pos: "MID", name: "פרננדס", nameEn: "E. Fernández", num: 24, club: "צ׳לסי" },
    { pos: "MID", name: "מק אליסטר", nameEn: "Mac Allister", num: 20, club: "ליברפול" },
    { pos: "FW", name: "מסי", nameEn: "Messi", num: 10, club: "אינטר מיאמי" },
    { pos: "FW", name: "לאוטרו", nameEn: "Lautaro", num: 22, club: "אינטר" },
    { pos: "FW", name: "אלברס", nameEn: "Álvarez", num: 9, club: "אתלטיקו" },
  ], bench: [
    { pos: "GK", name: "רולי", nameEn: "Rulli", num: 12, club: "ריאל סוסיאדד" },
    { pos: "DEF", name: "אוטמנדי", nameEn: "Otamendi", num: 19, club: "בנפיקה" },
    { pos: "DEF", name: "מונטיאל", nameEn: "Montiel", num: 4, club: "סביליה" },
    { pos: "DEF", name: "טאגליאפיקו", nameEn: "Tagliafico", num: 3, club: "ליון" },
    { pos: "MID", name: "לו סלסו", nameEn: "Lo Celso", num: 18, club: "בטיס" },
    { pos: "MID", name: "פרדס", nameEn: "Paredes", num: 5, club: "רומא" },
    { pos: "FW", name: "גארנאצ׳ו", nameEn: "Garnacho", num: 17, club: "מנצ׳סטר יונ׳" },
    { pos: "FW", name: "דיבאלה", nameEn: "Dybala", num: 21, club: "רומא" },
    { pos: "FW", name: "נ. גונזלס", nameEn: "N. González", num: 15, club: "יובנטוס" },
  ]},
  FRA: { coach: "דידייה דשאן", formation: "4-3-3", players: [
    { pos: "GK", name: "מנייאן", nameEn: "Maignan", num: 16, club: "מילאן" },
    { pos: "DEF", name: "קונדה", nameEn: "Koundé", num: 5, club: "ברצלונה" },
    { pos: "DEF", name: "סליבה", nameEn: "Saliba", num: 17, club: "ארסנל" },
    { pos: "DEF", name: "אופמקאנו", nameEn: "Upamecano", num: 4, club: "באיירן" },
    { pos: "DEF", name: "תאו", nameEn: "T. Hernández", num: 22, club: "מילאן" },
    { pos: "MID", name: "טשואמני", nameEn: "Tchouaméni", num: 8, club: "ריאל מדריד" },
    { pos: "MID", name: "קאנטה", nameEn: "Kanté", num: 13, club: "אל איתחאד" },
    { pos: "MID", name: "גריזמן", nameEn: "Griezmann", num: 7, club: "אתלטיקו" },
    { pos: "FW", name: "דמבלה", nameEn: "Dembélé", num: 11, club: "פריז" },
    { pos: "FW", name: "אמבפה", nameEn: "Mbappé", num: 10, club: "ריאל מדריד" },
    { pos: "FW", name: "טורם", nameEn: "Thuram", num: 9, club: "אינטר" },
  ], bench: [
    { pos: "GK", name: "אריאולה", nameEn: "Areola", num: 23, club: "ווסטהאם" },
    { pos: "DEF", name: "קונאטה", nameEn: "Konaté", num: 21, club: "ליברפול" },
    { pos: "DEF", name: "פ. מנדי", nameEn: "F. Mendy", num: 3, club: "ריאל מדריד" },
    { pos: "MID", name: "ראביו", nameEn: "Rabiot", num: 14, club: "מרסיי" },
    { pos: "MID", name: "פוג׳בה", nameEn: "Fofana", num: 6, club: "מילאן" },
    { pos: "FW", name: "קולו מואני", nameEn: "Kolo Muani", num: 12, club: "פריז" },
    { pos: "FW", name: "ז׳ירו", nameEn: "Giroud", num: 9, club: "מילאן" },
  ]},
  BRA: { coach: "דוריבאל ג׳וניור", formation: "4-2-3-1", players: [
    { pos: "GK", name: "אליסון", nameEn: "Alisson", num: 1, club: "ליברפול" },
    { pos: "DEF", name: "מיליטאו", nameEn: "Militão", num: 2, club: "ריאל מדריד" },
    { pos: "DEF", name: "מרקיניוס", nameEn: "Marquinhos", num: 4, club: "פריז" },
    { pos: "DEF", name: "גבריאל", nameEn: "Gabriel", num: 3, club: "ארסנל" },
    { pos: "DEF", name: "וונדל", nameEn: "Wendell", num: 6, club: "פורטו" },
    { pos: "MID", name: "גימראאש", nameEn: "B. Guimarães", num: 5, club: "ניוקאסל" },
    { pos: "MID", name: "אנדרה", nameEn: "André", num: 8, club: "וולברהמפטון" },
    { pos: "MID", name: "סאביניו", nameEn: "Savinho", num: 18, club: "מנ׳ סיטי" },
    { pos: "MID", name: "פאקטה", nameEn: "Paquetá", num: 10, club: "ווסטהאם" },
    { pos: "MID", name: "רודריגו", nameEn: "Rodrygo", num: 7, club: "ריאל מדריד" },
    { pos: "FW", name: "וינסיוס", nameEn: "Vinícius Jr.", num: 11, club: "ריאל מדריד" },
  ], bench: [
    { pos: "GK", name: "אדרסון", nameEn: "Ederson", num: 12, club: "מנצ׳סטר סיטי" },
    { pos: "DEF", name: "דניאלו", nameEn: "Danilo", num: 14, club: "סנטוס" },
    { pos: "DEF", name: "אמרסון", nameEn: "Emerson", num: 15, club: "טוטנהאם" },
    { pos: "MID", name: "קזמירו", nameEn: "Casemiro", num: 16, club: "מנצ׳סטר יונ׳" },
    { pos: "FW", name: "ראפיניה", nameEn: "Raphinha", num: 19, club: "ברצלונה" },
    { pos: "FW", name: "אנדריק", nameEn: "Endrick", num: 9, club: "ריאל מדריד" },
    { pos: "FW", name: "פדרו", nameEn: "Pedro", num: 21, club: "פלמנגו" },
  ]},
};

function PitchFormation({ players, formation }: { players: Player[]; formation: string }) {
  const gk = players.filter(p => p.pos === "GK");
  const def = players.filter(p => p.pos === "DEF");
  const mid = players.filter(p => p.pos === "MID");
  const fw = players.filter(p => p.pos === "FW");

  const rows = [
    { data: gk, top: "85%" },
    { data: def, top: "65%" },
    { data: mid, top: "38%" },
    { data: fw, top: "12%" },
  ];

  return (
    <div className="relative w-full aspect-[68/100] max-w-md mx-auto rounded-2xl overflow-hidden shadow-lg" style={{ background: "linear-gradient(180deg, #1a7a3a 0%, #22883f 50%, #1a7a3a 100%)" }}>
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 680 1000" fill="none">
        <rect x="40" y="20" width="600" height="960" stroke="white" strokeOpacity="0.3" strokeWidth="3" rx="4" />
        <line x1="40" y1="500" x2="640" y2="500" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
        <circle cx="340" cy="500" r="80" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
        <rect x="160" y="20" width="360" height="160" stroke="white" strokeOpacity="0.25" strokeWidth="2" />
        <rect x="160" y="820" width="360" height="160" stroke="white" strokeOpacity="0.25" strokeWidth="2" />
      </svg>

      {rows.map((row, ri) => (
        <div key={ri} className="absolute left-0 right-0 flex justify-around items-center px-4 sm:px-6" style={{ top: row.top, transform: "translateY(-50%)" }}>
          {row.data.map(p => (
            <div key={p.num} className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-sm font-black text-blue-900 border-2 border-white" style={{ fontFamily: "var(--font-inter)" }}>
                {p.num}
              </div>
              <div className="bg-black/50 backdrop-blur-sm rounded-md px-1.5 py-0.5">
                <span className="text-xs font-bold text-white text-center block">{p.nameEn}</span>
              </div>
            </div>
          ))}
        </div>
      ))}

      <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
        <span className="text-xs font-bold text-white" style={{ fontFamily: "var(--font-inter)" }}>{formation}</span>
      </div>
    </div>
  );
}

export default function SquadsPage() {
  const [selected, setSelected] = useState("ARG");
  const team = ALL_TEAMS.find(t => t.code === selected);
  const squad = SQUADS[selected];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
      <div className="mb-5">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>נבחרות וסגלים</h1>
        <p className="text-base text-gray-600 mt-1">הרכבי פתיחה משוערים ומערכים</p>
      </div>

      {/* Team selector */}
      <div className="mb-6">
        <select value={selected} onChange={e => setSelected(e.target.value)}
          className="w-full sm:w-auto px-4 py-3 rounded-xl border border-gray-200 bg-white text-base font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {ALL_TEAMS.map(t => (
            <option key={t.code} value={t.code}>
              {F[t.code] || "🏳️"} {t.name_he} ({t.code}) {SQUADS[t.code] ? "✓" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Team header */}
      {team && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-6xl">{F[selected]}</span>
            <div>
              <h2 className="text-2xl font-black text-gray-900">{team.name_he}</h2>
              <p className="text-base text-gray-500">{team.name}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
                <span>בית {team.group_id}</span>
                <span>FIFA #{team.fifa_ranking}</span>
                {squad && <span>מאמן: {squad.coach}</span>}
                {squad && <span>מערך: {squad.formation}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {squad ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <PitchFormation players={squad.players} formation={squad.formation} />

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
              <p className="text-base font-bold text-gray-800">הרכב פתיחה משוער</p>
              <p className="text-sm text-gray-500">{squad.formation}</p>
            </div>
            {(["GK", "DEF", "MID", "FW"] as const).map(pos => (
              <div key={pos}>
                <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider" style={{ fontFamily: "var(--font-inter)" }}>
                    {pos === "GK" ? "שוער" : pos === "DEF" ? "הגנה" : pos === "MID" ? "קישור" : "התקפה"}
                  </span>
                </div>
                {squad.players.filter(p => p.pos === pos).map(p => (
                  <div key={p.num} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <span className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700" style={{ fontFamily: "var(--font-inter)" }}>{p.num}</span>
                    <div className="flex-1">
                      <span className="font-bold text-sm text-gray-900">{p.name}</span>
                      <span className="text-sm text-gray-400 ms-2">{p.nameEn}</span>
                    </div>
                    <span className="text-sm text-gray-400">{p.club}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Expandable bench */}
          {squad.bench && squad.bench.length > 0 && (
            <div className="lg:col-span-2">
              <details className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <summary className="px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between">
                  <span className="font-bold text-base text-gray-800">ספסל ושאר הסגל ({squad.bench.length} שחקנים)</span>
                  <span className="text-sm text-gray-400">לחצו לפתיחה</span>
                </summary>
                <div className="border-t border-gray-100">
                  {(["GK", "DEF", "MID", "FW"] as const).map(pos => {
                    const posPlayers = squad.bench.filter(p => p.pos === pos);
                    if (posPlayers.length === 0) return null;
                    return (
                      <div key={pos}>
                        <div className="px-4 py-1.5 bg-gray-50 border-b border-gray-100">
                          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider" style={{ fontFamily: "var(--font-inter)" }}>
                            {pos === "GK" ? "שוער" : pos === "DEF" ? "הגנה" : pos === "MID" ? "קישור" : "התקפה"}
                          </span>
                        </div>
                        {posPlayers.map(p => (
                          <div key={p.num} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500" style={{ fontFamily: "var(--font-inter)" }}>{p.num}</span>
                            <div className="flex-1">
                              <span className="font-bold text-sm text-gray-800">{p.name}</span>
                              <span className="text-sm text-gray-400 ms-2">{p.nameEn}</span>
                            </div>
                            <span className="text-sm text-gray-400">{p.club}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-500 text-lg">סגל הנבחרת הזו יתעדכן בקרוב</p>
        </div>
      )}
    </div>
  );
}
