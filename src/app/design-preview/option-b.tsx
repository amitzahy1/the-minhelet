"use client";

// ============================================================================
// OPTION B: "Matchday" — Bold & Sporty (Broadcast style)
// Colors: #F0F2F5 bg, #1E40AF blue + #F97316 orange, Rubik + Inter
// ============================================================================

export function OptionB() {
  return (
    <div className="space-y-8" dir="rtl" style={{ fontFamily: "'Rubik', 'Heebo', sans-serif" }}>
      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Option B: Matchday</h2>
        <p className="text-sm text-gray-500">Broadcast energy — bold colors, sporty vibe, dynamic feel</p>
      </div>

      {/* === NAV BAR (Desktop) === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Navigation (Desktop)</p>
        <header className="bg-gradient-to-l from-blue-900 to-blue-700 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between h-14 px-6">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚽</span>
              <span className="font-bold text-base text-white">מונדיאל 2026</span>
            </div>
            <nav className="flex items-center gap-1">
              <span className="px-4 py-1.5 rounded-full text-sm font-medium bg-orange-500 text-white">עץ טורניר</span>
              <span className="px-4 py-1.5 rounded-full text-sm font-medium text-blue-200 hover:bg-white/10">ניחושים</span>
              <span className="px-4 py-1.5 rounded-full text-sm font-medium text-blue-200 hover:bg-white/10">לייב</span>
              <span className="px-4 py-1.5 rounded-full text-sm font-medium text-blue-200 hover:bg-white/10">דירוג</span>
            </nav>
            <div className="w-8 h-8 rounded-full bg-orange-400 flex items-center justify-center text-sm font-bold text-white">א</div>
          </div>
        </header>
      </section>

      {/* === GROUP CARD === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Group Card</p>
        <div className="bg-[#F0F2F5] p-6 rounded-2xl">
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
            {/* Gradient header */}
            <div className="bg-gradient-to-l from-blue-800 to-blue-600 px-4 py-2.5 flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">בית C</h3>
              <span className="text-blue-200 text-xs">6 משחקים</span>
            </div>

            {/* Teams */}
            <div className="p-3 space-y-1">
              {[
                { pos: 1, flag: "🇦🇷", code: "ARG", name: "ארגנטינה", pts: 7, status: "✅" },
                { pos: 2, flag: "🇲🇽", code: "MEX", name: "מקסיקו", pts: 4, status: "✅" },
                { pos: 3, flag: "🇺🇿", code: "UZB", name: "אוזבקיסטן", pts: 3, status: "⚠️" },
                { pos: 4, flag: "🇮🇩", code: "IDN", name: "אינדונזיה", pts: 0, status: "❌" },
              ].map((t, i) => (
                <div key={t.code} className={`flex items-center gap-3 px-3 py-2.5 rounded-md ${i % 2 === 1 ? "bg-slate-50" : ""}`}>
                  <span className="text-sm font-bold text-slate-400 w-5">{t.pos}</span>
                  <span className="text-xl">{t.flag}</span>
                  <span className="font-semibold text-sm flex-1">{t.name}</span>
                  <span className="font-bold text-sm text-blue-800 w-8 text-center" style={{ fontFamily: "Inter" }}>{t.pts}</span>
                  <span className="text-sm">{t.status}</span>
                  <span className="text-slate-300 cursor-grab">⠿</span>
                </div>
              ))}
            </div>

            {/* Match scores */}
            <div className="border-t border-gray-100 px-3 py-3 space-y-1.5">
              {[
                { h: "🇦🇷", hc: "ARG", a: "🇲🇽", ac: "MEX", hs: 1, as: 0 },
                { h: "🇺🇿", hc: "UZB", a: "🇮🇩", ac: "IDN", hs: 2, as: 0 },
                { h: "🇦🇷", hc: "ARG", a: "🇺🇿", ac: "UZB", hs: 3, as: 1 },
              ].map((m, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-md px-3 py-2">
                  <span className="flex items-center gap-1.5 w-16">
                    <span>{m.h}</span>
                    <span className="text-xs font-bold">{m.hc}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold text-sm shadow-sm">-</button>
                    <span className="w-8 text-center font-extrabold text-xl" style={{ fontFamily: "Inter" }}>{m.hs}</span>
                    <button className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold text-sm shadow-sm">+</button>
                    <span className="text-slate-300 mx-0.5">-</span>
                    <button className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold text-sm shadow-sm">-</button>
                    <span className="w-8 text-center font-extrabold text-xl" style={{ fontFamily: "Inter" }}>{m.as}</span>
                    <button className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold text-sm shadow-sm">+</button>
                  </div>
                  <span className="flex items-center gap-1.5 w-16 justify-end">
                    <span className="text-xs font-bold">{m.ac}</span>
                    <span>{m.a}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* === MATCH PREDICTION (Broadcast style) === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Match Prediction Card</p>
        <div className="bg-[#F0F2F5] p-6 rounded-2xl">
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden">
            {/* Dark header */}
            <div className="bg-slate-900 px-4 py-1.5 flex items-center justify-between">
              <span className="text-slate-400 text-xs">בית C - סיבוב 2</span>
              <span className="text-slate-400 text-xs">15.06 | 21:00</span>
            </div>
            {/* Score area */}
            <div className="px-4 py-5 flex items-center justify-between">
              <div className="flex flex-col items-center gap-1.5 w-24">
                <span className="text-4xl">🇧🇷</span>
                <span className="font-bold text-sm">ברזיל</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-extrabold text-5xl tabular-nums text-slate-900" style={{ fontFamily: "Inter" }}>2</span>
                <span className="text-slate-300 font-light text-3xl">-</span>
                <span className="font-extrabold text-5xl tabular-nums text-slate-900" style={{ fontFamily: "Inter" }}>1</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 w-24">
                <span className="text-4xl">🇦🇷</span>
                <span className="font-bold text-sm">ארגנטינה</span>
              </div>
            </div>
            {/* Status */}
            <div className="px-4 pb-3 flex items-center justify-between">
              <span className="inline-flex items-center rounded-md bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 border border-green-200">✓ תואם</span>
              <span className="text-xs text-slate-400">⏱ ננעל בעוד 2:34:12</span>
              <button className="px-5 py-2 rounded-md bg-orange-500 text-white text-sm font-bold shadow-sm">שמירה</button>
            </div>
          </div>
        </div>
      </section>

      {/* === LEADERBOARD with podium === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Leaderboard (with podium)</p>
        <div className="bg-[#F0F2F5] p-6 rounded-2xl">
          <div className="max-w-lg mx-auto bg-white rounded-lg shadow-md overflow-hidden">
            {/* Podium */}
            <div className="flex items-end justify-center gap-3 px-4 pt-4 pb-2">
              {/* 2nd */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-lg font-bold text-slate-600">ד</div>
                <span className="text-xs font-bold mt-1">דני</span>
                <div className="bg-slate-200 rounded-t-lg w-20 h-14 mt-2 flex items-center justify-center">
                  <span className="font-extrabold text-lg" style={{ fontFamily: "Inter" }}>182</span>
                </div>
              </div>
              {/* 1st */}
              <div className="flex flex-col items-center">
                <span className="text-amber-400 text-lg mb-0.5">👑</span>
                <div className="w-14 h-14 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center text-xl font-bold text-amber-700 shadow-lg">י</div>
                <span className="text-sm font-bold mt-1">יוני</span>
                <div className="bg-gradient-to-t from-amber-200 to-amber-100 rounded-t-lg w-20 h-20 mt-2 flex items-center justify-center">
                  <span className="font-extrabold text-2xl" style={{ fontFamily: "Inter" }}>187</span>
                </div>
              </div>
              {/* 3rd */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-lg font-bold text-amber-700">ד</div>
                <span className="text-xs font-bold mt-1">דור</span>
                <div className="bg-amber-100 rounded-t-lg w-20 h-10 mt-2 flex items-center justify-center">
                  <span className="font-extrabold text-lg" style={{ fontFamily: "Inter" }}>175</span>
                </div>
              </div>
            </div>
            {/* Remaining rows */}
            {[
              { rank: 4, name: "אמית", pts: 171, delta: "—", dc: "text-slate-400", bg: "bg-orange-50/50 border-s-2 border-orange-400" },
              { rank: 5, name: "רון", pts: 164, delta: "▼1", dc: "text-red-500", bg: "" },
              { rank: 6, name: "רועי", pts: 158, delta: "▼2", dc: "text-red-500", bg: "" },
              { rank: 7, name: "עידן", pts: 149, delta: "▲1", dc: "text-green-500", bg: "" },
            ].map((r) => (
              <div key={r.rank} className={`flex items-center px-4 py-3 border-t border-gray-100 ${r.bg}`}>
                <span className="w-7 text-center font-bold text-sm text-slate-400">{r.rank}</span>
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600 ms-2">
                  {r.name[0]}
                </div>
                <span className="ms-3 flex-1 font-semibold text-sm">{r.name}</span>
                <span className={`text-xs font-medium ${r.dc} me-2`}>{r.delta}</span>
                <span className="font-bold text-lg tabular-nums" style={{ fontFamily: "Inter" }}>{r.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === LIVE MATCH === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Live Match</p>
        <div className="bg-[#F0F2F5] p-6 rounded-2xl">
          <div className="max-w-md mx-auto bg-white rounded-lg shadow-md overflow-hidden border-t-[3px] border-red-500">
            <div className="bg-slate-900 px-4 py-2 flex items-center justify-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-xs font-bold text-red-400 tracking-wider uppercase" style={{ fontFamily: "Inter" }}>LIVE</span>
              <span className="text-slate-400 text-xs">67&apos;</span>
            </div>
            <div className="px-4 py-5 flex items-center justify-between">
              <div className="flex flex-col items-center gap-1.5 w-24">
                <span className="text-4xl">🇦🇷</span>
                <span className="font-bold text-sm">ארגנטינה</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-extrabold text-5xl tabular-nums text-blue-800" style={{ fontFamily: "Inter" }}>2</span>
                <span className="text-slate-300 text-3xl">-</span>
                <span className="font-extrabold text-5xl tabular-nums text-blue-800" style={{ fontFamily: "Inter" }}>0</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 w-24">
                <span className="text-4xl">🇸🇦</span>
                <span className="font-bold text-sm">ערב הסעודית</span>
              </div>
            </div>
            <div className="bg-green-50 px-4 py-2 text-center text-xs text-green-700 border-t border-green-100">
              🎯 הניחוש שלך: 2-0 — תוצאה מדויקת עד כה!
            </div>
          </div>
        </div>
      </section>

      {/* === MOBILE NAV === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Mobile Bottom Nav</p>
        <div className="bg-[#F0F2F5] p-6 rounded-2xl">
          <div className="max-w-sm mx-auto bg-white rounded-xl shadow-[0_-2px_10px_rgba(0,0,0,0.08)] flex justify-around items-center h-16">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-orange-500 text-lg">🏆</span>
              <span className="text-[10px] font-medium text-orange-500">עץ</span>
              <div className="w-6 h-0.5 bg-orange-500 rounded-full mt-0.5"></div>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-slate-400 text-lg">🎯</span>
              <span className="text-[10px] text-slate-400">ניחושים</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-slate-400 text-lg">📡</span>
              <span className="text-[10px] text-slate-400">לייב</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-slate-400 text-lg">📊</span>
              <span className="text-[10px] text-slate-400">דירוג</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
