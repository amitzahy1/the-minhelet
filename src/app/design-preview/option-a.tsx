"use client";

// ============================================================================
// OPTION A: "Stadium Light" — Clean & Minimal (Apple/Google)
// Colors: #F8F9FB bg, #3B82F6 accent, Heebo + Inter
// ============================================================================

export function OptionA() {
  return (
    <div className="space-y-8" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Option A: Stadium Light</h2>
        <p className="text-sm text-gray-500">Apple/Google minimalism — whitespace, clarity, precision</p>
      </div>

      {/* === NAV BAR === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Navigation (Desktop)</p>
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between h-14 px-6">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚽</span>
              <span className="font-bold text-base text-gray-900">WC2026</span>
            </div>
            <nav className="flex items-center gap-1">
              <span className="px-4 py-1.5 rounded-full text-sm font-medium bg-blue-50 text-blue-600">עץ טורניר</span>
              <span className="px-4 py-1.5 rounded-full text-sm font-medium text-gray-500 hover:bg-gray-50">ניחושים</span>
              <span className="px-4 py-1.5 rounded-full text-sm font-medium text-gray-500 hover:bg-gray-50">לייב</span>
              <span className="px-4 py-1.5 rounded-full text-sm font-medium text-gray-500 hover:bg-gray-50">דירוג</span>
            </nav>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">א</div>
          </div>
        </header>
      </section>

      {/* === GROUP CARD === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Group Card</p>
        <div className="bg-[#F8F9FB] p-6 rounded-2xl">
          <div className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">בית C</h3>
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">✓ תקין</span>
            </div>

            {/* Teams - draggable */}
            <div className="p-3 space-y-1.5">
              {[
                { pos: 1, flag: "🇦🇷", code: "ARG", label: "עולה (1)", bg: "bg-green-50 border-green-200" },
                { pos: 2, flag: "🇲🇽", code: "MEX", label: "עולה (2)", bg: "bg-green-50/60 border-green-100" },
                { pos: 3, flag: "🇺🇿", code: "UZB", label: "אולי (3)", bg: "bg-amber-50 border-amber-100" },
                { pos: 4, flag: "🇮🇩", code: "IDN", label: "נשארת (4)", bg: "bg-red-50/50 border-red-100" },
              ].map((t) => (
                <div key={t.code} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${t.bg}`}>
                  <span className="text-sm font-bold text-gray-400 w-5">{t.pos}.</span>
                  <span className="text-lg">{t.flag}</span>
                  <span className="font-medium text-sm flex-1">{t.code}</span>
                  <span className="text-xs text-gray-400">{t.label}</span>
                  <span className="text-gray-300">⠿</span>
                </div>
              ))}
            </div>

            {/* Match scores */}
            <div className="px-3 pb-3 space-y-1.5">
              <p className="text-xs text-gray-500 mb-1">תוצאות משחקים:</p>
              {[
                { h: "🇦🇷 ARG", a: "🇲🇽 MEX", hs: 1, as: 0 },
                { h: "🇺🇿 UZB", a: "🇮🇩 IDN", hs: 2, as: 0 },
                { h: "🇦🇷 ARG", a: "🇺🇿 UZB", hs: 3, as: 1 },
              ].map((m, i) => (
                <div key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-gray-100 px-3 py-2">
                  <span className="text-xs font-medium w-16 truncate">{m.h}</span>
                  <div className="flex items-center gap-1">
                    <button className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 flex items-center justify-center text-sm">-</button>
                    <span className="w-7 text-center font-bold text-lg" style={{ fontFamily: "Inter, sans-serif" }}>{m.hs}</span>
                    <button className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 flex items-center justify-center text-sm">+</button>
                    <span className="text-gray-300 mx-1">-</span>
                    <button className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 flex items-center justify-center text-sm">-</button>
                    <span className="w-7 text-center font-bold text-lg" style={{ fontFamily: "Inter, sans-serif" }}>{m.as}</span>
                    <button className="w-8 h-8 rounded-full border border-gray-200 text-gray-400 flex items-center justify-center text-sm">+</button>
                  </div>
                  <span className="text-xs font-medium w-16 truncate text-left">{m.a}</span>
                </div>
              ))}
            </div>

            {/* Calculated table */}
            <div className="border-t border-gray-100 px-3 py-3">
              <p className="text-xs text-gray-500 mb-2">טבלה מחושבת:</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400">
                    <th className="text-center w-6">#</th>
                    <th className="text-right">קבוצה</th>
                    <th className="text-center w-6">מש</th>
                    <th className="text-center w-6">נ</th>
                    <th className="text-center w-6">ת</th>
                    <th className="text-center w-6">ה</th>
                    <th className="text-center w-8">הש</th>
                    <th className="text-center w-8 font-bold">נק</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { pos: 1, flag: "🇦🇷", code: "ARG", p: 3, w: 2, d: 1, l: 0, gd: "+5", pts: 7 },
                    { pos: 2, flag: "🇲🇽", code: "MEX", p: 3, w: 1, d: 1, l: 1, gd: "+1", pts: 4 },
                    { pos: 3, flag: "🇺🇿", code: "UZB", p: 3, w: 1, d: 0, l: 2, gd: "-2", pts: 3 },
                    { pos: 4, flag: "🇮🇩", code: "IDN", p: 3, w: 0, d: 0, l: 3, gd: "-4", pts: 0 },
                  ].map((r) => (
                    <tr key={r.code} className="border-t border-gray-50">
                      <td className="text-center font-bold py-1.5">{r.pos}</td>
                      <td className="py-1.5"><span className="flex items-center gap-1">{r.flag} <span className="font-medium">{r.code}</span></span></td>
                      <td className="text-center">{r.p}</td>
                      <td className="text-center">{r.w}</td>
                      <td className="text-center">{r.d}</td>
                      <td className="text-center">{r.l}</td>
                      <td className="text-center">{r.gd}</td>
                      <td className="text-center font-bold">{r.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* === MATCH PREDICTION === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Match Prediction Card</p>
        <div className="bg-[#F8F9FB] p-6 rounded-2xl">
          <div className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="text-center text-xs text-gray-400 mb-3">שלב הבתים - בית C | 15 ביוני, 21:00</div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center gap-1.5 w-20">
                <span className="text-3xl">🇧🇷</span>
                <span className="font-semibold text-sm">ברזיל</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0 rounded-lg border border-gray-200 overflow-hidden">
                  <button className="w-11 h-11 flex items-center justify-center bg-gray-50 text-lg font-bold text-gray-400">-</button>
                  <span className="w-10 h-11 flex items-center justify-center font-bold text-2xl" style={{ fontFamily: "Inter" }}>2</span>
                  <button className="w-11 h-11 flex items-center justify-center bg-gray-50 text-lg font-bold text-gray-400">+</button>
                </div>
                <span className="text-gray-300 font-light text-2xl">:</span>
                <div className="flex items-center gap-0 rounded-lg border border-gray-200 overflow-hidden">
                  <button className="w-11 h-11 flex items-center justify-center bg-gray-50 text-lg font-bold text-gray-400">-</button>
                  <span className="w-10 h-11 flex items-center justify-center font-bold text-2xl" style={{ fontFamily: "Inter" }}>1</span>
                  <button className="w-11 h-11 flex items-center justify-center bg-gray-50 text-lg font-bold text-gray-400">+</button>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1.5 w-20">
                <span className="text-3xl">🇦🇷</span>
                <span className="font-semibold text-sm">ארגנטינה</span>
              </div>
            </div>
            <div className="mt-3 text-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-3 py-1 text-xs text-green-700 border border-green-200">✓ תואם לעץ הטורניר</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
              <span>⏱ ננעל בעוד 2:34:12</span>
              <button className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium">שמירה</button>
            </div>
          </div>
        </div>
      </section>

      {/* === LEADERBOARD === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Leaderboard</p>
        <div className="bg-[#F8F9FB] p-6 rounded-2xl">
          <div className="max-w-lg mx-auto bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold">טבלת דירוג</h2>
              <div className="flex gap-1 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-600 font-medium">כללי</span>
                <span className="px-2.5 py-1 rounded-full text-gray-400">משחקים</span>
                <span className="px-2.5 py-1 rounded-full text-gray-400">עולות</span>
              </div>
            </div>
            {[
              { rank: 1, name: "דני", pts: 187, today: "+12", delta: "▲3", deltaColor: "text-green-500", medal: "🥇", bg: "" },
              { rank: 2, name: "יוני", pts: 182, today: "+8", delta: "▲1", deltaColor: "text-green-500", medal: "🥈", bg: "" },
              { rank: 3, name: "דור", pts: 175, today: "+15", delta: "▲2", deltaColor: "text-green-500", medal: "🥉", bg: "" },
              { rank: 4, name: "אמית", pts: 171, today: "+6", delta: "—", deltaColor: "text-gray-400", medal: "", bg: "bg-blue-50/50" },
              { rank: 5, name: "רון", pts: 164, today: "+10", delta: "▼1", deltaColor: "text-red-400", medal: "", bg: "" },
              { rank: 6, name: "רועי", pts: 158, today: "+4", delta: "▼2", deltaColor: "text-red-400", medal: "", bg: "" },
              { rank: 7, name: "עידן", pts: 149, today: "+7", delta: "▲1", deltaColor: "text-green-500", medal: "", bg: "" },
            ].map((r) => (
              <div key={r.rank} className={`flex items-center px-4 py-3 border-b border-gray-50 ${r.bg}`}>
                <span className="w-8 text-center font-bold text-sm text-gray-400">
                  {r.medal || r.rank}
                </span>
                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-bold text-gray-500 ms-2">
                  {r.name[0]}
                </div>
                <div className="ms-3 flex-1">
                  <span className="font-semibold text-sm">{r.name}</span>
                  <span className="text-xs text-gray-400 ms-2">{r.today} היום</span>
                </div>
                <span className="font-bold text-lg tabular-nums" style={{ fontFamily: "Inter" }}>{r.pts}</span>
                <span className={`ms-2 text-xs ${r.deltaColor}`}>{r.delta}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === LIVE MATCH === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Live Match</p>
        <div className="bg-[#F8F9FB] p-6 rounded-2xl">
          <div className="max-w-md mx-auto bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              <span className="text-xs font-bold text-red-600 tracking-wide">LIVE</span>
              <span className="text-xs text-gray-400">67&apos;</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center gap-1 w-20">
                <span className="text-3xl">🇦🇷</span>
                <span className="font-semibold text-sm">ארגנטינה</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-4xl tabular-nums" style={{ fontFamily: "Inter" }}>2</span>
                <span className="text-gray-300 text-2xl">-</span>
                <span className="font-bold text-4xl tabular-nums" style={{ fontFamily: "Inter" }}>0</span>
              </div>
              <div className="flex flex-col items-center gap-1 w-20">
                <span className="text-3xl">🇸🇦</span>
                <span className="font-semibold text-sm">ערב הסעודית</span>
              </div>
            </div>
            <div className="mt-3 text-center text-xs text-gray-500">
              הניחוש שלך: 2-0 — 🎯 תוצאה מדויקת עד כה!
            </div>
          </div>
        </div>
      </section>

      {/* === MOBILE NAV === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Mobile Bottom Nav</p>
        <div className="bg-[#F8F9FB] p-6 rounded-2xl">
          <div className="max-w-sm mx-auto bg-white border border-gray-200 rounded-xl flex justify-around items-center h-16 shadow-sm">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-blue-600 text-lg">🏆</span>
              <span className="text-[10px] font-medium text-blue-600">עץ</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-gray-400 text-lg">🎯</span>
              <span className="text-[10px] text-gray-400">ניחושים</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-gray-400 text-lg">📡</span>
              <span className="text-[10px] text-gray-400">לייב</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-gray-400 text-lg">📊</span>
              <span className="text-[10px] text-gray-400">דירוג</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
