"use client";

import Link from "next/link";
import { useState, useCallback, memo } from "react";
import { useBettingStore } from "@/stores/betting-store";
import { GROUPS } from "@/lib/tournament/groups";
import { getFlag } from "@/lib/flags";
import { PageTransition } from "@/components/shared/PageTransition";
import { SaveAndContinue } from "@/components/shared/SaveAndContinue";

// R32 matchups — map to FIFA's official WC2026 schedule M73-M88.
//
// W/RU pairings (8 of 16) are exactly as FIFA publishes. Example:
//   M73 = 2A v 2B     → r32l_0 ✓
//   M75 = 1F v 2C     → r32l_2 ✓
//   M83 = 2K v 2L     → r32r_2 ✓
//
// 3rd-place slots (8 of 16) are FIFA's "best-of" buckets (e.g. M74 pulls
// its 3rd from the set {A,B,C,D,F} via the 495-row Annex C permutation
// table). For a friends' betting pool we collapse each bucket to a single
// representative group — user predicts that group's 3rd to be among the
// best 8, and the bracket uses it directly. Not strictly FIFA-compliant,
// but the standard simplification for casual pools and much easier to
// reason about when placing bets.
//
// If we ever want full Annex C compliance:
//   1. Compute a virtual 3rd-place standings table from group.scores
//   2. Take the top-8 qualifying groups
//   3. Look up the permutation key in Annex C → returns which group's 3rd
//      goes into each of the 8 slots
// Leaving that for post-demo.
const R32_MATCHUPS = [
  // Left half (M73-M80)
  { key: "r32l_0", h: "A2", a: "B2" }, // M73: 2A v 2B
  { key: "r32l_1", h: "E1", a: "D3" }, // M74: 1E v 3{A,B,C,D,F} — using D3
  { key: "r32l_2", h: "F1", a: "C2" }, // M75: 1F v 2C
  { key: "r32l_3", h: "C1", a: "F2" }, // M76: 1C v 2F
  { key: "r32l_4", h: "A1", a: "C3" }, // M79: 1A v 3{C,E,F,H,I} — using C3
  { key: "r32l_5", h: "H1", a: "J2" }, // M84: 1H v 2J
  { key: "r32l_6", h: "B1", a: "E3" }, // M85: 1B v 3{E,F,G,I,J} — using E3
  { key: "r32l_7", h: "D2", a: "G2" }, // M88: 2D v 2G
  // Right half (M81-M88)
  { key: "r32r_0", h: "I1", a: "F3" }, // M77: 1I v 3{C,D,F,G,H} — using F3
  { key: "r32r_1", h: "G1", a: "H3" }, // M82: 1G v 3{A,E,H,I,J} — using H3
  { key: "r32r_2", h: "K2", a: "L2" }, // M83: 2K v 2L
  { key: "r32r_3", h: "J1", a: "H2" }, // M86: 1J v 2H
  { key: "r32r_4", h: "D1", a: "B3" }, // M81: 1D v 3{B,E,F,I,J} — using B3
  { key: "r32r_5", h: "L1", a: "I3" }, // M80: 1L v 3{E,H,I,J,K} — using I3
  { key: "r32r_6", h: "E2", a: "I2" }, // M78: 2E v 2I
  { key: "r32r_7", h: "K1", a: "J3" }, // M87: 1K v 3{D,E,I,J,L} — using J3
];

// Resolve "A1" to actual team code from group standings
// Supports: "A1" (winner), "A2" (runner-up), "A3" (3rd place)
function resolveSlot(slot: string, groups: Record<string, { order: number[] }>): string | null {
  const groupLetter = slot[0];
  const position = parseInt(slot[1]) - 1; // "A1" → position 0, "A2" → 1, "A3" → 2
  const group = groups[groupLetter];
  if (!group) return null;
  const teamIndex = group.order[position];
  const groupTeams = GROUPS[groupLetter];
  if (!groupTeams || teamIndex === undefined) return null;
  return groupTeams[teamIndex]?.code || null;
}

interface MatchProps {
  matchKey: string;
  team1Code: string | null;
  team2Code: string | null;
  size?: "sm" | "md";
}

