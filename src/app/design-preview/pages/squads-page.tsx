"use client";

import { useState } from "react";

// ============================================================================
// Squads Page — Team info + formation on pitch
// 3 sources: SofaScore, FotMob, Transfermarkt — user can switch between them
// Each source may have a different predicted XI / formation
// ============================================================================

type Source = "sofascore" | "fotmob" | "transfermarkt";

const SOURCES: { key: Source; name: string; logo: string; color: string }[] = [
  { key: "sofascore", name: "SofaScore", logo: "📊", color: "bg-blue-500" },
  { key: "fotmob", name: "FotMob", logo: "⚽", color: "bg-green-600" },
  { key: "transfermarkt", name: "Transfermarkt", logo: "📈", color: "bg-teal-600" },
];

interface PlayerInfo { name: string; nameEn: string; num: number; club: string; age?: number }
interface LineupData {
  formation: string;
  players: { GK: PlayerInfo[]; DEF: PlayerInfo[]; MID: PlayerInfo[]; FW: PlayerInfo[] };
}

interface TeamData {
  code: string; flag: string; name: string; nameEn: string; coach: string; ranking: number; group: string;
  lineups: Record<Source, LineupData>;
  fullSquad: { pos: string; name: string; nameEn: string; num: number; club: string; age: number }[];
}

