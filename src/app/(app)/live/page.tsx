"use client";

// Live page — shows matches from last 24h and next 12h
// In production: real-time updates from API-Football via Supabase Realtime

const F: Record<string,string> = {
  ARG:"🇦🇷",MEX:"🇲🇽",BRA:"🇧🇷",FRA:"🇫🇷",ENG:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",ESP:"🇪🇸",GER:"🇩🇪",POR:"🇵🇹",
  KSA:"🇸🇦",IDN:"🇮🇩",JPN:"🇯🇵",MAR:"🇲🇦",UZB:"🇺🇿",CAN:"🇨🇦",SEN:"🇸🇳",DEN:"🇩🇰",
};

const LIVE_MATCHES = [
  { id: 1, status: "live", minute: "72'", stage: "בית C · סיבוב 2",
    home: { code: "ARG", name: "ארגנטינה", goals: 2 },
    away: { code: "KSA", name: "ערב הסעודית", goals: 0 },
    yourPrediction: "2-0", yourStatus: "exact", potentialPts: "+3",
    friends: [{ name: "דני", pred: "3-0" }, { name: "יוני", pred: "1-0" }, { name: "רון", pred: "2-1" }, { name: "דור", pred: "2-0" }],
  },
  { id: 2, status: "live", minute: "45'+2", stage: "בית C · סיבוב 2",
    home: { code: "MEX", name: "מקסיקו", goals: 1 },
    away: { code: "IDN", name: "אינדונזיה", goals: 1 },
    yourPrediction: "2-0", yourStatus: "wrong", potentialPts: "+0",
    friends: [{ name: "דני", pred: "2-0" }, { name: "יוני", pred: "3-1" }],
  },
];

const UPCOMING = [
  { id: 3, status: "upcoming", time: "19:00", stage: "בית D · סיבוב 2",
    home: { code: "JPN", name: "יפן" }, away: { code: "MAR", name: "מרוקו" }, yourPrediction: null },
  { id: 4, status: "upcoming", time: "22:00", stage: "בית D · סיבוב 2",
    home: { code: "CAN", name: "קנדה" }, away: { code: "SEN", name: "סנגל" }, yourPrediction: "1-0" },
];

const FINISHED = [
  { id: 5, status: "finished", stage: "בית B · סיבוב 1",
    home: { code: "FRA", name: "צרפת", goals: 3 }, away: { code: "DEN", name: "דנמרק", goals: 1 },
    yourPrediction: "2-1", yourStatus: "toto", pts: "+2" },
  { id: 6, status: "finished", stage: "בית B · סיבוב 1",
    home: { code: "BRA", name: "ברזיל", goals: 2 }, away: { code: "UZB", name: "אוזבקיסטן", goals: 0 },
    yourPrediction: "2-0", yourStatus: "exact", pts: "+3" },
];