const BracketMatch = memo(function BracketMatch({ matchKey, team1Code, team2Code, size = "md" }: MatchProps) {
  const match = useBettingStore((s) => s.knockout[matchKey]);
  const setMatch = useBettingStore((s) => s.setKnockoutMatch);
  const py = size === "sm" ? "py-1.5" : "py-2";

  const setScore = (side: 1 | 2, delta: number) => {
    const s1 = side === 1 ? Math.max(0, (match?.score1 ?? 0) + delta) : (match?.score1 ?? 0);
    const s2 = side === 2 ? Math.max(0, (match?.score2 ?? 0) + delta) : (match?.score2 ?? 0);
    const winner = s1 > s2 ? team1Code : s2 > s1 ? team2Code : match?.winner || null;
    setMatch(matchKey, { score1: s1, score2: s2, winner });
  };

  const selectWinner = (code: string) => {
    setMatch(matchKey, { ...match, winner: code });
  };

  if (!team1Code || !team2Code) {
    return (
      <div className="bg-gray-50/80 rounded-lg border border-dashed border-gray-200">
        <div className={`px-2.5 ${py} text-sm text-gray-300 border-b border-dashed border-gray-200`}>ממתין...</div>
        <div className={`px-2.5 ${py} text-sm text-gray-300`}>ממתין...</div>
      </div>
    );
  }

  const stepper = (side: 1 | 2, score: number | null) => (
    <div className="flex items-center gap-0 rounded border border-gray-200 bg-white overflow-hidden" onClick={e => e.stopPropagation()}>
      <button onClick={() => setScore(side, -1)} aria-label="הפחת תוצאה" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 text-xs font-bold">−</button>
      <span className="w-5 h-8 flex items-center justify-center font-bold text-xs tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{score ?? 0}</span>
      <button onClick={() => setScore(side, 1)} aria-label="הוסף תוצאה" className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-gray-100 text-xs font-bold">+</button>
    </div>
  );

  const isWinner1 = match?.winner === team1Code;
  const isWinner2 = match?.winner === team2Code;
  const isTie = match?.score1 !== null && match?.score2 !== null && match?.score1 === match?.score2;

  return (
    <div className={`bg-white rounded-lg border overflow-hidden transition-all ${match?.winner ? "border-green-300 shadow-sm" : "border-gray-200 shadow-sm hover:shadow-md"}`}>
      <div onClick={() => selectWinner(team1Code)} className={`flex items-center gap-1.5 px-2 ${py} w-full cursor-pointer border-b border-gray-100 transition-colors ${isWinner1 ? "bg-green-50" : "hover:bg-gray-50"}`}>
        <span className="text-sm">{getFlag(team1Code)}</span>
        <span className={`text-sm font-bold flex-1 ${isWinner1 ? "text-green-700" : "text-gray-800"}`}>{team1Code}</span>
        {stepper(1, match?.score1 ?? null)}
        {isWinner1 && <span className="text-green-500 text-xs font-bold ms-0.5">✓</span>}
      </div>
      <div onClick={() => selectWinner(team2Code)} className={`flex items-center gap-1.5 px-2 ${py} w-full cursor-pointer transition-colors ${isWinner2 ? "bg-green-50" : "hover:bg-gray-50"}`}>
        <span className="text-sm">{getFlag(team2Code)}</span>
        <span className={`text-sm font-bold flex-1 ${isWinner2 ? "text-green-700" : "text-gray-800"}`}>{team2Code}</span>
        {stepper(2, match?.score2 ?? null)}
        {isWinner2 && <span className="text-green-500 text-xs font-bold ms-0.5">✓</span>}
      </div>
      {isTie && (
        <div className="text-center py-1 bg-amber-50 border-t border-amber-200">
          <span className="text-[10px] text-amber-700 font-bold">תיקו — לחצו על מי שעולה</span>
        </div>
      )}
    </div>
  );
});

function Connector() {
  return <div className="w-3 shrink-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>;
}

function RoundCol({ label, children, width }: { label: string; children: React.ReactNode; width: string }) {
  return (
    <div className={`flex flex-col ${width} shrink-0`}>
      <div className="text-center mb-3">
        <p className="text-xs font-black text-gray-600 uppercase tracking-widest" style={{ fontFamily: "var(--font-inter)" }}>{label}</p>
      </div>
      <div className="flex flex-col gap-1 flex-1 justify-around">{children}</div>
    </div>
  );
}

// Mobile view — shows one round at a time with tabs
interface MobileKnockoutViewProps {
  r32l: typeof R32_MATCHUPS;
  r32r: typeof R32_MATCHUPS;
  getR32Team: (slot: string) => string | null;
  getWinner: (matchKey: string) => string | null;
  knockout: Record<string, { score1: number | null; score2: number | null; winner: string | null }>;
  finalMatch?: { score1: number | null; score2: number | null; winner: string | null };
}

