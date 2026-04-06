"use client";

import { useState, useMemo, useCallback } from "react";

// ============================================================================
// Groups Page — CAROUSEL VIEW (one group at a time, swipe/arrows)
// Auto-calculating standings with FIFA tiebreakers
// Progress bars in header and per-group
// ============================================================================

const GROUPS_DATA: { id: string; teams: { flag: string; name: string; code: string }[] }[] = [
  { id: "A", teams: [{ flag: "🇲🇦", name: "מרוקו", code: "MAR" }, { flag: "🇵🇪", name: "פרו", code: "PER" }, { flag: "🇨🇦", name: "קנדה", code: "CAN" }, { flag: "🇧🇫", name: "בורקינה פאסו", code: "BFA" }] },
  { id: "B", teams: [{ flag: "🇫🇷", name: "צרפת", code: "FRA" }, { flag: "🇨🇴", name: "קולומביה", code: "COL" }, { flag: "🇭🇳", name: "הונדורס", code: "HON" }, { flag: "🇳🇿", name: "ניו זילנד", code: "NZL" }] },
  { id: "C", teams: [{ flag: "🇦🇷", name: "ארגנטינה", code: "ARG" }, { flag: "🇲🇽", name: "מקסיקו", code: "MEX" }, { flag: "🇺🇿", name: "אוזבקיסטן", code: "UZB" }, { flag: "🇮🇩", name: "אינדונזיה", code: "IDN" }] },
  { id: "D", teams: [{ flag: "🇯🇵", name: "יפן", code: "JPN" }, { flag: "🇦🇺", name: "אוסטרליה", code: "AUS" }, { flag: "🇧🇭", name: "בחריין", code: "BHR" }, { flag: "🏳️", name: "פלייאוף", code: "TBD" }] },
  { id: "E", teams: [{ flag: "🇧🇷", name: "ברזיל", code: "BRA" }, { flag: "🇪🇨", name: "אקוודור", code: "ECU" }, { flag: "🇯🇲", name: "ג׳מייקה", code: "JAM" }, { flag: "🇧🇴", name: "בוליביה", code: "BOL" }] },
  { id: "F", teams: [{ flag: "🇪🇸", name: "ספרד", code: "ESP" }, { flag: "🇨🇱", name: "צ׳ילה", code: "CHI" }, { flag: "🇨🇲", name: "קמרון", code: "CMR" }, { flag: "🇦🇱", name: "אלבניה", code: "ALB" }] },
  { id: "G", teams: [{ flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", name: "אנגליה", code: "ENG" }, { flag: "🇸🇳", name: "סנגל", code: "SEN" }, { flag: "🇩🇰", name: "דנמרק", code: "DEN" }, { flag: "🇸🇦", name: "ערב הסעודית", code: "KSA" }] },
  { id: "H", teams: [{ flag: "🇵🇹", name: "פורטוגל", code: "POR" }, { flag: "🇮🇷", name: "איראן", code: "IRN" }, { flag: "🇵🇾", name: "פרגוואי", code: "PAR" }, { flag: "🇨🇮", name: "חוף השנהב", code: "CIV" }] },
  { id: "I", teams: [{ flag: "🇩🇪", name: "גרמניה", code: "GER" }, { flag: "🇺🇾", name: "אורוגוואי", code: "URU" }, { flag: "🇺🇸", name: "ארה״ב", code: "USA" }, { flag: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", name: "וויילס", code: "WAL" }] },
  { id: "J", teams: [{ flag: "🇳🇱", name: "הולנד", code: "NED" }, { flag: "🇰🇷", name: "דרום קוריאה", code: "KOR" }, { flag: "🇵🇦", name: "פנמה", code: "PAN" }, { flag: "🇨🇷", name: "קוסטה ריקה", code: "CRC" }] },
  { id: "K", teams: [{ flag: "🇮🇹", name: "איטליה", code: "ITA" }, { flag: "🇷🇸", name: "סרביה", code: "SRB" }, { flag: "🇹🇳", name: "תוניסיה", code: "TUN" }, { flag: "🇹🇹", name: "טרינידד", code: "TRI" }] },
  { id: "L", teams: [{ flag: "🇧🇪", name: "בלגיה", code: "BEL" }, { flag: "🇭🇷", name: "קרואטיה", code: "CRO" }, { flag: "🇳🇬", name: "ניגריה", code: "NGA" }, { flag: "🇶🇦", name: "קטאר", code: "QAT" }] },
];

function generateMatchups(codes: string[]) {
  const [a, b, c, d] = codes;
  return [{ h: a, a: b }, { h: c, a: d }, { h: a, a: c }, { h: d, a: b }, { h: d, a: a }, { h: b, a: c }];
}

interface StandingRow {
  code: string; flag: string; name: string;
  played: number; won: number; drawn: number; lost: number;
  gf: number; ga: number; gd: number; pts: number;
}

function calculateStandings(
  teams: { flag: string; name: string; code: string }[],
  matchups: { h: string; a: string }[],
  scores: (number | null)[][]
): StandingRow[] {
  const stats: Record<string, StandingRow> = {};
  for (const t of teams) {
    stats[t.code] = { code: t.code, flag: t.flag, name: t.name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 };
  }
  matchups.forEach((m, i) => {
    const [hs, as] = scores[i];
    if (hs === null || as === null) return;
    const home = stats[m.h], away = stats[m.a];
    if (!home || !away) return;
    home.played++; away.played++;
    home.gf += hs; home.ga += as; away.gf += as; away.ga += hs;
    if (hs > as) { home.won++; home.pts += 3; away.lost++; }
    else if (hs < as) { away.won++; away.pts += 3; home.lost++; }
    else { home.drawn++; away.drawn++; home.pts++; away.pts++; }
  });
  for (const s of Object.values(stats)) s.gd = s.gf - s.ga;

  function h2h(a: string, b: string): number {
    let pA = 0, pB = 0, gA = 0, gB = 0;
    matchups.forEach((m, i) => {
      const [hs, as] = scores[i];
      if (hs === null || as === null) return;
      if (m.h === a && m.a === b) { gA += hs; gB += as; if (hs > as) pA += 3; else if (hs < as) pB += 3; else { pA++; pB++; } }
      else if (m.h === b && m.a === a) { gB += hs; gA += as; if (hs > as) pB += 3; else if (hs < as) pA += 3; else { pA++; pB++; } }
    });
    if (pA !== pB) return pB - pA;
    const gd = (gA - gB) - (gB - gA);
    if (gd !== 0) return gd > 0 ? -1 : 1;
    return gB - gA;
  }

  return Object.values(stats).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (b.gd !== a.gd) return b.gd - a.gd;
    if (b.gf !== a.gf) return b.gf - a.gf;
    const r = h2h(a.code, b.code);
    if (r !== 0) return r;
    return a.code.localeCompare(b.code);
  });
}

function ScoreStepper({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0 rounded border border-gray-200 overflow-hidden">
      <button onClick={() => onChange(Math.max(0, (value ?? 0) - 1))}
        className="w-7 h-8 flex items-center justify-center bg-gray-50 text-gray-400 text-sm font-bold hover:bg-gray-100 active:bg-gray-200">−</button>
      <span className="w-7 h-8 flex items-center justify-center font-bold text-base tabular-nums" style={{ fontFamily: "Inter" }}>
        {value !== null ? value : <span className="text-gray-300 text-sm">-</span>}
      </span>
      <button onClick={() => onChange((value ?? -1) + 1)}
        className="w-7 h-8 flex items-center justify-center bg-gray-50 text-gray-400 text-sm font-bold hover:bg-gray-100 active:bg-gray-200">+</button>
    </div>
  );
}

// ============================================================================
// Single Group View (carousel item)
// ============================================================================
function GroupView({ group, scores, onScoreChange, onOrderChange, order }: {
  group: typeof GROUPS_DATA[0];
  scores: (number | null)[][];
  onScoreChange: (matchIdx: number, side: 0 | 1, val: number) => void;
  onOrderChange: (newOrder: number[]) => void;
  order: number[];
}) {
  const teams = group.teams;
  const codes = teams.map(t => t.code);
  const matchups = useMemo(() => generateMatchups(codes), [codes.join(",")]);
  const standings = useMemo(() => calculateStandings(teams, matchups, scores), [teams, matchups, scores]);
  const filledCount = scores.filter(s => s[0] !== null && s[1] !== null).length;
  const isComplete = filledCount === 6;
  const hasAny = filledCount > 0;

  void order; void onOrderChange; // used for future drag-and-drop

  return (
    <div className="max-w-6xl mx-auto">
      {/* Group progress */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${isComplete ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${(filledCount / 6) * 100}%` }}></div>
        </div>
        <span className="text-[10px] text-gray-400" style={{ fontFamily: "Inter" }}>{filledCount}/6</span>
        {isComplete && <span className="text-[10px] text-green-600 font-medium">✓</span>}
      </div>

      {/* === LAYOUT: Right column (table+order) | Left column (bets, full height) === */}
      {/* Desktop: 2 symmetric columns. Mobile: stacked */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* RIGHT COLUMN — Calculated table (top) + Team ordering (bottom) */}
        <div className="space-y-4 order-1">

          {/* Calculated standings — ALWAYS ON TOP */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-gray-800">טבלה מחושבת</p>
                <p className="text-sm text-gray-500">מתעדכנת אוטומטית לפי חוקי FIFA</p>
              </div>
              {isComplete && <span className="text-sm text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full border border-green-200">סופי</span>}
              {!hasAny && <span className="text-sm text-gray-400">הזינו תוצאות כדי לראות טבלה</span>}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 bg-gray-50 text-xs font-semibold">
                  <th className="py-2.5 ps-4 text-start w-8">#</th>
                  <th className="py-2.5 text-start">קבוצה</th>
                  <th className="py-2.5 text-center w-8">מש</th>
                  <th className="py-2.5 text-center w-8">נצ</th>
                  <th className="py-2.5 text-center w-8">תק</th>
                  <th className="py-2.5 text-center w-8">הפ</th>
                  <th className="py-2.5 text-center w-12">שערים</th>
                  <th className="py-2.5 text-center w-12">הפרש</th>
                  <th className="py-2.5 pe-4 text-center w-12 font-bold">נקודות</th>
                </tr>
              </thead>
              <tbody>
                {(hasAny ? standings : teams.map((t, _i) => ({
                  code: t.code, flag: t.flag, name: t.name,
                  played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0,
                }))).map((row, i) => (
                  <tr key={row.code} className={`border-t border-gray-100 ${hasAny && i < 2 ? "bg-green-50/40" : hasAny && i === 2 ? "bg-amber-50/30" : ""}`}>
                    <td className="py-3 ps-4 font-bold text-gray-300 text-base">{i + 1}</td>
                    <td className="py-3">
                      <span className="flex items-center gap-2">
                        <span className="text-lg">{row.flag}</span>
                        <span className="font-bold text-gray-900">{row.name}</span>
                      </span>
                    </td>
                    <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.played}</td>
                    <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.won}</td>
                    <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.drawn}</td>
                    <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.lost}</td>
                    <td className="text-center text-gray-600 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{row.gf}:{row.ga}</td>
                    <td className="text-center text-gray-600 font-semibold" style={{ fontFamily: "var(--font-inter)" }}>{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                    <td className="pe-4 text-center font-black text-gray-900 text-base" style={{ fontFamily: "var(--font-inter)" }}>{row.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasAny && standings.some((s, i) => i > 0 && s.pts === standings[i-1].pts) && (
              <div className="px-5 py-2.5 bg-blue-50/30 border-t border-blue-100">
                <p className="text-xs text-gray-500 font-medium">שוברי שוויון לפי FIFA: נקודות → הפרש שערים → שערים שהובקעו → ראש בראש</p>
              </div>
            )}
          </div>

        </div>

        {/* LEFT COLUMN — Match bets (spans full height of right column) */}
        <div className="order-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden lg:sticky lg:top-20">
            <div className="px-5 py-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-gray-800">הימורי תוצאות</p>
                <p className="text-sm text-gray-500">הזינו תוצאה מדויקת לכל משחק</p>
              </div>
              <div className="text-sm text-gray-500 text-end leading-relaxed" style={{ fontFamily: "Inter" }}>
                <span className="block">טוטו נכון: <strong className="text-blue-600">2 נק׳</strong></span>
                <span className="block">מדויקת: <strong className="text-green-600">+1 נק׳</strong></span>
              </div>
            </div>
            <div className="p-3 space-y-1.5">
              {matchups.map((m, i) => {
                const ht = teams.find(t => t.code === m.h)!;
                const at = teams.find(t => t.code === m.a)!;
                const isFilled = scores[i][0] !== null && scores[i][1] !== null;
                return (
                  <div key={i} className={`rounded-lg border px-3 py-2 transition-colors ${
                    isFilled ? "bg-green-50/30 border-green-200" : "bg-gray-50/50 border-gray-100"
                  }`}>
                    <div className="flex items-center">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="text-lg shrink-0">{ht.flag}</span>
                        <span className="text-sm font-bold text-gray-900 truncate">{ht.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mx-2">
                        <ScoreStepper value={scores[i][0]} onChange={(v) => onScoreChange(i, 0, v)} />
                        <span className="text-gray-300 text-sm">:</span>
                        <ScoreStepper value={scores[i][1]} onChange={(v) => onScoreChange(i, 1, v)} />
                      </div>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                        <span className="text-lg shrink-0">{at.flag}</span>
                        <span className="text-sm font-bold text-gray-900 truncate">{at.name}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ============================================================================
// Groups Page — Carousel
// ============================================================================
export function GroupsPage() {
  const [currentGroup, setCurrentGroup] = useState(0);
  const [allScores, setAllScores] = useState<Record<string, (number | null)[][]>>(
    Object.fromEntries(GROUPS_DATA.map(g => [g.id, Array(6).fill(null).map(() => [null, null])]))
  );
  const [allOrders, setAllOrders] = useState<Record<string, number[]>>(
    Object.fromEntries(GROUPS_DATA.map(g => [g.id, [0, 1, 2, 3]]))
  );

  const group = GROUPS_DATA[currentGroup];

  const handleScoreChange = useCallback((matchIdx: number, side: 0 | 1, val: number) => {
    setAllScores(prev => {
      const next = { ...prev };
      const groupScores = prev[group.id].map(s => [...s]);
      groupScores[matchIdx][side] = val;
      if (groupScores[matchIdx][1 - side] === null) groupScores[matchIdx][1 - side] = 0;
      next[group.id] = groupScores;
      return next;
    });
  }, [group.id]);

  const handleOrderChange = useCallback((newOrder: number[]) => {
    setAllOrders(prev => ({ ...prev, [group.id]: newOrder }));
  }, [group.id]);

  // Global progress
  const totalFilled = Object.values(allScores).reduce((sum, gs) => sum + gs.filter(s => s[0] !== null && s[1] !== null).length, 0);
  const totalMatches = 72;
  const completedGroups = Object.entries(allScores).filter(([, gs]) => gs.filter(s => s[0] !== null && s[1] !== null).length === 6).length;

  const goNext = () => setCurrentGroup(prev => Math.min(prev + 1, 11));
  const goPrev = () => setCurrentGroup(prev => Math.max(prev - 1, 0));

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular), sans-serif" }}>שלב הבתים</h1>
        <p className="text-base text-gray-600 mt-1">סדרו את הקבוצות בכל בית, הזינו תוצאות — הטבלה מתעדכנת אוטומטית לפי חוקי FIFA</p>
      </div>

      {/* Compact progress + group selector */}
      <div className="mb-4 flex items-center gap-3 flex-wrap">
        {/* Progress pill */}
        <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-2 shadow-sm shrink-0">
          <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${completedGroups === 12 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${(totalFilled / totalMatches) * 100}%` }}></div>
          </div>
          <span className="text-xs font-bold text-gray-500" style={{ fontFamily: "var(--font-inter)" }}>{completedGroups}/12</span>
        </div>
        {/* Group dots */}
        <div className="flex gap-1.5">
          {GROUPS_DATA.map((g, i) => {
            const filled = allScores[g.id].filter(s => s[0] !== null && s[1] !== null).length;
            const done = filled === 6;
            return (
              <button key={g.id} onClick={() => setCurrentGroup(i)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${
                  i === currentGroup ? "bg-gray-900 text-white shadow-md scale-110" :
                  done ? "bg-green-100 text-green-700 border border-green-200" :
                  filled > 0 ? "bg-blue-50 text-blue-600 border border-blue-200" :
                  "bg-gray-100 text-gray-400"
                }`}
                style={{ fontFamily: "var(--font-inter)" }}
              >
                {g.id}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lock info */}
      <div className="mb-5 flex items-center gap-3 rounded-xl bg-gradient-to-l from-blue-50 to-white border border-blue-200 px-4 py-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 shrink-0"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        <p className="text-sm font-medium text-gray-700">ננעל ב-10.06.2026, 17:00 (שעון ישראל) · ניתן לשנות עד אז</p>
      </div>

      {/* Carousel header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={goPrev} disabled={currentGroup === 0}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            currentGroup === 0 ? "text-gray-300" : "text-gray-600 hover:bg-gray-100 active:bg-gray-200"
          }`}>
          → בית {currentGroup > 0 ? GROUPS_DATA[currentGroup - 1].id : ""}
        </button>

        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">בית {group.id}</h2>
          <p className="text-[10px] text-gray-400">{currentGroup + 1} מתוך 12</p>
        </div>

        <button onClick={goNext} disabled={currentGroup === 11}
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
            currentGroup === 11 ? "text-gray-300" : "text-gray-600 hover:bg-gray-100 active:bg-gray-200"
          }`}>
          בית {currentGroup < 11 ? GROUPS_DATA[currentGroup + 1].id : ""} ←
        </button>
      </div>

      {/* Current group */}
      <GroupView
        group={group}
        scores={allScores[group.id]}
        onScoreChange={handleScoreChange}
        onOrderChange={handleOrderChange}
        order={allOrders[group.id]}
      />

      {/* Next group button */}
      {currentGroup < 11 && (
        <div className="mt-6 text-center">
          <button onClick={goNext}
            className="px-8 py-3 rounded-xl bg-gray-900 text-white font-medium text-sm hover:bg-gray-800 transition-colors shadow-sm">
            המשך לבית {GROUPS_DATA[currentGroup + 1].id} ←
          </button>
        </div>
      )}
      {currentGroup === 11 && completedGroups === 12 && (
        <div className="mt-6 text-center">
          <button className="px-8 py-3 rounded-xl bg-green-600 text-white font-medium text-sm hover:bg-green-700 transition-colors shadow-sm">
            ✓ כל הבתים הושלמו — המשך לעץ הנוק-אאוט
          </button>
        </div>
      )}
    </div>
  );
}
