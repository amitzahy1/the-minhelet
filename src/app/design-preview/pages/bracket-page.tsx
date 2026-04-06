"use client";

import { useState, useCallback } from "react";

// ============================================================================
// Bracket Page — Interactive, clickable, with score input
// Pre-tournament state: user clicks to select winner + enters scores
// ============================================================================

interface Team { flag: string; code: string; name?: string }
interface MatchSlot {
  team1: Team | null;
  team2: Team | null;
  score1: number | null;
  score2: number | null;
  winner: string | null;
}

const T = (flag: string, code: string, name?: string): Team => ({ flag, code, name });

function InteractiveMatch({ match, onChange, size = "md" }: {
  match: MatchSlot;
  onChange?: (updated: MatchSlot) => void;
  size?: "sm" | "md";
}) {
  const [expanded, setExpanded] = useState(false);
  const py = size === "sm" ? "py-1.5" : "py-2";
  const text = size === "sm" ? "text-sm" : "text-sm";

  if (!match.team1 && !match.team2) {
    return (
      <div className="bg-gray-50/80 rounded-lg border border-dashed border-gray-200">
        <div className={`px-3 ${py} text-sm text-gray-300 border-b border-dashed border-gray-200`}>ממתין...</div>
        <div className={`px-3 ${py} text-sm text-gray-300`}>ממתין...</div>
      </div>
    );
  }

  const t1 = match.team1, t2 = match.team2;
  const hasScores = match.score1 !== null && match.score2 !== null;

  const autoSelectWinner = (s1: number, s2: number, current: MatchSlot): string | null => {
    if (s1 > s2) return current.team1?.code ?? null;
    if (s2 > s1) return current.team2?.code ?? null;
    return current.winner; // tie — keep current selection (user picks penalty winner)
  };

  const selectWinner = (code: string) => {
    if (!onChange) return;
    onChange({ ...match, winner: code });
  };

  const setScore = (side: 1 | 2, delta: number) => {
    if (!onChange) return;
    const s1 = side === 1 ? Math.max(0, (match.score1 ?? 0) + delta) : (match.score1 ?? 0);
    const s2 = side === 2 ? Math.max(0, (match.score2 ?? 0) + delta) : (match.score2 ?? 0);
    const winner = autoSelectWinner(s1, s2, match);
    onChange({ ...match, score1: s1, score2: s2, winner });
  };

  // Score inline stepper (tiny, fits in row)
  const inlineStepper = (side: 1 | 2, score: number | null) => (
    <div className="flex items-center gap-0 rounded border border-gray-200 bg-white overflow-hidden" onClick={e => e.stopPropagation()}>
      <button onClick={() => setScore(side, -1)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:bg-gray-100 text-xs font-bold active:bg-gray-200">−</button>
      <span className="w-5 h-6 flex items-center justify-center font-bold text-xs tabular-nums text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>
        {score ?? 0}
      </span>
      <button onClick={() => setScore(side, 1)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:bg-gray-100 text-xs font-bold active:bg-gray-200">+</button>
    </div>
  );

  const isTie = match.score1 !== null && match.score2 !== null && match.score1 === match.score2;

  return (
    <div className={`bg-white rounded-lg border overflow-hidden transition-all ${
      match.winner ? "border-green-300 shadow-sm" : "border-gray-200 shadow-sm hover:shadow-md"
    }`}>
      {/* Team 1 row — flag, name, score stepper, click to select winner */}
      <button
        onClick={() => selectWinner(t1!.code)}
        className={`flex items-center gap-1.5 px-2 ${py} w-full text-start border-b border-gray-100 transition-colors ${
          match.winner === t1?.code ? "bg-green-50" : "hover:bg-gray-50"
        }`}
      >
        <span className={size === "sm" ? "text-sm" : "text-base"}>{t1?.flag}</span>
        <span className={`${text} font-bold flex-1 ${match.winner === t1?.code ? "text-green-700" : "text-gray-800"}`}>{t1?.code}</span>
        {onChange && inlineStepper(1, match.score1)}
        {!onChange && <span className="text-sm font-bold tabular-nums text-gray-500" style={{ fontFamily: "var(--font-inter)" }}>{match.score1 ?? "·"}</span>}
        {match.winner === t1?.code && <span className="text-green-500 text-xs font-bold ms-0.5">✓</span>}
      </button>

      {/* Team 2 row */}
      <button
        onClick={() => selectWinner(t2!.code)}
        className={`flex items-center gap-1.5 px-2 ${py} w-full text-start transition-colors ${
          match.winner === t2?.code ? "bg-green-50" : "hover:bg-gray-50"
        }`}
      >
        <span className={size === "sm" ? "text-sm" : "text-base"}>{t2?.flag}</span>
        <span className={`${text} font-bold flex-1 ${match.winner === t2?.code ? "text-green-700" : "text-gray-800"}`}>{t2?.code}</span>
        {onChange && inlineStepper(2, match.score2)}
        {!onChange && <span className="text-sm font-bold tabular-nums text-gray-500" style={{ fontFamily: "var(--font-inter)" }}>{match.score2 ?? "·"}</span>}
        {match.winner === t2?.code && <span className="text-green-500 text-xs font-bold ms-0.5">✓</span>}
      </button>

      {/* Tie — pick penalty winner */}
      {isTie && onChange && (
        <div className="text-center py-1 bg-amber-50 border-t border-amber-200">
          <span className="text-[10px] text-amber-700 font-bold">תיקו — לחצו על מי שעולה</span>
        </div>
      )}
    </div>
  );
}

function RoundCol({ label, matches, width, matchSize, gap, onMatchChange }: {
  label: string; matches: MatchSlot[]; width: string; matchSize: "sm" | "md"; gap: string;
  onMatchChange?: (idx: number, m: MatchSlot) => void;
}) {
  return (
    <div className={`flex flex-col ${width} shrink-0`}>
      <div className="text-center mb-3">
        <p className="text-xs font-black text-gray-600 uppercase tracking-widest" style={{ fontFamily: "Inter" }}>{label}</p>
      </div>
      <div className={`flex flex-col ${gap} flex-1 justify-around`}>
        {matches.map((m, i) => (
          <InteractiveMatch
            key={i}
            match={m}
            size={matchSize}
            onChange={onMatchChange ? (updated) => onMatchChange(i, updated) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function Connector() {
  return <div className="w-3 shrink-0 flex items-center"><div className="w-full border-t border-gray-200"></div></div>;
}

export function BracketPage() {
  // State for all matches
  const [r32L, setR32L] = useState<MatchSlot[]>([
    { team1: T("🇲🇦","MAR"), team2: T("🇺🇿","UZB"), score1: null, score2: null, winner: null },
    { team1: T("🇫🇷","FRA"), team2: T("🇸🇳","SEN"), score1: null, score2: null, winner: null },
    { team1: T("🇦🇷","ARG"), team2: T("🇨🇦","CAN"), score1: null, score2: null, winner: null },
    { team1: T("🇯🇵","JPN"), team2: T("🇨🇲","CMR"), score1: null, score2: null, winner: null },
    { team1: T("🇧🇷","BRA"), team2: T("🇹🇳","TUN"), score1: null, score2: null, winner: null },
    { team1: T("🇪🇸","ESP"), team2: T("🇺🇾","URU"), score1: null, score2: null, winner: null },
    { team1: T("🏴󠁧󠁢󠁥󠁮󠁧󠁿","ENG"), team2: T("🇵🇪","PER"), score1: null, score2: null, winner: null },
    { team1: T("🇵🇹","POR"), team2: T("🇰🇷","KOR"), score1: null, score2: null, winner: null },
  ]);
  const [r32R, setR32R] = useState<MatchSlot[]>([
    { team1: T("🇩🇪","GER"), team2: T("🇳🇬","NGA"), score1: null, score2: null, winner: null },
    { team1: T("🇳🇱","NED"), team2: T("🇨🇮","CIV"), score1: null, score2: null, winner: null },
    { team1: T("🇮🇹","ITA"), team2: T("🇪🇨","ECU"), score1: null, score2: null, winner: null },
    { team1: T("🇧🇪","BEL"), team2: T("🇮🇷","IRN"), score1: null, score2: null, winner: null },
    { team1: T("🇲🇽","MEX"), team2: T("🇩🇰","DEN"), score1: null, score2: null, winner: null },
    { team1: T("🇦🇺","AUS"), team2: T("🇷🇸","SRB"), score1: null, score2: null, winner: null },
    { team1: T("🇺🇸","USA"), team2: T("🇭🇷","CRO"), score1: null, score2: null, winner: null },
    { team1: T("🇨🇴","COL"), team2: T("🇨🇱","CHI"), score1: null, score2: null, winner: null },
  ]);

  // Derived rounds — auto-populate from winners
  const getWinnerTeam = (m: MatchSlot): Team | null => {
    if (!m.winner) return null;
    if (m.team1?.code === m.winner) return m.team1;
    if (m.team2?.code === m.winner) return m.team2;
    return null;
  };

  const [r16LOverrides, setR16LOverrides] = useState<Record<number, Partial<MatchSlot>>>({});
  const [r16ROverrides, setR16ROverrides] = useState<Record<number, Partial<MatchSlot>>>({});
  const [qfLOverrides, setQfLOverrides] = useState<Record<number, Partial<MatchSlot>>>({});
  const [qfROverrides, setQfROverrides] = useState<Record<number, Partial<MatchSlot>>>({});
  const [sfLOverrides, setSfLOverrides] = useState<Record<number, Partial<MatchSlot>>>({});
  const [sfROverrides, setSfROverrides] = useState<Record<number, Partial<MatchSlot>>>({});
  const [finalOverride, setFinalOverride] = useState<Partial<MatchSlot>>({});

  // Build R16 from R32 winners
  const r16L: MatchSlot[] = [0, 1, 2, 3].map((i) => ({
    team1: getWinnerTeam(r32L[i * 2]),
    team2: getWinnerTeam(r32L[i * 2 + 1]),
    score1: r16LOverrides[i]?.score1 ?? null,
    score2: r16LOverrides[i]?.score2 ?? null,
    winner: r16LOverrides[i]?.winner ?? null,
  }));
  const r16R: MatchSlot[] = [0, 1, 2, 3].map((i) => ({
    team1: getWinnerTeam(r32R[i * 2]),
    team2: getWinnerTeam(r32R[i * 2 + 1]),
    score1: r16ROverrides[i]?.score1 ?? null,
    score2: r16ROverrides[i]?.score2 ?? null,
    winner: r16ROverrides[i]?.winner ?? null,
  }));

  // Build QF from R16 winners
  const qfL: MatchSlot[] = [0, 1].map((i) => ({
    team1: getWinnerTeam(r16L[i * 2]),
    team2: getWinnerTeam(r16L[i * 2 + 1]),
    score1: qfLOverrides[i]?.score1 ?? null,
    score2: qfLOverrides[i]?.score2 ?? null,
    winner: qfLOverrides[i]?.winner ?? null,
  }));
  const qfR: MatchSlot[] = [0, 1].map((i) => ({
    team1: getWinnerTeam(r16R[i * 2]),
    team2: getWinnerTeam(r16R[i * 2 + 1]),
    score1: qfROverrides[i]?.score1 ?? null,
    score2: qfROverrides[i]?.score2 ?? null,
    winner: qfROverrides[i]?.winner ?? null,
  }));

  // SF
  const sfL: MatchSlot[] = [{
    team1: getWinnerTeam(qfL[0]),
    team2: getWinnerTeam(qfL[1]),
    score1: sfLOverrides[0]?.score1 ?? null,
    score2: sfLOverrides[0]?.score2 ?? null,
    winner: sfLOverrides[0]?.winner ?? null,
  }];
  const sfR: MatchSlot[] = [{
    team1: getWinnerTeam(qfR[0]),
    team2: getWinnerTeam(qfR[1]),
    score1: sfROverrides[0]?.score1 ?? null,
    score2: sfROverrides[0]?.score2 ?? null,
    winner: sfROverrides[0]?.winner ?? null,
  }];

  // Final
  const finalMatch: MatchSlot = {
    team1: getWinnerTeam(sfL[0]),
    team2: getWinnerTeam(sfR[0]),
    score1: finalOverride.score1 ?? null,
    score2: finalOverride.score2 ?? null,
    winner: finalOverride.winner ?? null,
  };

  const champion = getWinnerTeam(finalMatch);

  // Count filled
  const allMatches = [...r32L, ...r32R, ...r16L, ...r16R, ...qfL, ...qfR, ...sfL, ...sfR, finalMatch];
  const filled = allMatches.filter(m => m.winner).length;

  // Update handlers
  const updateR32L = useCallback((idx: number, m: MatchSlot) => {
    setR32L(prev => { const n = [...prev]; n[idx] = m; return n; });
  }, []);
  const updateR32R = useCallback((idx: number, m: MatchSlot) => {
    setR32R(prev => { const n = [...prev]; n[idx] = m; return n; });
  }, []);

  return (
    <div className="max-w-full mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular), sans-serif" }}>עץ הנוק-אאוט</h1>
        <p className="text-lg text-gray-600 mt-1">לחצו על נבחרת כדי לבחור מי עולה, השתמשו ב +/- להזנת תוצאה</p>
        <div className="flex gap-4 mt-2 text-sm text-gray-400" style={{ fontFamily: "Inter" }}>
          <span>R32/R16: טוטו <strong className="text-blue-600">3</strong> + מדויקת <strong className="text-green-600">1</strong></span>
          <span>QF: <strong className="text-blue-600">3</strong> + <strong className="text-green-600">1</strong></span>
          <span>SF: <strong className="text-blue-600">3</strong> + <strong className="text-green-600">2</strong></span>
          <span>גמר: <strong className="text-blue-600">4</strong> + <strong className="text-green-600">2</strong></span>
        </div>
      </div>

      {/* Compact inline progress + tip */}
      <div className="mb-4 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm">
          <span className="text-sm font-bold text-gray-700">התקדמות:</span>
          <span className="text-sm font-black text-blue-600" style={{ fontFamily: "var(--font-inter)" }}>{filled}/31</span>
          <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${filled === 31 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${(filled / 31) * 100}%` }}></div>
          </div>
        </div>
        <p className="text-sm text-gray-500">לחצו על נבחרת כדי לבחור מי עולה · +/- להזנת תוצאה · המנצחת עוברת אוטומטית</p>
      </div>

      {/* === BRACKET TREE === */}
      <div className="overflow-x-auto pb-4" dir="ltr">
        <div className="flex items-stretch justify-center gap-0 mx-auto" style={{ minHeight: "700px", minWidth: "1150px" }}>

          <RoundCol label="R32" matches={r32L} width="w-[120px]" matchSize="sm" gap="gap-1" onMatchChange={updateR32L} />
          <Connector />
          <RoundCol label="R16" matches={r16L} width="w-[130px]" matchSize="md" gap="gap-3"
            onMatchChange={(i, m) => setR16LOverrides(prev => ({ ...prev, [i]: m }))} />
          <Connector />
          <RoundCol label="QF" matches={qfL} width="w-[130px]" matchSize="md" gap="gap-6"
            onMatchChange={(i, m) => setQfLOverrides(prev => ({ ...prev, [i]: m }))} />
          <Connector />
          <RoundCol label="SF" matches={sfL} width="w-[130px]" matchSize="md" gap="gap-0"
            onMatchChange={(i, m) => setSfLOverrides(prev => ({ ...prev, [i]: m }))} />
          <Connector />

          {/* FINAL */}
          <div className="flex flex-col items-center justify-center w-[150px] shrink-0 mx-1">
            <div className="mb-3 text-center">
              <div className="w-14 h-14 mx-auto rounded-full bg-gradient-to-br from-amber-100 to-amber-200 border-2 border-amber-300 flex items-center justify-center mb-2 shadow-lg">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#92400E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
              </div>
              <p className="text-sm font-black text-amber-800 uppercase tracking-wider" style={{ fontFamily: "Inter" }}>FINAL</p>
            </div>
            <div className="w-full">
              <InteractiveMatch match={finalMatch} size="md"
                onChange={(m) => setFinalOverride(m)} />
            </div>
            <div className="mt-3 w-full rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100/50 p-3 text-center shadow-sm">
              {champion ? (
                <>
                  <p className="text-sm text-amber-700 font-semibold">אלוף העולם 2026</p>
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <span className="text-2xl">{champion.flag}</span>
                    <span className="text-xl font-black text-amber-900">{champion.code}</span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-amber-600 font-semibold">אלוף העולם 2026</p>
                  <p className="text-xl font-black text-amber-900 mt-0.5">?</p>
                </>
              )}
            </div>
          </div>

          <Connector />
          <RoundCol label="SF" matches={sfR} width="w-[130px]" matchSize="md" gap="gap-0"
            onMatchChange={(i, m) => setSfROverrides(prev => ({ ...prev, [i]: m }))} />
          <Connector />
          <RoundCol label="QF" matches={qfR} width="w-[130px]" matchSize="md" gap="gap-6"
            onMatchChange={(i, m) => setQfROverrides(prev => ({ ...prev, [i]: m }))} />
          <Connector />
          <RoundCol label="R16" matches={r16R} width="w-[130px]" matchSize="md" gap="gap-3"
            onMatchChange={(i, m) => setR16ROverrides(prev => ({ ...prev, [i]: m }))} />
          <Connector />
          <RoundCol label="R32" matches={r32R} width="w-[120px]" matchSize="sm" gap="gap-1" onMatchChange={updateR32R} />

        </div>
      </div>

      <p className="text-center text-sm text-gray-400 mt-2 sm:hidden">גללו הצידה לראות את כל העץ</p>
    </div>
  );
}