export default function LivePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
          <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>לייב</h1>
        </div>
        <p className="text-base text-gray-600">משחקים ב-24 שעות האחרונות ו-12 שעות קדימה</p>
      </div>

      {/* LIVE NOW */}
      {LIVE_MATCHES.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            עכשיו בשידור חי
          </h2>
          <div className="space-y-4">
            {LIVE_MATCHES.map(m => (
              <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-center gap-2 py-2.5 bg-red-50 border-b border-red-100">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
                  <span className="text-sm font-bold text-red-600 tracking-wider" style={{ fontFamily: "var(--font-inter)" }}>LIVE</span>
                  <span className="text-sm text-red-400">{m.minute}</span>
                </div>
                <div className="px-6 py-5 flex items-center justify-between">
                  <div className="flex flex-col items-center gap-2 w-28">
                    <span className="text-5xl">{F[m.home.code]}</span>
                    <span className="font-bold text-base text-gray-800">{m.home.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-black text-6xl tabular-nums text-gray-900" style={{ fontFamily: "var(--font-inter)" }}>{m.home.goals}</span>
                    <span className="text-gray-300 text-4xl font-light">-</span>
                    <span className="font-black text-6xl tabular-nums text-gray-900" style={{ fontFamily: "var(--font-inter)" }}>{m.away.goals}</span>
                  </div>
                  <div className="flex flex-col items-center gap-2 w-28">
                    <span className="text-5xl">{F[m.away.code]}</span>
                    <span className="font-bold text-base text-gray-800">{m.away.name}</span>
                  </div>
                </div>
                {/* Your prediction */}
                <div className={`border-t px-5 py-3 ${m.yourStatus === "exact" ? "bg-green-50 border-green-100" : "bg-amber-50 border-amber-100"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-gray-600">הניחוש שלך: </span>
                      <span className="text-base font-black text-gray-800" style={{ fontFamily: "var(--font-inter)" }}>{m.yourPrediction}</span>
                    </div>
                    <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold ${
                      m.yourStatus === "exact" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                    }`}>
                      {m.yourStatus === "exact" ? "תוצאה מדויקת!" : "לא תואם"}
                    </span>
                  </div>
                  {m.yourStatus === "exact" && (
                    <p className="text-sm text-green-600 font-semibold mt-1">אם נגמר ככה: <strong>{m.potentialPts} נקודות</strong></p>
                  )}
                </div>
                {/* Friends */}
                <div className="border-t border-gray-100 px-5 py-2.5">
                  <p className="text-sm text-gray-500 mb-1 font-medium">חברים:</p>
                  <div className="flex gap-4 text-sm text-gray-600">
                    {m.friends.map(f => (
                      <span key={f.name}>{f.name}: <strong className={f.pred === `${m.home.goals}-${m.away.goals}` ? "text-green-600" : ""}>{f.pred}</strong>
                        {f.pred === `${m.home.goals}-${m.away.goals}` && " 🎯"}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* UPCOMING */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-3">קרוב — היום</h2>
        <div className="space-y-3">
          {UPCOMING.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{F[m.home.code]}</span>
                <span className="font-bold text-base text-gray-800">{m.home.name}</span>
              </div>
              <div className="text-center">
                <p className="text-lg font-black text-gray-400" style={{ fontFamily: "var(--font-inter)" }}>{m.time}</p>
                <p className="text-xs text-gray-400">{m.stage}</p>
                {m.yourPrediction ? (
                  <p className="text-xs text-green-600 font-bold mt-1">ניחוש: {m.yourPrediction}</p>
                ) : (
                  <p className="text-xs text-amber-600 font-bold mt-1">טרם ניחשת</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-bold text-base text-gray-800">{m.away.name}</span>
                <span className="text-2xl">{F[m.away.code]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FINISHED */}
      <div className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-3">הסתיימו — אתמול</h2>
        <div className="space-y-3">
          {FINISHED.map(m => (
            <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{F[m.home.code]}</span>
                  <span className="font-bold text-base">{m.home.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-2xl tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{m.home.goals}</span>
                  <span className="text-gray-300 text-xl">-</span>
                  <span className="font-black text-2xl tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{m.away.goals}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-bold text-base">{m.away.name}</span>
                  <span className="text-2xl">{F[m.away.code]}</span>
                </div>
              </div>
              <div className={`px-5 py-2 border-t flex items-center justify-between ${m.yourStatus === "exact" ? "bg-green-50 border-green-100" : "bg-blue-50 border-blue-100"}`}>
                <span className="text-sm text-gray-600">ניחוש: <strong>{m.yourPrediction}</strong></span>
                <span className={`text-sm font-bold ${m.yourStatus === "exact" ? "text-green-600" : "text-blue-600"}`}>
                  {m.yourStatus === "exact" ? "מדויקת! " : "טוטו נכון "}{m.pts}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bracket health */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 mb-3">בריאות העץ שלך</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { value: "8/12", label: "בתים נכונים", color: "bg-green-50 border-green-200 text-green-600" },
            { value: "26/32", label: "עולות מהבתים", color: "bg-blue-50 border-blue-200 text-blue-600" },
            { value: "🇦🇷", label: "האלוף שלך חי", color: "bg-amber-50 border-amber-200 text-amber-600" },
            { value: "154", label: "סה״כ נקודות", color: "bg-purple-50 border-purple-200 text-purple-600" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border p-4 text-center ${s.color}`}>
              <p className="text-2xl font-black" style={{ fontFamily: "var(--font-inter)" }}>{s.value}</p>
              <p className="text-xs font-bold mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
