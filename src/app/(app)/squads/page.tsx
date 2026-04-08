"use client";

import { useState } from "react";
import { ALL_TEAMS } from "@/lib/tournament/groups";
import { SQUADS_DATA, getSquad, getAvailableSquads } from "@/lib/tournament/squads-data";
import { getTeamColor } from "@/lib/team-colors";
import { PageTransition } from "@/components/shared/PageTransition";

const F: Record<string,string> = {
  MEX:"🇲🇽",KOR:"🇰🇷",CZE:"🇨🇿",RSA:"🇿🇦",CAN:"🇨🇦",QAT:"🇶🇦",SUI:"🇨🇭",BIH:"🇧🇦",
  BRA:"🇧🇷",MAR:"🇲🇦",SCO:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",HAI:"🇭🇹",USA:"🇺🇸",PAR:"🇵🇾",TUR:"🇹🇷",AUS:"🇦🇺",
  GER:"🇩🇪",ECU:"🇪🇨",CIV:"🇨🇮",CUR:"🇨🇼",NED:"🇳🇱",JPN:"🇯🇵",SWE:"🇸🇪",TUN:"🇹🇳",
  BEL:"🇧🇪",IRN:"🇮🇷",EGY:"🇪🇬",NZL:"🇳🇿",ESP:"🇪🇸",URU:"🇺🇾",KSA:"🇸🇦",CPV:"🇨🇻",
  FRA:"🇫🇷",SEN:"🇸🇳",NOR:"🇳🇴",IRQ:"🇮🇶",ARG:"🇦🇷",AUT:"🇦🇹",ALG:"🇩🇿",JOR:"🇯🇴",
  POR:"🇵🇹",COL:"🇨🇴",UZB:"🇺🇿",COD:"🇨🇩",ENG:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",CRO:"🇭🇷",GHA:"🇬🇭",PAN:"🇵🇦",
};

const SOURCES = ["SofaScore", "FotMob", "Transfermarkt", "WhoScored"];