function MobileKnockoutView({ r32l, r32r, getR32Team, getWinner, knockout, finalMatch }: MobileKnockoutViewProps) {
  const [round, setRound] = useState("R32");
  const rounds = ["R32", "R16", "QF", "SF", "Final"];

  return (
    <div>
      {/* Round tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {rounds.map(r => (
          <button key={r} onClick={() => setRound(r)}
            className={`px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap transition-all ${
              round === r ? "bg-gray-900 text-white shadow-md" : "bg-gray-100 text-gray-500"
            }`}>{r === "Final" ? "גמר" : r}</button>
        ))}
      </div>

      {/* Matches for selected round */}
      <div className="space-y-2">
        {round === "R32" && (
          <>
            <p className="text-sm text-gray-500 mb-2">16 משחקים — שמינית גמר</p>
            {[...r32l, ...r32r].map((m) => (
              <BracketMatch key={m.key} matchKey={m.key} team1Code={getR32Team(m.h)} team2Code={getR32Team(m.a)} size="md" />
            ))}
          </>
        )}
        {round === "R16" && (
          <>
            <p className="text-sm text-gray-500 mb-2">8 משחקים — רבע</p>
            {[0,1,2,3].map(i => (
              <BracketMatch key={`r16l_${i}`} matchKey={`r16l_${i}`} team1Code={getWinner(`r32l_${i*2}`)} team2Code={getWinner(`r32l_${i*2+1}`)} />
            ))}
            {[0,1,2,3].map(i => (
              <BracketMatch key={`r16r_${i}`} matchKey={`r16r_${i}`} team1Code={getWinner(`r32r_${i*2}`)} team2Code={getWinner(`r32r_${i*2+1}`)} />
            ))}
          </>
        )}
        {round === "QF" && (
          <>
            <p className="text-sm text-gray-500 mb-2">4 משחקים — רבע גמר</p>
            {[0,1].map(i => <BracketMatch key={`qfl_${i}`} matchKey={`qfl_${i}`} team1Code={getWinner(`r16l_${i*2}`)} team2Code={getWinner(`r16l_${i*2+1}`)} />)}
            {[0,1].map(i => <BracketMatch key={`qfr_${i}`} matchKey={`qfr_${i}`} team1Code={getWinner(`r16r_${i*2}`)} team2Code={getWinner(`r16r_${i*2+1}`)} />)}
          </>
        )}
        {round === "SF" && (
          <>
            <p className="text-sm text-gray-500 mb-2">2 משחקים — חצי גמר</p>
            <BracketMatch matchKey="sfl_0" team1Code={getWinner("qfl_0")} team2Code={getWinner("qfl_1")} />
            <BracketMatch matchKey="sfr_0" team1Code={getWinner("qfr_0")} team2Code={getWinner("qfr_1")} />
          </>
        )}
        {round === "Final" && (
          <>
            <p className="text-sm text-gray-500 mb-2">גמר המונדיאל</p>
            <BracketMatch matchKey="final" team1Code={getWinner("sfl_0")} team2Code={getWinner("sfr_0")} />
            {knockout.final?.winner && (
              <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4 text-center">
                <p className="text-base text-amber-700 font-bold">אלוף העולם 2026</p>
                <p className="text-2xl font-black text-amber-900 mt-1">{getFlag(knockout.final.winner)} {knockout.final.winner}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function KnockoutPage() {
  const groups = useBettingStore((s) => s.groups);
  const knockout = useBettingStore((s) => s.knockout);
  const filledKnockout = Object.values(knockout).filter(m => m.winner).length;

  // Resolve R32 teams from group standings
  const getR32Team = (slot: string) => resolveSlot(slot, groups);

  // Get winner of a knockout match
  const getWinner = (key: string) => knockout[key]?.winner || null;

  return (
    <PageTransition>
    <div className="max-w-full mx-auto px-4 py-6 pb-24">
      <div className="mb-4">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>עץ הנוק-אאוט</h1>
        <p className="text-lg text-gray-600 mt-1">לחצו על נבחרת כדי לבחור מי עולה, +/- להזנת תוצאה</p>
      </div>

      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
          <span className="text-sm font-bold text-gray-700">התקדמות:</span>
          <span className="text-sm font-black text-blue-600" style={{ fontFamily: "var(--font-inter)" }}>{filledKnockout}/31</span>
          <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(filledKnockout / 31) * 100}%` }}></div>
          </div>
        </div>
        <p className="text-sm text-gray-500">המנצחת עוברת אוטומטית לשלב הבא</p>
      </div>

      {/* All-bracket-complete CTA → special bets */}
      {filledKnockout === 31 && (
        <Link
          href="/special-bets"
          className="mb-4 bg-gradient-to-l from-green-500 to-emerald-600 text-white rounded-xl px-5 py-4 flex items-center justify-between gap-3 shadow-lg shadow-green-500/20 hover:shadow-green-500/30 hover:scale-[1.01] transition-all"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-base font-black">סיימת את עץ הטורניר!</p>
              <p className="text-sm text-purple-50">המשך לשלב 3 — הימורים מיוחדים</p>
            </div>
          </div>
          <span className="text-2xl font-black">←</span>
        </Link>
      )}

      {/* Mobile: Round-by-round tabs */}
      <div className="sm:hidden mb-4">
        <MobileKnockoutView
          r32l={R32_MATCHUPS.slice(0, 8)} r32r={R32_MATCHUPS.slice(8, 16)}
          getR32Team={getR32Team} getWinner={getWinner}
          knockout={knockout}
        />
      </div>

      {/* Desktop: Full bracket tree */}
      <div className="hidden sm:block overflow-x-auto pb-4" dir="ltr">
        <div className="flex items-stretch justify-center gap-0 mx-auto" style={{ minHeight: "700px", minWidth: "1150px" }}>

          {/* R32 Left */}
          <RoundCol label="R32" width="w-[120px]">
            {R32_MATCHUPS.slice(0, 8).map(m => (
              <BracketMatch key={m.key} matchKey={m.key} team1Code={getR32Team(m.h)} team2Code={getR32Team(m.a)} size="sm" />
            ))}
          </RoundCol>
          <Connector />

          {/* R16 Left */}
          <RoundCol label="R16" width="w-[130px]">
            {[0,1,2,3].map(i => (
              <BracketMatch key={`r16l_${i}`} matchKey={`r16l_${i}`}
                team1Code={getWinner(`r32l_${i*2}`)} team2Code={getWinner(`r32l_${i*2+1}`)} />
            ))}
          </RoundCol>
          <Connector />

          {/* QF Left */}
          <RoundCol label="QF" width="w-[130px]">
            {[0,1].map(i => (
              <BracketMatch key={`qfl_${i}`} matchKey={`qfl_${i}`}
                team1Code={getWinner(`r16l_${i*2}`)} team2Code={getWinner(`r16l_${i*2+1}`)} />
            ))}
          </RoundCol>
          <Connector />

          {/* SF Left */}
          <RoundCol label="SF" width="w-[130px]">
            <BracketMatch matchKey="sfl_0" team1Code={getWinner("qfl_0")} team2Code={getWinner("qfl_1")} />
          </RoundCol>
          <Connector />

          {/* FINAL */}
          <div className="flex flex-col items-center justify-center w-[150px] shrink-0 mx-1">
            <div className="mb-3 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-amber-100 to-amber-200 border-2 border-amber-300 flex items-center justify-center mb-2 shadow-lg">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              </div>
              <p className="text-sm font-black text-amber-800 uppercase tracking-wider" style={{ fontFamily: "var(--font-inter)" }}>FINAL</p>
            </div>
            <div className="w-full">
              <BracketMatch matchKey="final" team1Code={getWinner("sfl_0")} team2Code={getWinner("sfr_0")} />
            </div>
            <div className="mt-3 w-full rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/50 p-3 text-center shadow-sm">
              {knockout.final?.winner ? (
                <>
                  <p className="text-sm text-amber-700 font-semibold">אלוף העולם 2026</p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-2xl">{getFlag(knockout.final.winner)}</span>
                    <span className="text-xl font-black text-amber-900">{knockout.final.winner}</span>
                  </div>
                </>
              ) : (
                <><p className="text-sm text-amber-600 font-semibold">אלוף העולם 2026</p><p className="text-xl font-black text-amber-900 mt-0.5">?</p></>
              )}
            </div>
          </div>

          <Connector />

          {/* SF Right */}
          <RoundCol label="SF" width="w-[130px]">
            <BracketMatch matchKey="sfr_0" team1Code={getWinner("qfr_0")} team2Code={getWinner("qfr_1")} />
          </RoundCol>
          <Connector />

          {/* QF Right */}
          <RoundCol label="QF" width="w-[130px]">
            {[0,1].map(i => (
              <BracketMatch key={`qfr_${i}`} matchKey={`qfr_${i}`}
                team1Code={getWinner(`r16r_${i*2}`)} team2Code={getWinner(`r16r_${i*2+1}`)} />
            ))}
          </RoundCol>
          <Connector />

          {/* R16 Right */}
          <RoundCol label="R16" width="w-[130px]">
            {[0,1,2,3].map(i => (
              <BracketMatch key={`r16r_${i}`} matchKey={`r16r_${i}`}
                team1Code={getWinner(`r32r_${i*2}`)} team2Code={getWinner(`r32r_${i*2+1}`)} />
            ))}
          </RoundCol>
          <Connector />

          {/* R32 Right */}
          <RoundCol label="R32" width="w-[120px]">
            {R32_MATCHUPS.slice(8, 16).map(m => (
              <BracketMatch key={m.key} matchKey={m.key} team1Code={getR32Team(m.h)} team2Code={getR32Team(m.a)} size="sm" />
            ))}
          </RoundCol>
        </div>
      </div>

      <SaveAndContinue
        label={filledKnockout === 31 ? "💾 שמור והמשך להימורים מיוחדים" : "💾 שמור הימורים עד כה"}
        nextHref="/special-bets"
        nextLabel="המשך להימורים מיוחדים →"
        completion={Math.round((filledKnockout / 31) * 100)}
      />
    </div>
    </PageTransition>
  );
}
