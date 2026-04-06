"use client";

// ============================================================================
// Predictions Page — PRE-TOURNAMENT STATE
// Shows upcoming group stage matches, user can enter/change predictions
// Locks 30 min before each match. Times in Israel timezone.
// ============================================================================

const MATCHDAY_1 = [
  { time: "18:00", date: "11 ביוני", stage: "בית A · סיבוב 1", h: { flag: "🇲🇦", name: "מרוקו" }, a: { flag: "🇵🇪", name: "פרו" }, filled: false },
  { time: "21:00", date: "11 ביוני", stage: "בית A · סיבוב 1", h: { flag: "🇨🇦", name: "קנדה" }, a: { flag: "🇧🇫", name: "בורקינה פאסו" }, filled: false },
  { time: "18:00", date: "12 ביוני", stage: "בית B · סיבוב 1", h: { flag: "🇫🇷", name: "צרפת" }, a: { flag: "🇳🇿", name: "ניו זילנד" }, filled: true, hs: 3, as: 0 },
  { time: "21:00", date: "12 ביוני", stage: "בית B · סיבוב 1", h: { flag: "🇨🇴", name: "קולומביה" }, a: { flag: "🇭🇳", name: "הונדורס" }, filled: true, hs: 2, as: 1 },
  { time: "18:00", date: "13 ביוני", stage: "בית C · סיבוב 1", h: { flag: "🇦🇷", name: "ארגנטינה" }, a: { flag: "🇮🇩", name: "אינדונזיה" }, filled: false },
  { time: "21:00", date: "13 ביוני", stage: "בית C · סיבוב 1", h: { flag: "🇲🇽", name: "מקסיקו" }, a: { flag: "🇺🇿", name: "אוזבקיסטן" }, filled: false },
];

function MatchCard({ match }: { match: typeof MATCHDAY_1[0] }) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${match.filled ? "border-green-200" : "border-gray-200"}`}>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50/80 border-b border-gray-100">
        <span className="text-xs text-gray-500">{match.stage}</span>
        <span className="text-xs text-gray-400">{match.date} · {match.time} (IL)</span>
      </div>

      <div className="px-4 py-4 flex items-center justify-between">
        <div className="flex flex-col items-center gap-1.5 w-20">
          <span className="text-3xl">{match.h.flag}</span>
          <span className="font-medium text-xs">{match.h.name}</span>
        </div>

        <div className="flex items-center gap-2">
          {match.filled ? (
            <>
              <div className="flex items-center rounded-lg border border-green-200 overflow-hidden bg-green-50">
                <button className="w-9 h-9 flex items-center justify-center bg-green-50 text-green-400 text-sm font-bold">−</button>
                <span className="w-8 h-9 flex items-center justify-center font-bold text-xl text-green-700" style={{ fontFamily: "Inter" }}>{(match as { hs: number }).hs}</span>
                <button className="w-9 h-9 flex items-center justify-center bg-green-50 text-green-400 text-sm font-bold">+</button>
              </div>
              <span className="text-gray-300 text-lg">:</span>
              <div className="flex items-center rounded-lg border border-green-200 overflow-hidden bg-green-50">
                <button className="w-9 h-9 flex items-center justify-center bg-green-50 text-green-400 text-sm font-bold">−</button>
                <span className="w-8 h-9 flex items-center justify-center font-bold text-xl text-green-700" style={{ fontFamily: "Inter" }}>{(match as { as: number }).as}</span>
                <button className="w-9 h-9 flex items-center justify-center bg-green-50 text-green-400 text-sm font-bold">+</button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center rounded-lg border-2 border-dashed border-gray-200 overflow-hidden">
                <button className="w-9 h-9 flex items-center justify-center text-gray-300 text-sm font-bold">−</button>
                <span className="w-8 h-9 flex items-center justify-center font-bold text-xl text-gray-300" style={{ fontFamily: "Inter" }}>-</span>
                <button className="w-9 h-9 flex items-center justify-center text-gray-300 text-sm font-bold">+</button>
              </div>
              <span className="text-gray-200 text-lg">:</span>
              <div className="flex items-center rounded-lg border-2 border-dashed border-gray-200 overflow-hidden">
                <button className="w-9 h-9 flex items-center justify-center text-gray-300 text-sm font-bold">−</button>
                <span className="w-8 h-9 flex items-center justify-center font-bold text-xl text-gray-300" style={{ fontFamily: "Inter" }}>-</span>
                <button className="w-9 h-9 flex items-center justify-center text-gray-300 text-sm font-bold">+</button>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5 w-20">
          <span className="text-3xl">{match.a.flag}</span>
          <span className="font-medium text-xs">{match.a.name}</span>
        </div>
      </div>

      <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[10px] text-gray-400">⏱ ננעל 30 דק׳ לפני המשחק</span>
        {match.filled ? (
          <span className="text-[10px] text-green-600 font-medium">✓ נשמר · ניתן לשנות</span>
        ) : (
          <button className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium">שמירה</button>
        )}
      </div>
    </div>
  );
}

export function PredictionsPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">הימורי משחקים</h1>
        <p className="text-sm text-gray-500 mt-1">הזינו תוצאה מדויקת לכל משחק. ההימור ננעל 30 דקות לפני שריקת הפתיחה.</p>
      </div>

      {/* Pre-tournament info */}
      <div className="mb-5 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
        <p className="text-sm text-blue-800">💡 <strong>טיפ:</strong> מומלץ למלא את כל המשחקים מראש. תוכלו לשנות כל הימור עד 30 דקות לפני המשחק.</p>
      </div>

      {/* Progress */}
      <div className="mb-5 flex items-center gap-3">
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full" style={{ width: "3%" }}></div>
        </div>
        <span className="text-xs font-medium text-gray-500">2/104 משחקים</span>
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto">
        {["כל המשחקים", "בית A", "בית B", "בית C", "בית D", "בית E", "בית F"].map((tab, i) => (
          <button key={tab} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
            i === 0 ? "bg-blue-50 text-blue-600" : "text-gray-400 hover:bg-gray-50"
          }`}>{tab}</button>
        ))}
      </div>

      {/* Matches */}
      <div className="space-y-3">
        {MATCHDAY_1.map((m, i) => (
          <MatchCard key={i} match={m} />
        ))}
      </div>
    </div>
  );
}