const TEAMS: TeamData[] = [
  {
    code: "ARG", flag: "🇦🇷", name: "ארגנטינה", nameEn: "Argentina", coach: "ליאונל סקאלוני", ranking: 1, group: "C",
    lineups: {
      sofascore: {
        formation: "4-3-3",
        players: {
          GK: [{ name: "א. מרטינס", nameEn: "E. Martínez", num: 23, club: "אסטון וילה" }],
          DEF: [{ name: "מולינה", nameEn: "Molina", num: 26, club: "אתלטיקו" }, { name: "רומרו", nameEn: "Romero", num: 13, club: "טוטנהאם" }, { name: "ל. מרטינס", nameEn: "L. Martínez", num: 6, club: "אינטר" }, { name: "אקוניה", nameEn: "Acuña", num: 8, club: "סביליה" }],
          MID: [{ name: "דה פאול", nameEn: "De Paul", num: 7, club: "אתלטיקו" }, { name: "פרננדס", nameEn: "E. Fernández", num: 24, club: "צ׳לסי" }, { name: "מק אליסטר", nameEn: "Mac Allister", num: 20, club: "ליברפול" }],
          FW: [{ name: "מסי", nameEn: "Messi", num: 10, club: "אינטר מיאמי" }, { name: "לאוטרו", nameEn: "Lautaro", num: 22, club: "אינטר" }, { name: "אלברס", nameEn: "Álvarez", num: 9, club: "אתלטיקו" }],
        },
      },
      fotmob: {
        formation: "4-4-2",
        players: {
          GK: [{ name: "א. מרטינס", nameEn: "E. Martínez", num: 23, club: "אסטון וילה" }],
          DEF: [{ name: "מולינה", nameEn: "Molina", num: 26, club: "אתלטיקו" }, { name: "רומרו", nameEn: "Romero", num: 13, club: "טוטנהאם" }, { name: "אוטמנדי", nameEn: "Otamendi", num: 19, club: "בנפיקה" }, { name: "טאגליאפיקו", nameEn: "Tagliafico", num: 3, club: "ליון" }],
          MID: [{ name: "דה פאול", nameEn: "De Paul", num: 7, club: "אתלטיקו" }, { name: "פרננדס", nameEn: "E. Fernández", num: 24, club: "צ׳לסי" }, { name: "מק אליסטר", nameEn: "Mac Allister", num: 20, club: "ליברפול" }, { name: "גארנאצ׳ו", nameEn: "Garnacho", num: 17, club: "מנצ׳סטר יונ׳" }],
          FW: [{ name: "מסי", nameEn: "Messi", num: 10, club: "אינטר מיאמי" }, { name: "לאוטרו", nameEn: "Lautaro", num: 22, club: "אינטר" }],
        },
      },
      transfermarkt: {
        formation: "4-3-3",
        players: {
          GK: [{ name: "א. מרטינס", nameEn: "E. Martínez", num: 23, club: "אסטון וילה" }],
          DEF: [{ name: "מונטיאל", nameEn: "Montiel", num: 4, club: "סביליה" }, { name: "רומרו", nameEn: "Romero", num: 13, club: "טוטנהאם" }, { name: "ל. מרטינס", nameEn: "L. Martínez", num: 6, club: "אינטר" }, { name: "אקוניה", nameEn: "Acuña", num: 8, club: "סביליה" }],
          MID: [{ name: "דה פאול", nameEn: "De Paul", num: 7, club: "אתלטיקו" }, { name: "פרננדס", nameEn: "E. Fernández", num: 24, club: "צ׳לסי" }, { name: "לו סלסו", nameEn: "Lo Celso", num: 18, club: "בטיס" }],
          FW: [{ name: "מסי", nameEn: "Messi", num: 10, club: "אינטר מיאמי" }, { name: "אלברס", nameEn: "Álvarez", num: 9, club: "אתלטיקו" }, { name: "דיבאלה", nameEn: "Dybala", num: 21, club: "רומא" }],
        },
      },
    },
    fullSquad: [
      { pos: "GK", name: "א. מרטינס", nameEn: "E. Martínez", num: 23, club: "אסטון וילה", age: 33 },
      { pos: "GK", name: "רולי", nameEn: "Rulli", num: 12, club: "ריאל סוסיאדד", age: 32 },
      { pos: "DEF", name: "מולינה", nameEn: "Molina", num: 26, club: "אתלטיקו", age: 26 },
      { pos: "DEF", name: "רומרו", nameEn: "Romero", num: 13, club: "טוטנהאם", age: 27 },
      { pos: "DEF", name: "ל. מרטינס", nameEn: "L. Martínez", num: 6, club: "אינטר", age: 27 },
      { pos: "DEF", name: "אקוניה", nameEn: "Acuña", num: 8, club: "סביליה", age: 32 },
      { pos: "DEF", name: "אוטמנדי", nameEn: "Otamendi", num: 19, club: "בנפיקה", age: 33 },
      { pos: "DEF", name: "מונטיאל", nameEn: "Montiel", num: 4, club: "סביליה", age: 27 },
      { pos: "DEF", name: "טאגליאפיקו", nameEn: "Tagliafico", num: 3, club: "ליון", age: 32 },
      { pos: "MID", name: "דה פאול", nameEn: "De Paul", num: 7, club: "אתלטיקו", age: 32 },
      { pos: "MID", name: "פרננדס", nameEn: "E. Fernández", num: 24, club: "צ׳לסי", age: 25 },
      { pos: "MID", name: "מק אליסטר", nameEn: "Mac Allister", num: 20, club: "ליברפול", age: 26 },
      { pos: "MID", name: "לו סלסו", nameEn: "Lo Celso", num: 18, club: "בטיס", age: 30 },
      { pos: "MID", name: "פרדס", nameEn: "Paredes", num: 5, club: "רומא", age: 31 },
      { pos: "FW", name: "מסי", nameEn: "Messi", num: 10, club: "אינטר מיאמי", age: 38 },
      { pos: "FW", name: "לאוטרו", nameEn: "Lautaro", num: 22, club: "אינטר", age: 28 },
      { pos: "FW", name: "אלברס", nameEn: "Álvarez", num: 9, club: "אתלטיקו", age: 26 },
      { pos: "FW", name: "גארנאצ׳ו", nameEn: "Garnacho", num: 17, club: "מנצ׳סטר יונ׳", age: 21 },
      { pos: "FW", name: "דיבאלה", nameEn: "Dybala", num: 21, club: "רומא", age: 32 },
      { pos: "FW", name: "נ. גונזלס", nameEn: "N. González", num: 15, club: "יובנטוס", age: 28 },
    ],
  },
  {
    code: "FRA", flag: "🇫🇷", name: "צרפת", nameEn: "France", coach: "דידייה דשאן", ranking: 2, group: "B",
    lineups: {
      sofascore: {
        formation: "4-3-3",
        players: {
          GK: [{ name: "מנייאן", nameEn: "Maignan", num: 16, club: "מילאן" }],
          DEF: [{ name: "קונדה", nameEn: "Koundé", num: 5, club: "ברצלונה" }, { name: "אופמקאנו", nameEn: "Upamecano", num: 4, club: "באיירן" }, { name: "סליבה", nameEn: "Saliba", num: 17, club: "ארסנל" }, { name: "תאו", nameEn: "T. Hernández", num: 22, club: "מילאן" }],
          MID: [{ name: "טשואמני", nameEn: "Tchouaméni", num: 8, club: "ריאל מדריד" }, { name: "קאנטה", nameEn: "Kanté", num: 13, club: "אל איתחאד" }, { name: "גריזמן", nameEn: "Griezmann", num: 7, club: "אתלטיקו" }],
          FW: [{ name: "דמבלה", nameEn: "Dembélé", num: 11, club: "פריז" }, { name: "אמבפה", nameEn: "Mbappé", num: 10, club: "ריאל מדריד" }, { name: "טורם", nameEn: "Thuram", num: 9, club: "אינטר" }],
        },
      },
      fotmob: {
        formation: "4-2-3-1",
        players: {
          GK: [{ name: "מנייאן", nameEn: "Maignan", num: 16, club: "מילאן" }],
          DEF: [{ name: "קונדה", nameEn: "Koundé", num: 5, club: "ברצלונה" }, { name: "קונאטה", nameEn: "Konaté", num: 4, club: "ליברפול" }, { name: "סליבה", nameEn: "Saliba", num: 17, club: "ארסנל" }, { name: "תאו", nameEn: "T. Hernández", num: 22, club: "מילאן" }],
          MID: [{ name: "טשואמני", nameEn: "Tchouaméni", num: 8, club: "ריאל מדריד" }, { name: "קאנטה", nameEn: "Kanté", num: 13, club: "אל איתחאד" }, { name: "דמבלה", nameEn: "Dembélé", num: 11, club: "פריז" }, { name: "גריזמן", nameEn: "Griezmann", num: 7, club: "אתלטיקו" }, { name: "טורם", nameEn: "Thuram", num: 9, club: "אינטר" }],
          FW: [{ name: "אמבפה", nameEn: "Mbappé", num: 10, club: "ריאל מדריד" }],
        },
      },
      transfermarkt: {
        formation: "4-3-3",
        players: {
          GK: [{ name: "מנייאן", nameEn: "Maignan", num: 16, club: "מילאן" }],
          DEF: [{ name: "קונדה", nameEn: "Koundé", num: 5, club: "ברצלונה" }, { name: "אופמקאנו", nameEn: "Upamecano", num: 4, club: "באיירן" }, { name: "סליבה", nameEn: "Saliba", num: 17, club: "ארסנל" }, { name: "תאו", nameEn: "T. Hernández", num: 22, club: "מילאן" }],
          MID: [{ name: "טשואמני", nameEn: "Tchouaméni", num: 8, club: "ריאל מדריד" }, { name: "ראביו", nameEn: "Rabiot", num: 14, club: "מרסיי" }, { name: "גריזמן", nameEn: "Griezmann", num: 7, club: "אתלטיקו" }],
          FW: [{ name: "דמבלה", nameEn: "Dembélé", num: 11, club: "פריז" }, { name: "אמבפה", nameEn: "Mbappé", num: 10, club: "ריאל מדריד" }, { name: "טורם", nameEn: "Thuram", num: 9, club: "אינטר" }],
        },
      },
    },
    fullSquad: [],
  },
  {
    code: "BRA", flag: "🇧🇷", name: "ברזיל", nameEn: "Brazil", coach: "דוריבאל ג׳וניור", ranking: 5, group: "E",
    lineups: {
      sofascore: {
        formation: "4-2-3-1",
        players: {
          GK: [{ name: "אליסון", nameEn: "Alisson", num: 1, club: "ליברפול" }],
          DEF: [{ name: "דניאלו", nameEn: "Danilo", num: 2, club: "סנטוס" }, { name: "מרקיניוס", nameEn: "Marquinhos", num: 4, club: "פריז" }, { name: "גבריאל", nameEn: "Gabriel", num: 3, club: "ארסנל" }, { name: "וונדל", nameEn: "Wendell", num: 6, club: "פורטו" }],
          MID: [{ name: "גימראאש", nameEn: "B. Guimarães", num: 5, club: "ניוקאסל" }, { name: "אנדרה", nameEn: "André", num: 8, club: "וולברהמפטון" }, { name: "סאביניו", nameEn: "Savinho", num: 18, club: "מנ׳ סיטי" }, { name: "פאקטה", nameEn: "Paquetá", num: 10, club: "ווסטהאם" }, { name: "רודריגו", nameEn: "Rodrygo", num: 7, club: "ריאל מדריד" }],
          FW: [{ name: "וינסיוס", nameEn: "Vinícius Jr.", num: 11, club: "ריאל מדריד" }],
        },
      },
      fotmob: {
        formation: "4-3-3",
        players: {
          GK: [{ name: "אליסון", nameEn: "Alisson", num: 1, club: "ליברפול" }],
          DEF: [{ name: "דניאלו", nameEn: "Danilo", num: 2, club: "סנטוס" }, { name: "מרקיניוס", nameEn: "Marquinhos", num: 4, club: "פריז" }, { name: "גבריאל", nameEn: "Gabriel", num: 3, club: "ארסנל" }, { name: "וונדל", nameEn: "Wendell", num: 6, club: "פורטו" }],
          MID: [{ name: "גימראאש", nameEn: "B. Guimarães", num: 5, club: "ניוקאסל" }, { name: "פאקטה", nameEn: "Paquetá", num: 10, club: "ווסטהאם" }, { name: "אנדרה", nameEn: "André", num: 8, club: "וולברהמפטון" }],
          FW: [{ name: "רודריגו", nameEn: "Rodrygo", num: 7, club: "ריאל מדריד" }, { name: "וינסיוס", nameEn: "Vinícius Jr.", num: 11, club: "ריאל מדריד" }, { name: "אנדריק", nameEn: "Endrick", num: 9, club: "ריאל מדריד" }],
        },
      },
      transfermarkt: {
        formation: "4-2-3-1",
        players: {
          GK: [{ name: "אליסון", nameEn: "Alisson", num: 1, club: "ליברפול" }],
          DEF: [{ name: "מיליטאו", nameEn: "Militão", num: 2, club: "ריאל מדריד" }, { name: "מרקיניוס", nameEn: "Marquinhos", num: 4, club: "פריז" }, { name: "גבריאל", nameEn: "Gabriel", num: 3, club: "ארסנל" }, { name: "וונדל", nameEn: "Wendell", num: 6, club: "פורטו" }],
          MID: [{ name: "גימראאש", nameEn: "B. Guimarães", num: 5, club: "ניוקאסל" }, { name: "אנדרה", nameEn: "André", num: 8, club: "וולברהמפטון" }, { name: "סאביניו", nameEn: "Savinho", num: 18, club: "מנ׳ סיטי" }, { name: "פאקטה", nameEn: "Paquetá", num: 10, club: "ווסטהאם" }, { name: "רודריגו", nameEn: "Rodrygo", num: 7, club: "ריאל מדריד" }],
          FW: [{ name: "וינסיוס", nameEn: "Vinícius Jr.", num: 11, club: "ריאל מדריד" }],
        },
      },
    },
    fullSquad: [],
  },
];

