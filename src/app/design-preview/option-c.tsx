"use client";

// ============================================================================
// OPTION C: "Golden Boot" — Premium & Sophisticated (Luxury/Fintech)
// Colors: #FAFAF8 bg, #B8860B gold accent, Heebo (light) + Inter
// ============================================================================

export function OptionC() {
  return (
    <div className="space-y-8" dir="rtl" style={{ fontFamily: "'Heebo', sans-serif" }}>
      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-zinc-900 mb-1">Option C: Golden Boot</h2>
        <p className="text-sm text-zinc-500">Luxury fintech — refined typography, gold accents, no shadows</p>
      </div>

      {/* === NAV BAR (Desktop) === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Navigation (Desktop)</p>
        <header className="bg-white/90 backdrop-blur-lg border-b border-zinc-100 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between h-14 px-8">
            <span className="font-semibold text-lg tracking-tight text-zinc-900">WC2026</span>
            <nav className="flex items-center gap-8">
              <span className="text-sm font-medium text-[#B8860B] border-b-2 border-[#B8860B] pb-3.5">עץ טורניר</span>
              <span className="text-sm font-medium text-zinc-400 pb-3.5">ניחושים</span>
              <span className="text-sm font-medium text-zinc-400 pb-3.5">לייב</span>
              <span className="text-sm font-medium text-zinc-400 pb-3.5">דירוג</span>
            </nav>
            <div className="w-8 h-8 rounded-full bg-[#FBF7EE] border border-[#D4A843] flex items-center justify-center text-sm font-medium text-[#B8860B]">א</div>
          </div>
        </header>
      </section>

      {/* === GROUP CARD === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Group Card</p>
        <div className="bg-[#FAFAF8] p-6 rounded-2xl">
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-zinc-200 border-t-2 border-t-[#B8860B] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-100">
              <span className="text-xs tracking-widest uppercase text-zinc-400 font-medium" style={{ fontFamily: "Inter" }}>GROUP C</span>
              <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 border border-green-100">✓ תקין</span>
            </div>

            {/* Teams */}
            <div className="px-4 py-3 space-y-0">
              {[
                { pos: 1, flag: "🇦🇷", name: "ארגנטינה", code: "ARG", pts: 7, gd: "+5", status: "עולה" },
                { pos: 2, flag: "🇲🇽", name: "מקסיקו", code: "MEX", pts: 4, gd: "+1", status: "עולה" },
                { pos: 3, flag: "🇺🇿", name: "אוזבקיסטן", code: "UZB", pts: 3, gd: "-2", status: "—" },
                { pos: 4, flag: "🇮🇩", name: "אינדונזיה", code: "IDN", pts: 0, gd: "-4", status: "—" },
              ].map((t) => (
                <div key={t.code} className="flex items-center gap-3 px-1 py-3 border-b border-zinc-50 last:border-0 group hover:bg-[#FBF7EE] transition-colors">
                  <span className="text-xs font-medium text-zinc-300 w-4">{t.pos}</span>
                  <span className="text-lg">{t.flag}</span>
                  <div className="flex-1">
                    <span className="font-medium text-sm text-zinc-800">{t.name}</span>
                    <span className="text-xs text-zinc-400 ms-2">{t.code}</span>
                  </div>
                  <span className="text-xs text-zinc-400 w-10 text-center">{t.gd}</span>
                  <span className="font-semibold text-sm w-8 text-center" style={{ fontFamily: "Inter" }}>{t.pts}</span>
                  <span className="text-zinc-300 text-xs">⠿</span>
                </div>
              ))}
            </div>

            {/* Match scores */}
            <div className="border-t border-zinc-100 px-4 py-3 space-y-2">
              {[
                { h: "ARG", hf: "🇦🇷", a: "MEX", af: "🇲🇽", hs: 1, as: 0 },
                { h: "UZB", hf: "🇺🇿", a: "IDN", af: "🇮🇩", hs: 2, as: 0 },
                { h: "ARG", hf: "🇦🇷", a: "UZB", af: "🇺🇿", hs: 3, as: 1 },
              ].map((m, i) => (
                <div key={i} className="flex items-center justify-between py-1.5">
                  <span className="flex items-center gap-1.5 w-16 text-xs">
                    <span>{m.hf}</span>
                    <span className="font-medium text-zinc-700">{m.h}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button className="w-8 h-8 flex items-center justify-center text-zinc-300 hover:text-[#B8860B] transition-colors">
                      <span className="text-lg">−</span>
                    </button>
                    <span className="w-6 text-center font-semibold text-base" style={{ fontFamily: "Inter" }}>{m.hs}</span>
                    <button className="w-8 h-8 flex items-center justify-center text-zinc-300 hover:text-[#B8860B] transition-colors">
                      <span className="text-lg">+</span>
                    </button>
                    <span className="text-zinc-200 mx-0.5">:</span>
                    <button className="w-8 h-8 flex items-center justify-center text-zinc-300 hover:text-[#B8860B] transition-colors">
                      <span className="text-lg">−</span>
                    </button>
                    <span className="w-6 text-center font-semibold text-base" style={{ fontFamily: "Inter" }}>{m.as}</span>
                    <button className="w-8 h-8 flex items-center justify-center text-zinc-300 hover:text-[#B8860B] transition-colors">
                      <span className="text-lg">+</span>
                    </button>
                  </div>
                  <span className="flex items-center gap-1.5 w-16 justify-end text-xs">
                    <span className="font-medium text-zinc-700">{m.a}</span>
                    <span>{m.af}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* === MATCH PREDICTION === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Match Prediction Card</p>
        <div className="bg-[#FAFAF8] p-6 rounded-2xl">
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-4">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-4">
                <span style={{ fontFamily: "Inter" }} className="tracking-wider uppercase">Group C · MD2</span>
                <span>15.06 · 21:00</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-center gap-2 w-24">
                  <span className="text-3xl">🇧🇷</span>
                  <span className="font-medium text-sm text-zinc-800">ברזיל</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center">
                    <button className="w-9 h-9 flex items-center justify-center text-zinc-300 hover:text-[#B8860B]">−</button>
                    <span className="w-10 text-center font-semibold text-3xl text-zinc-900" style={{ fontFamily: "Inter" }}>2</span>
                    <button className="w-9 h-9 flex items-center justify-center text-zinc-300 hover:text-[#B8860B]">+</button>
                  </div>
                  <span className="text-zinc-200 text-xl">:</span>
                  <div className="flex items-center">
                    <button className="w-9 h-9 flex items-center justify-center text-zinc-300 hover:text-[#B8860B]">−</button>
                    <span className="w-10 text-center font-semibold text-3xl text-zinc-900" style={{ fontFamily: "Inter" }}>1</span>
                    <button className="w-9 h-9 flex items-center justify-center text-zinc-300 hover:text-[#B8860B]">+</button>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 w-24">
                  <span className="text-3xl">🇦🇷</span>
                  <span className="font-medium text-sm text-zinc-800">ארגנטינה</span>
                </div>
              </div>
            </div>
            <div className="border-t border-zinc-100 px-5 py-3 flex items-center justify-between">
              <span className="text-xs text-zinc-400">⏱ 2:34:12</span>
              <span className="text-xs text-green-600 font-medium">✓ תואם לעץ</span>
              <button className="px-5 py-2 rounded-lg bg-[#B8860B] text-white text-sm font-medium hover:bg-[#9A7209] transition-colors">שמירה</button>
            </div>
          </div>
        </div>
      </section>

      {/* === LEADERBOARD === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Leaderboard</p>
        <div className="bg-[#FAFAF8] p-6 rounded-2xl">
          <div className="max-w-lg mx-auto bg-white rounded-2xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
              <h2 className="font-semibold text-base text-zinc-800">טבלת דירוג</h2>
              <div className="flex gap-0.5 bg-zinc-100 rounded-lg p-0.5 text-xs">
                <span className="px-3 py-1 rounded-md bg-[#B8860B] text-white font-medium">כללי</span>
                <span className="px-3 py-1 rounded-md text-zinc-500">משחקים</span>
                <span className="px-3 py-1 rounded-md text-zinc-500">עולות</span>
              </div>
            </div>
            {[
              { rank: 1, name: "דני", pts: 187, trend: "↗", tc: "text-green-600", border: "border-s-2 border-[#B8860B]", bg: "" },
              { rank: 2, name: "יוני", pts: 182, trend: "↗", tc: "text-green-600", border: "border-s-2 border-zinc-400", bg: "" },
              { rank: 3, name: "דור", pts: 175, trend: "↗", tc: "text-green-600", border: "border-s-2 border-amber-700", bg: "" },
              { rank: 4, name: "אמית", pts: 171, trend: "→", tc: "text-zinc-400", border: "", bg: "bg-[#FBF7EE]" },
              { rank: 5, name: "רון", pts: 164, trend: "↘", tc: "text-red-500", border: "", bg: "" },
              { rank: 6, name: "רועי", pts: 158, trend: "↘", tc: "text-red-500", border: "", bg: "" },
              { rank: 7, name: "עידן", pts: 149, trend: "↗", tc: "text-green-600", border: "", bg: "" },
            ].map((r) => (
              <div key={r.rank} className={`flex items-center px-5 py-3 border-b border-zinc-50 ${r.border} ${r.bg}`}>
                <span className="w-6 text-center text-xs font-medium text-zinc-400" style={{ fontFamily: "Inter" }}>{r.rank}</span>
                <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-sm font-medium text-zinc-600 ms-3">
                  {r.name[0]}
                </div>
                <span className="ms-3 flex-1 font-medium text-sm text-zinc-800">{r.name}</span>
                {/* Mini trend chart placeholder */}
                <div className="flex items-center gap-0.5 me-3">
                  {[3, 5, 4, 7, 6, 8].map((h, i) => (
                    <div key={i} className="w-1 bg-zinc-200 rounded-full" style={{ height: `${h * 2}px` }}></div>
                  ))}
                </div>
                <span className={`text-xs ${r.tc} me-2`}>{r.trend}</span>
                <span className="font-semibold text-base tabular-nums text-zinc-900" style={{ fontFamily: "Inter" }}>{r.pts}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* === LIVE MATCH === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Live Match</p>
        <div className="bg-[#FAFAF8] p-6 rounded-2xl">
          <div className="max-w-md mx-auto bg-white rounded-2xl border border-zinc-200 overflow-hidden">
            <div className="px-5 py-4">
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                <span className="text-[10px] font-medium text-red-500 tracking-widest uppercase" style={{ fontFamily: "Inter" }}>LIVE</span>
                <span className="text-xs text-zinc-400">67&apos;</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col items-center gap-2 w-24">
                  <span className="text-3xl">🇦🇷</span>
                  <span className="font-medium text-sm text-zinc-800">ארגנטינה</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-4xl tabular-nums text-zinc-900" style={{ fontFamily: "Inter" }}>2</span>
                  <span className="text-zinc-200 text-xl">:</span>
                  <span className="font-semibold text-4xl tabular-nums text-zinc-900" style={{ fontFamily: "Inter" }}>0</span>
                </div>
                <div className="flex flex-col items-center gap-2 w-24">
                  <span className="text-3xl">🇸🇦</span>
                  <span className="font-medium text-sm text-zinc-800">ערב הסעודית</span>
                </div>
              </div>
            </div>
            <div className="border-t border-zinc-100 px-5 py-2.5 text-center text-xs text-zinc-500">
              הניחוש שלך: 2-0 · <span className="text-[#B8860B] font-medium">+3 נקודות אפשריות</span>
            </div>
          </div>
        </div>
      </section>

      {/* === MOBILE NAV === */}
      <section>
        <p className="text-xs text-gray-400 mb-2 font-mono">Mobile Bottom Nav</p>
        <div className="bg-[#FAFAF8] p-6 rounded-2xl">
          <div className="max-w-sm mx-auto bg-white/90 backdrop-blur-lg border border-zinc-100 rounded-xl flex justify-around items-center h-14">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[#B8860B] text-base">🏆</span>
              <div className="w-1 h-1 rounded-full bg-[#B8860B]"></div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-zinc-400 text-base">🎯</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-zinc-400 text-base">📡</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-zinc-400 text-base">📊</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
