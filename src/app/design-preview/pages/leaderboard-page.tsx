"use client";

// ============================================================================
// Leaderboard Page — Table FIRST, then charts below
// Clear bold headers, darker backgrounds, RTL throughout
// ============================================================================

const PLAYERS = [
  { rank: 1, name: "דני", matchPts: 95, advPts: 52, specPts: 21, total: 168, today: "+12", delta: "▲3", dc: "text-green-500", medal: "🥇", history: [45, 67, 89, 110, 132, 156, 168] },
  { rank: 2, name: "יוני", matchPts: 88, advPts: 55, specPts: 18, total: 161, today: "+8", delta: "▲1", dc: "text-green-500", medal: "🥈", history: [50, 72, 88, 105, 128, 148, 161] },
  { rank: 3, name: "דור דסא", matchPts: 82, advPts: 60, specPts: 15, total: 157, today: "+15", delta: "▲2", dc: "text-green-500", medal: "🥉", history: [42, 58, 80, 98, 120, 140, 157] },
  { rank: 4, name: "אמית", matchPts: 90, advPts: 45, specPts: 19, total: 154, today: "+6", delta: "—", dc: "text-gray-400", medal: "", isYou: true, history: [55, 70, 85, 108, 125, 145, 154] },
  { rank: 5, name: "רון ב", matchPts: 78, advPts: 50, specPts: 16, total: 144, today: "+10", delta: "▼1", dc: "text-red-400", medal: "", history: [48, 65, 82, 100, 118, 135, 144] },
  { rank: 6, name: "רון ג", matchPts: 75, advPts: 42, specPts: 20, total: 137, today: "+4", delta: "▼2", dc: "text-red-400", medal: "", history: [40, 60, 78, 95, 115, 130, 137] },
  { rank: 7, name: "רועי", matchPts: 72, advPts: 48, specPts: 14, total: 134, today: "+7", delta: "▲1", dc: "text-green-500", medal: "", history: [35, 52, 68, 88, 108, 125, 134] },
  { rank: 8, name: "עידן", matchPts: 68, advPts: 44, specPts: 17, total: 129, today: "+5", delta: "—", dc: "text-gray-400", medal: "", history: [38, 55, 72, 90, 105, 120, 129] },
  { rank: 9, name: "אוהד", matchPts: 65, advPts: 38, specPts: 22, total: 125, today: "+9", delta: "▲2", dc: "text-green-500", medal: "", history: [30, 48, 62, 80, 98, 115, 125] },
  { rank: 10, name: "אורי", matchPts: 60, advPts: 40, specPts: 13, total: 113, today: "+3", delta: "▼1", dc: "text-red-400", medal: "", history: [25, 40, 55, 72, 88, 105, 113] },
];

// SVG mini sparkline
function Sparkline({ data, color = "#3B82F6", highlight = false }: { data: number[]; color?: string; highlight?: boolean }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80, h = 24;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="overflow-visible" style={{ direction: "ltr" }}>
      <polyline points={points} fill="none" stroke={highlight ? "#3B82F6" : color} strokeWidth={highlight ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={w} cy={h - ((data[data.length - 1] - min) / range) * h} r={2.5} fill={highlight ? "#3B82F6" : color} />
    </svg>
  );
}