// ============================================================================
// Pitch Formation Component
// ============================================================================
function PitchFormation({ formation, players }: { formation: string; players: LineupData["players"] }) {
  const rows = [
    { pos: "GK" as const, data: players.GK, top: "85%" },
    { pos: "DEF" as const, data: players.DEF, top: "65%" },
    { pos: "MID" as const, data: players.MID, top: "38%" },
    { pos: "FW" as const, data: players.FW, top: "12%" },
  ];

  return (
    <div className="relative w-full aspect-[68/100] rounded-2xl overflow-hidden shadow-lg" style={{ background: "linear-gradient(180deg, #1a7a3a 0%, #22883f 25%, #1e7e38 50%, #22883f 75%, #1a7a3a 100%)" }}>
      {/* Pitch stripes */}
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
        <div key={i} className="absolute left-0 right-0 h-[10%]" style={{ top: `${i * 10}%`, background: i % 2 === 0 ? "rgba(255,255,255,0.03)" : "transparent" }} />
      ))}

      {/* Pitch markings */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 680 1000" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Outer border */}
        <rect x="40" y="20" width="600" height="960" stroke="white" strokeOpacity="0.35" strokeWidth="3" rx="4" />
        {/* Center line */}
        <line x1="40" y1="500" x2="640" y2="500" stroke="white" strokeOpacity="0.35" strokeWidth="2" />
        {/* Center circle */}
        <circle cx="340" cy="500" r="80" stroke="white" strokeOpacity="0.35" strokeWidth="2" />
        <circle cx="340" cy="500" r="4" fill="white" fillOpacity="0.5" />
        {/* Top penalty box */}
        <rect x="160" y="20" width="360" height="160" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
        <rect x="240" y="20" width="200" height="60" stroke="white" strokeOpacity="0.2" strokeWidth="2" />
        <circle cx="340" cy="140" r="4" fill="white" fillOpacity="0.3" />
        {/* Bottom penalty box */}
        <rect x="160" y="820" width="360" height="160" stroke="white" strokeOpacity="0.3" strokeWidth="2" />
        <rect x="240" y="920" width="200" height="60" stroke="white" strokeOpacity="0.2" strokeWidth="2" />
        <circle cx="340" cy="860" r="4" fill="white" fillOpacity="0.3" />
      </svg>

      {/* Players */}
      {rows.map((row) => (
        <div key={row.pos} className="absolute left-0 right-0 flex justify-around items-center px-4 sm:px-6" style={{ top: row.top, transform: "translateY(-50%)" }}>
          {row.data.map((p) => (
            <div key={p.num} className="flex flex-col items-center gap-1 group">
              {/* Player circle with photo */}
              <div className="relative w-13 h-13 sm:w-14 sm:h-14">
                <div className="w-full h-full rounded-full bg-white shadow-lg border-2 border-white overflow-hidden group-hover:scale-110 transition-transform">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(p.nameEn)}&background=1e3a5f&color=fff&size=112&bold=true&font-size=0.35`}
                    alt={p.nameEn}
                    className="w-full h-full object-cover"
                  />
                </div>
                {/* Jersey number badge */}
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center">
                  <span className="text-[9px] font-bold text-blue-900" style={{ fontFamily: "Inter" }}>{p.num}</span>
                </div>
              </div>
              {/* Name — bigger and clearer */}
              <div className="bg-black/50 backdrop-blur-sm rounded-md px-1.5 py-0.5">
                <span className="text-[11px] sm:text-xs font-bold text-white text-center leading-tight block">
                  {p.nameEn}
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}

      {/* Formation badge */}
      <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm rounded-full px-2.5 py-1">
        <span className="text-[11px] font-bold text-white" style={{ fontFamily: "Inter" }}>{formation}</span>
      </div>
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================
export function SquadsPage() {
  const [selectedCode, setSelectedCode] = useState("ARG");
  const [source, setSource] = useState<Source>("sofascore");
  const team = TEAMS.find(t => t.code === selectedCode) || TEAMS[0];
  const lineup = team.lineups[source];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">נבחרות וסגלים</h1>
        <p className="text-sm text-gray-500 mt-1">הרכבי פתיחה משוערים לפי 3 מקורות שונים</p>
      </div>

      {/* Team selector */}
      <div className="mb-4">
        <select value={selectedCode} onChange={(e) => setSelectedCode(e.target.value)}
          className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {TEAMS.map(t => <option key={t.code} value={t.code}>{t.flag} {t.name} ({t.nameEn})</option>)}
        </select>
      </div>

      {/* Team header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-4">
          <span className="text-5xl">{team.flag}</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{team.name}</h2>
            <p className="text-sm text-gray-500">{team.nameEn}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 flex-wrap">
              <span>🏟️ בית {team.group}</span>
              <span>📊 FIFA #{team.ranking}</span>
              <span>👔 {team.coach}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Source selector */}
      <div className="mb-5">
        <p className="text-xs text-gray-400 mb-2">מקור ההרכב המשוער:</p>
        <div className="flex gap-2">
          {SOURCES.map(s => (
            <button key={s.key} onClick={() => setSource(s.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                source === s.key
                  ? "bg-blue-50 border-blue-300 text-blue-700 shadow-sm"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50"
              }`}>
              <span>{s.logo}</span>
              <span>{s.name}</span>
              {source === s.key && <span className="text-xs">✓</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Formation label */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-bold text-gray-700">מערך: {lineup.formation}</span>
        <span className="text-xs text-gray-400">לפי {SOURCES.find(s => s.key === source)?.name}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Pitch */}
        <PitchFormation formation={lineup.formation} players={lineup.players} />

        {/* Starting XI list + full squad */}
        <div className="space-y-4">
          {/* Starting XI */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">הרכב פתיחה — {SOURCES.find(s => s.key === source)?.name}</span>
              <span className="text-[10px] text-gray-400">{lineup.formation}</span>
            </div>
            {(["GK", "DEF", "MID", "FW"] as const).map(pos => (
              <div key={pos}>
                <div className="px-4 py-1 bg-gray-50/50 border-b border-gray-50">
                  <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider" style={{ fontFamily: "Inter" }}>
                    {pos === "GK" ? "GOALKEEPER" : pos === "DEF" ? "DEFENDERS" : pos === "MID" ? "MIDFIELDERS" : "FORWARDS"}
                  </span>
                </div>
                {lineup.players[pos].map(p => (
                  <div key={p.num} className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                    <span className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-700" style={{ fontFamily: "Inter" }}>{p.num}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm text-gray-900">{p.name}</span>
                      <span className="text-xs text-gray-400 ms-1.5">{p.nameEn}</span>
                    </div>
                    <span className="text-xs text-gray-400 truncate max-w-[100px]">{p.club}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Full squad (if available) */}
          {team.fullSquad.length > 0 && (
            <details className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <summary className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700">
                📋 סגל מלא ({team.fullSquad.length} שחקנים)
              </summary>
              <div className="border-t border-gray-100">
                {team.fullSquad.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 last:border-0 text-xs">
                    <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500" style={{ fontFamily: "Inter" }}>{p.num}</span>
                    <span className="font-medium text-gray-800 flex-1">{p.name}</span>
                    <span className="text-gray-400 w-10 text-center">{p.pos}</span>
                    <span className="text-gray-400 truncate max-w-[90px]">{p.club}</span>
                    <span className="text-gray-300 w-8 text-center">{p.age}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>

      <p className="text-[10px] text-gray-400 mt-4 text-center">* ההרכבים המשוערים מבוססים על מקורות שונים ועשויים להשתנות. עדכון אחרון: אפריל 2026</p>
    </div>
  );
}
