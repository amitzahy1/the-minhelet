"use client";

// ============================================================================
// Live Page Demo — Live match tracking + bracket health, Stadium Light
// ============================================================================

export function LivePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
          <h1 className="text-3xl font-black text-gray-900">לייב</h1>
        </div>
        <p className="text-base text-gray-600">2 משחקים בשידור חי עכשיו</p>
      </div>

      {/* Live matches */}
      <div className="space-y-4 mb-8">
        {/* Match 1 — Live */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-center gap-2 py-2 bg-red-50 border-b border-red-100">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-sm font-bold text-red-600 tracking-wider" style={{ fontFamily: "Inter" }}>LIVE</span>
            <span className="text-sm text-red-400">72&apos;</span>
          </div>
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="flex flex-col items-center gap-2 w-24">
              <span className="text-5xl">🇦🇷</span>
              <span className="font-bold text-base text-gray-800">ארגנטינה</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-black text-6xl tabular-nums text-gray-900" style={{ fontFamily: "Inter" }}>2</span>
              <span className="text-gray-300 text-4xl font-light">-</span>
              <span className="font-black text-6xl tabular-nums text-gray-900" style={{ fontFamily: "Inter" }}>0</span>
            </div>
            <div className="flex flex-col items-center gap-2 w-24">
              <span className="text-5xl">🇸🇦</span>
              <span className="font-bold text-base text-gray-800">ערב הסעודית</span>
            </div>
          </div>
          {/* Your prediction */}
          <div className="border-t border-gray-100 px-4 py-3 bg-green-50/30">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-600">הניחוש שלך: </span>
                <span className="text-base font-bold text-gray-800" style={{ fontFamily: "Inter" }}>2 - 0</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">🎯 תוצאה מדויקת!</span>
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-600">
              <span>אם נגמר ככה: <strong className="text-green-600">+3 נקודות</strong></span>
            </div>
          </div>
          {/* Friends predictions */}
          <div className="border-t border-gray-100 px-4 py-2.5">
            <p className="text-sm text-gray-500 mb-1">חברים:</p>
            <div className="flex gap-3 text-sm text-gray-600">
              <span>דני: <strong>3-0</strong></span>
              <span>יוני: <strong>1-0</strong></span>
              <span>רון: <strong>2-1</strong></span>
              <span>דור: <strong>2-0</strong> 🎯</span>
            </div>
          </div>
        </div>

        {/* Match 2 — Live */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-center gap-2 py-2 bg-red-50 border-b border-red-100">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-sm font-bold text-red-600 tracking-wider" style={{ fontFamily: "Inter" }}>LIVE</span>
            <span className="text-sm text-red-400">45&apos;+2</span>
          </div>
          <div className="px-6 py-5 flex items-center justify-between">
            <div className="flex flex-col items-center gap-2 w-24">
              <span className="text-5xl">🇲🇽</span>
              <span className="font-bold text-base text-gray-800">מקסיקו</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-black text-6xl tabular-nums text-gray-900" style={{ fontFamily: "Inter" }}>1</span>
              <span className="text-gray-300 text-4xl font-light">-</span>
              <span className="font-black text-6xl tabular-nums text-gray-900" style={{ fontFamily: "Inter" }}>1</span>
            </div>
            <div className="flex flex-col items-center gap-2 w-24">
              <span className="text-5xl">🇮🇩</span>
              <span className="font-bold text-base text-gray-800">אינדונזיה</span>
            </div>
          </div>
          <div className="border-t border-gray-100 px-4 py-3 bg-amber-50/30">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm text-gray-600">הניחוש שלך: </span>
                <span className="text-base font-bold text-gray-800" style={{ fontFamily: "Inter" }}>2 - 0</span>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">✗ לא תואם</span>
            </div>
          </div>
        </div>
      </div>

      {/* Group standings live */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-900 mb-3">📊 טבלת בית C — עדכון חי</h2>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="py-2.5 ps-4 text-right">#</th>
                <th className="py-2.5 text-right">קבוצה</th>
                <th className="py-2.5 text-center">מש</th>
                <th className="py-2.5 text-center">נ</th>
                <th className="py-2.5 text-center">הש</th>
                <th className="py-2.5 pe-4 text-center font-bold">נק</th>
                <th className="py-2.5 pe-4 text-center">חזוי</th>
              </tr>
            </thead>
            <tbody>
              {[
                { pos: 1, flag: "🇦🇷", name: "ארגנטינה", p: 2, w: 2, gd: "+5", pts: 6, predicted: "1st", match: true },
                { pos: 2, flag: "🇲🇽", name: "מקסיקו", p: 2, w: 0, gd: "+1", pts: 2, predicted: "2nd", match: false },
                { pos: 3, flag: "🇺🇿", name: "אוזבקיסטן", p: 2, w: 1, gd: "-2", pts: 3, predicted: "3rd", match: true },
                { pos: 4, flag: "🇮🇩", name: "אינדונזיה", p: 2, w: 0, gd: "-4", pts: 1, predicted: "4th", match: true },
              ].map((t) => (
                <tr key={t.name} className={`border-b border-gray-50 last:border-0 ${t.pos <= 2 ? "bg-green-50/20" : ""}`}>
                  <td className="py-2.5 ps-4 font-bold text-gray-300">{t.pos}</td>
                  <td className="py-2.5">
                    <span className="flex items-center gap-2">
                      <span>{t.flag}</span>
                      <span className="font-medium text-gray-800">{t.name}</span>
                    </span>
                  </td>
                  <td className="text-center text-gray-500" style={{ fontFamily: "Inter" }}>{t.p}</td>
                  <td className="text-center text-gray-500" style={{ fontFamily: "Inter" }}>{t.w}</td>
                  <td className="text-center text-gray-500" style={{ fontFamily: "Inter" }}>{t.gd}</td>
                  <td className="pe-4 text-center font-bold" style={{ fontFamily: "Inter" }}>{t.pts}</td>
                  <td className="pe-4 text-center">
                    {t.match ? (
                      <span className="text-green-600 text-xs">✓ {t.predicted}</span>
                    ) : (
                      <span className="text-amber-500 text-xs">✗ {t.predicted}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bracket health */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-3">🏆 בריאות העץ שלך</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 text-center">
            <p className="text-3xl font-black text-green-600" style={{ fontFamily: "Inter" }}>8/12</p>
            <p className="text-[10px] text-gray-400 mt-1">בתים נכונים</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 text-center">
            <p className="text-3xl font-black text-blue-600" style={{ fontFamily: "Inter" }}>26/32</p>
            <p className="text-[10px] text-gray-400 mt-1">עולות מהבתים</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 text-center">
            <p className="text-lg">🇦🇷</p>
            <p className="text-[10px] text-green-600 font-medium mt-1">האלוף שלך חי ✓</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 text-center">
            <p className="text-3xl font-black text-purple-600" style={{ fontFamily: "Inter" }}>154</p>
            <p className="text-[10px] text-gray-400 mt-1">סה״כ נקודות</p>
          </div>
        </div>
      </div>
    </div>
  );
}