export function LeaderboardPage() {
  const maxPts = Math.max(...PLAYERS.map(p => p.total));

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">

      {/* === PAGE HEADER === */}
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular), sans-serif" }}>מי מוביל?</h1>
        <p className="text-base text-gray-600 mt-1">מונדיאל 2026 — The Minhelet · עקבו אחרי המירוץ בזמן אמת</p>
      </div>

      {/* ============================================================ */}
      {/* 1. MAIN LEADERBOARD TABLE — FIRST */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-3 bg-gray-100 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-800">טבלת דירוג</h2>
          <div className="flex gap-1 text-[10px]">
            <span className="px-2.5 py-1 rounded-full bg-gray-900 text-white font-medium">כללי</span>
            <span className="px-2.5 py-1 rounded-full text-gray-500 hover:bg-gray-200">משחקים</span>
            <span className="px-2.5 py-1 rounded-full text-gray-500 hover:bg-gray-200">עולות</span>
            <span className="px-2.5 py-1 rounded-full text-gray-500 hover:bg-gray-200">מיוחדים</span>
          </div>
        </div>

        {/* Header row */}
        <div className="hidden sm:flex items-center px-4 py-2 text-[9px] text-gray-500 bg-gray-50 border-b border-gray-200 uppercase tracking-wide font-medium" style={{ fontFamily: "Inter" }}>
          <span className="w-8 text-center">#</span>
          <span className="w-9 me-2"></span>
          <span className="me-3 flex-1 text-start">שחקן</span>
          <span className="w-12 text-center">משחקים</span>
          <span className="w-12 text-center">עולות</span>
          <span className="w-12 text-center">מיוחדים</span>
          <span className="w-20 text-center">מגמה</span>
          <span className="w-10 text-center">היום</span>
          <span className="w-14 text-center">סה״כ</span>
          <span className="w-6"></span>
        </div>

        {PLAYERS.map((p) => (
          <div key={p.rank} className={`flex items-center px-4 py-2.5 border-b border-gray-100 last:border-0 transition-colors ${
            p.isYou ? "bg-blue-50/50" : "hover:bg-gray-50/50"
          }`}>
            <span className="w-8 text-center font-bold text-sm text-gray-400">{p.medal || p.rank}</span>
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold me-2 ${
              p.rank === 1 ? "bg-amber-100 text-amber-700 ring-2 ring-amber-300" :
              p.rank === 2 ? "bg-gray-200 text-gray-600" :
              p.rank === 3 ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-500"
            }`}>{p.name[0]}</div>
            <div className="me-3 flex-1 min-w-0">
              <span className="font-semibold text-sm text-gray-900">{p.name}</span>
              {p.isYou && <span className="text-[10px] text-blue-500 ms-1 bg-blue-100 rounded px-1">אתה</span>}
            </div>
            <span className="w-12 text-center text-xs text-gray-500 hidden sm:block" style={{ fontFamily: "Inter" }}>{p.matchPts}</span>
            <span className="w-12 text-center text-xs text-gray-500 hidden sm:block" style={{ fontFamily: "Inter" }}>{p.advPts}</span>
            <span className="w-12 text-center text-xs text-gray-500 hidden sm:block" style={{ fontFamily: "Inter" }}>{p.specPts}</span>
            <div className="w-20 hidden sm:flex justify-center">
              <Sparkline data={p.history} highlight={!!p.isYou} color="#94A3B8" />
            </div>
            <span className="w-10 text-center text-xs text-green-600 font-medium" style={{ fontFamily: "Inter" }}>{p.today}</span>
            <span className="w-14 text-center font-bold text-base text-gray-900 tabular-nums" style={{ fontFamily: "Inter" }}>{p.total}</span>
            <span className={`w-6 text-center text-xs ${p.dc}`}>{p.delta}</span>
          </div>
        ))}
      </div>

      {/* ============================================================ */}
      {/* 2. FULL COMPARISON TABLE */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 bg-gray-100 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">השוואת כל המהמרים — מטריקות מפורטות</h2>
          <p className="text-sm text-gray-500 mt-0.5">כל הנתונים במקום אחד — מי הכי חזק בכל קטגוריה?</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider font-semibold border-b border-gray-200" style={{ fontFamily: "var(--font-inter)" }}>
                <th className="py-3 px-4 text-start sticky start-0 bg-gray-50 z-10">שחקן</th>
                <th className="py-3 px-3 text-center font-bold">סה״כ</th>
                <th className="py-3 px-3 text-center">% טוטו</th>
                <th className="py-3 px-3 text-center">מדויקות</th>
                <th className="py-3 px-3 text-center">משחקים</th>
                <th className="py-3 px-3 text-center">עולות</th>
                <th className="py-3 px-3 text-center">מיוחדים</th>
                <th className="py-3 px-3 text-center">רצף</th>
                <th className="py-3 px-3 text-center">יום טוב</th>
                <th className="py-3 px-3 text-center">יום רע</th>
                <th className="py-3 px-3 text-center">ממוצע</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "דני", medal: "🥇", total: 168, toto: "65%", exact: 16, match: 95, adv: 52, spec: 21, streak: 8, best: "+18", worst: "+2", avg: "8.4", isYou: false },
                { name: "יוני", medal: "🥈", total: 161, toto: "62%", exact: 14, match: 88, adv: 55, spec: 18, streak: 6, best: "+16", worst: "+1", avg: "8.1", isYou: false },
                { name: "דור דסא", medal: "🥉", total: 157, toto: "60%", exact: 13, match: 82, adv: 60, spec: 15, streak: 5, best: "+20", worst: "+3", avg: "7.9", isYou: false },
                { name: "אמית", medal: "", total: 154, toto: "62%", exact: 14, match: 90, adv: 45, spec: 19, streak: 7, best: "+23", worst: "+0", avg: "7.7", isYou: true },
                { name: "רון ב", medal: "", total: 144, toto: "58%", exact: 11, match: 78, adv: 50, spec: 16, streak: 4, best: "+15", worst: "+1", avg: "7.2", isYou: false },
                { name: "רון ג", medal: "", total: 137, toto: "55%", exact: 10, match: 75, adv: 42, spec: 20, streak: 3, best: "+14", worst: "+0", avg: "6.9", isYou: false },
                { name: "רועי", medal: "", total: 134, toto: "56%", exact: 12, match: 72, adv: 48, spec: 14, streak: 5, best: "+16", worst: "+2", avg: "6.7", isYou: false },
                { name: "עידן", medal: "", total: 129, toto: "54%", exact: 9, match: 68, adv: 44, spec: 17, streak: 4, best: "+13", worst: "+1", avg: "6.5", isYou: false },
                { name: "אוהד", medal: "", total: 125, toto: "52%", exact: 8, match: 65, adv: 38, spec: 22, streak: 3, best: "+17", worst: "+0", avg: "6.3", isYou: false },
                { name: "אורי", medal: "", total: 113, toto: "48%", exact: 7, match: 60, adv: 40, spec: 13, streak: 2, best: "+12", worst: "+0", avg: "5.7", isYou: false },
              ].map((p, i) => (
                <tr key={i} className={`border-t border-gray-100 ${p.isYou ? "bg-blue-50/40" : "hover:bg-gray-50/30"}`}>
                  <td className="py-3 px-4 sticky start-0 bg-inherit z-10">
                    <span className="flex items-center gap-2">
                      {p.medal && <span className="text-base">{p.medal}</span>}
                      <span className={`font-bold ${p.isYou ? "text-blue-700" : "text-gray-900"}`}>{p.name}</span>
                      {p.isYou && <span className="text-xs text-blue-500 bg-blue-100 rounded px-1.5 py-0.5 font-medium">אתה</span>}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-black text-gray-900 text-base" style={{ fontFamily: "var(--font-inter)" }}>{p.total}</td>
                  <td className="py-3 px-3 text-center">
                    <span className={`font-bold ${parseInt(p.toto) >= 60 ? "text-green-600" : parseInt(p.toto) >= 55 ? "text-amber-600" : "text-red-500"}`}>{p.toto}</span>
                  </td>
                  <td className="py-3 px-3 text-center text-gray-700 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{p.exact}</td>
                  <td className="py-3 px-3 text-center text-blue-600 font-semibold" style={{ fontFamily: "var(--font-inter)" }}>{p.match}</td>
                  <td className="py-3 px-3 text-center text-green-600 font-semibold" style={{ fontFamily: "var(--font-inter)" }}>{p.adv}</td>
                  <td className="py-3 px-3 text-center text-purple-600 font-semibold" style={{ fontFamily: "var(--font-inter)" }}>{p.spec}</td>
                  <td className="py-3 px-3 text-center text-amber-600 font-bold">{p.streak} 🔥</td>
                  <td className="py-3 px-3 text-center text-green-600 font-bold" style={{ fontFamily: "var(--font-inter)" }}>{p.best}</td>
                  <td className="py-3 px-3 text-center text-red-400 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{p.worst}</td>
                  <td className="py-3 px-3 text-center text-gray-500 font-medium" style={{ fontFamily: "var(--font-inter)" }}>{p.avg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 3. CATEGORY LEADERS */}
      {/* ============================================================ */}
      <div className="mb-6">
        <h2 className="text-lg font-bold text-gray-900 mb-3">מלכי הקטגוריות — מי הכי טוב בכל תחום?</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { title: "מלך הטוטו", name: "דני", value: "65%", bg: "bg-green-50 border-green-200" },
            { title: "צלף מדויק", name: "דני", value: "16", bg: "bg-blue-50 border-blue-200" },
            { title: "מנבא העולות", name: "דור דסא", value: "60 נק׳", bg: "bg-emerald-50 border-emerald-200" },
            { title: "מלך המיוחדים", name: "אוהד", value: "22 נק׳", bg: "bg-purple-50 border-purple-200" },
            { title: "רצף הכי ארוך", name: "דני", value: "8 ברצף", bg: "bg-amber-50 border-amber-200" },
            { title: "יום הכי חזק", name: "אמית", value: "+23", bg: "bg-orange-50 border-orange-200" },
            { title: "הכי עקבי", name: "דני", value: "8.4/יום", bg: "bg-sky-50 border-sky-200" },
            { title: "מלך ההפתעות", name: "אוהד", value: "4 אפסטים", bg: "bg-pink-50 border-pink-200" },
          ].map(cat => (
            <div key={cat.title} className={`rounded-xl border p-3 text-center ${cat.bg}`}>
              <p className="text-[10px] text-gray-500 font-medium">{cat.title}</p>
              <p className="text-xl font-bold text-gray-900 mt-1" style={{ fontFamily: "Inter" }}>{cat.value}</p>
              <p className="text-xs font-semibold text-blue-600 mt-0.5">{cat.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 4. HEAD TO HEAD */}
      {/* ============================================================ */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 bg-gray-100 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">ראש בראש — איפה את/ה ביחס למתחרים?</h2>
        </div>
        <div className="p-4 space-y-2.5">
          {[
            { rival: "דני (מקום 1)", gap: -14, trend: "מתקרב", detail: "הוא חזק בטוטו, את/ה חזק/ה במיוחדים" },
            { rival: "יוני (מקום 2)", gap: -7, trend: "מתקרב", detail: "פער מצטמצם ב-3 ימים אחרונים" },
            { rival: "דור (מקום 3)", gap: -3, trend: "כמעט!", detail: "הוא מוביל בעולות, את/ה במשחקים" },
            { rival: "רון ב (מקום 5)", gap: 10, trend: "מוביל", detail: "פער יציב" },
          ].map(r => (
            <div key={r.rival} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50">
              <span className="text-sm text-gray-800 font-bold flex-1">{r.rival}</span>
              <span className="text-sm text-gray-400 hidden sm:block">{r.detail}</span>
              <span className={`text-lg font-black tabular-nums ${r.gap > 0 ? "text-green-600" : "text-red-500"}`} style={{ fontFamily: "var(--font-inter)" }}>
                {r.gap > 0 ? `+${r.gap}` : r.gap}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                r.trend === "מוביל" ? "bg-green-100 text-green-700" : r.trend === "כמעט!" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
              }`}>{r.trend}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/* 5. STATS + CHART — AT THE BOTTOM */}
      {/* ============================================================ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Personal stats */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
            <h2 className="text-sm font-bold text-gray-800">הסטטיסטיקות שלך</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <div className="text-center p-2.5 rounded-lg bg-green-50 border border-green-200">
              <p className="text-2xl font-bold text-green-600" style={{ fontFamily: "Inter" }}>62%</p>
              <p className="text-[10px] text-green-700 font-medium">טוטו נכון</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-blue-50 border border-blue-200">
              <p className="text-2xl font-bold text-blue-600" style={{ fontFamily: "Inter" }}>14</p>
              <p className="text-[10px] text-blue-700 font-medium">תוצאות מדויקות</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-purple-50 border border-purple-200">
              <p className="text-2xl font-bold text-purple-600" style={{ fontFamily: "Inter" }}>7</p>
              <p className="text-[10px] text-purple-700 font-medium">רצף נכונים</p>
            </div>
            <div className="text-center p-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-2xl font-bold text-amber-600" style={{ fontFamily: "Inter" }}>+23</p>
              <p className="text-[10px] text-amber-700 font-medium">יום הכי חזק</p>
            </div>
          </div>
        </div>

        {/* Race chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-100 border-b border-gray-200">
            <h2 className="text-sm font-bold text-gray-800">מרוץ הניקוד — מי עקף את מי?</h2>
          </div>
          <div className="p-4">
            <div dir="ltr" className="relative h-36">
              {/* Y axis */}
              <div className="absolute inset-y-0 left-0 w-7 flex flex-col justify-between text-[8px] text-gray-300 text-right pr-0.5" style={{ fontFamily: "Inter" }}>
                <span>{maxPts}</span>
                <span>{Math.round(maxPts * 0.5)}</span>
                <span>0</span>
              </div>
              {/* Grid */}
              <div className="absolute inset-0 ml-7 flex flex-col justify-between">
                {[0,1,2].map(i => <div key={i} className="border-t border-gray-100"></div>)}
              </div>
              {/* Lines */}
              <svg className="absolute top-0 bottom-0 left-7 right-0" viewBox="0 0 300 140" preserveAspectRatio="none">
                {PLAYERS.slice(0, 5).map((p, pi) => {
                  const colors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444"];
                  const pts = p.history.map((v, i) => `${(i / (p.history.length - 1)) * 300},${140 - (v / maxPts) * 140}`).join(" ");
                  return <polyline key={pi} points={pts} fill="none" stroke={colors[pi]} strokeWidth={p.isYou ? 3 : 1.5} strokeLinecap="round" strokeLinejoin="round" opacity={p.isYou ? 1 : 0.5} />;
                })}
              </svg>
            </div>
            {/* X axis */}
            <div dir="ltr" className="flex justify-between ml-7 mt-1 text-[8px] text-gray-300" style={{ fontFamily: "Inter" }}>
              <span>MD1</span><span>MD2</span><span>MD3</span><span>R32</span><span>R16</span><span>QF</span><span>SF</span>
            </div>
            {/* Legend */}
            <div className="flex gap-3 mt-2 justify-center flex-wrap">
              {PLAYERS.slice(0, 5).map((p, i) => {
                const colors = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444"];
                return (
                  <span key={i} className="flex items-center gap-1 text-[9px] text-gray-500">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: colors[i] }}></span>
                    {p.name}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