function PitchFormation({ players, formation, teamColor }: { players: { nameEn: string; num: number; pos: string; photo?: string }[]; formation: string; teamColor: string }) {
  const gk = players.filter(p => p.pos === "GK");
  const def = players.filter(p => p.pos === "DEF");
  const mid = players.filter(p => p.pos === "MID");
  const fw = players.filter(p => p.pos === "FW");
  const rows = [
    { data: gk, top: "85%" }, { data: def, top: "65%" },
    { data: mid, top: "38%" }, { data: fw, top: "12%" },
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
              {p.photo ? (
                <img src={p.photo} alt={p.nameEn} className="w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-lg border-2 border-white object-cover" />
              ) : (
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full shadow-lg flex items-center justify-center text-xs sm:text-sm font-black border-2 border-white"
                  style={{ background: teamColor, color: "white", fontFamily: "var(--font-inter)" }}>
                  {p.num}
                </div>
              )}
              <div className="bg-black/50 backdrop-blur-sm rounded-md px-1.5 py-0.5">
                <span className="text-[9px] sm:text-xs font-bold text-white text-center block">{p.nameEn}</span>
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
  const [sourceIdx, setSourceIdx] = useState(0);
  const team = ALL_TEAMS.find(t => t.code === selected);
  const squad = getSquad(selected);
  const availableSquads = getAvailableSquads();
  const teamColors = getTeamColor(selected);

  // Get starters based on selected source
  const source = squad?.sources[sourceIdx];
  const starterNames = source?.starters || [];
  const starters = squad?.players.filter(p => starterNames.includes(p.nameEn)) || [];
  // Fill to 11 if source doesn't match all names
  const startersForPitch = starters.length >= 11 ? starters : (squad?.players.filter(p => p.starter) || []);

  return (
    <PageTransition>
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
      <div className="mb-5">
        <h1 className="text-3xl font-black text-gray-900 dark:text-white" style={{ fontFamily: "var(--font-secular)" }}>נבחרות וסגלים</h1>
        <p className="text-base text-gray-600 dark:text-gray-300 mt-1">הרכבי פתיחה משוערים לפי 4 מקורות מובילים</p>
      </div>

      {/* Team selector */}
      <div className="mb-4">
        <select value={selected} onChange={e => { setSelected(e.target.value); setSourceIdx(0); }}
          className="w-full sm:w-auto px-4 py-3 rounded-xl border border-gray-200 bg-white text-base font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {ALL_TEAMS.map(t => (
            <option key={t.code} value={t.code}>
              {F[t.code] || "🏳️"} {t.name_he} ({t.code})
            </option>
          ))}
        </select>
      </div>

      {/* Team header with team color accent */}
      {team && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
          <div className="h-2" style={{ background: teamColors.primary }}></div>
          <div className="p-5 flex items-center gap-4">
            <span className="text-6xl">{F[selected]}</span>
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white">{team.name_he}</h2>
              <p className="text-base text-gray-500">{team.name}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-500 flex-wrap">
                <span>בית {team.group_id}</span>
                <span>FIFA #{team.fifa_ranking}</span>
                {squad && <span>מאמן: {squad.coach}</span>}
                {squad && <span>מערך: {source?.formation || squad.formation}</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {squad ? (
        <>
          {/* Source selector — 4 tabs (only for teams with manual source data) */}
          {squad.sources.length > 0 && (
          <div className="mb-5">
            <p className="text-sm text-gray-500 mb-2 font-medium">מקור ההרכב המשוער:</p>
            <div className="flex gap-2 flex-wrap">
              {squad.sources.map((s, i) => (
                <button key={s.name} onClick={() => setSourceIdx(i)}
                  className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                    sourceIdx === i ? "bg-white border-blue-300 text-blue-700 shadow-md" : "border-gray-200 text-gray-500 hover:bg-gray-50"
                  }`}>
                  {s.name}
                  <span className="text-[10px] text-gray-400 font-normal">{s.formation}</span>
                </button>
              ))}
            </div>
          </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Pitch */}
            <PitchFormation
              players={startersForPitch}
              formation={source?.formation || squad.formation}
              teamColor={teamColors.primary}
            />

            {/* Squad list */}
            <div className="space-y-4">
              {/* Starting XI from selected source */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between" style={{ background: `${teamColors.primary}15` }}>
                  <div>
                    <p className="text-base font-bold text-gray-800 dark:text-white">הרכב פתיחה — {source?.name}</p>
                    <p className="text-sm text-gray-500">{source?.formation}</p>
                  </div>
                </div>
                {(["GK", "DEF", "MID", "FW"] as const).map(pos => {
                  const posPlayers = startersForPitch.filter(p => p.pos === pos);
                  if (!posPlayers.length) return null;
                  return (
                    <div key={pos}>
                      <div className="px-4 py-1.5 bg-gray-50 dark:bg-gray-700 border-b border-gray-100">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider" style={{ fontFamily: "var(--font-inter)" }}>
                          {pos === "GK" ? "שוער" : pos === "DEF" ? "הגנה" : pos === "MID" ? "קישור" : "התקפה"}
                        </span>
                      </div>
                      {posPlayers.map(p => (
                        <div key={p.num} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          {p.photo ? (
                            <img src={p.photo} alt={p.nameEn} className="w-9 h-9 rounded-full object-cover border-2 border-white shadow-sm" />
                          ) : (
                            <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: teamColors.primary, fontFamily: "var(--font-inter)" }}>{p.num}</span>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="font-bold text-sm text-gray-900">{p.name !== p.nameEn ? p.name : ""}</span>
                            <span className="text-sm text-gray-500 ms-1">{p.nameEn}</span>
                          </div>
                          <span className="text-xs text-gray-400 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>#{p.num}</span>
                          {p.club && <span className="text-xs text-gray-400 hidden sm:block">{p.club}</span>}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* Full squad — expandable bench */}
              {squad.players.length > 11 && (
                <details className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <summary className="px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors flex items-center justify-between">
                    <span className="font-bold text-base text-gray-800 dark:text-white">ספסל ושאר הסגל ({squad.players.length - startersForPitch.length})</span>
                    <span className="text-sm text-gray-400">לחצו לפתיחה</span>
                  </summary>
                  <div className="border-t border-gray-100">
                    {squad.players.filter(p => !starterNames.includes(p.nameEn) && !p.starter).map(p => (
                      <div key={`${p.num}-${p.nameEn}`} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        {p.photo ? (
                          <img src={p.photo} alt={p.nameEn} className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                        ) : (
                          <span className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500" style={{ fontFamily: "var(--font-inter)" }}>{p.num}</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="font-bold text-sm text-gray-800">{p.name !== p.nameEn ? p.name : ""}</span>
                          <span className="text-sm text-gray-400 ms-1">{p.nameEn}</span>
                        </div>
                        <span className="text-xs text-gray-400">{p.pos}</span>
                        <span className="text-xs text-gray-400 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>#{p.num}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-500 text-lg mb-2">סגל הנבחרת הזו יתעדכן בקרוב</p>
          <p className="text-sm text-gray-400">סגלים רשמיים יפורסמו ~2 שבועות לפני הטורניר</p>
          <p className="text-sm text-gray-400 mt-1">כרגע זמינים: {availableSquads.map(c => `${F[c]} ${c}`).join(", ")}</p>
        </div>
      )}
    </div>
    </PageTransition>
  );
}
