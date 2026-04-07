"use client";
import { LoadingPage } from "@/components/shared/LoadingAnimation";

import { useState, useEffect } from "react";

// Flags for all 48 teams
const F: Record<string,string> = {
  MEX:"🇲🇽",KOR:"🇰🇷",CZE:"🇨🇿",RSA:"🇿🇦",CAN:"🇨🇦",QAT:"🇶🇦",SUI:"🇨🇭",BIH:"🇧🇦",
  BRA:"🇧🇷",MAR:"🇲🇦",SCO:"🏴󠁧󠁢󠁳󠁣󠁴󠁿",HAI:"🇭🇹",USA:"🇺🇸",PAR:"🇵🇾",TUR:"🇹🇷",AUS:"🇦🇺",
  GER:"🇩🇪",ECU:"🇪🇨",CIV:"🇨🇮",CUR:"🇨🇼",NED:"🇳🇱",JPN:"🇯🇵",SWE:"🇸🇪",TUN:"🇹🇳",
  BEL:"🇧🇪",IRN:"🇮🇷",EGY:"🇪🇬",NZL:"🇳🇿",ESP:"🇪🇸",URU:"🇺🇾",KSA:"🇸🇦",CPV:"🇨🇻",
  FRA:"🇫🇷",SEN:"🇸🇳",NOR:"🇳🇴",IRQ:"🇮🇶",ARG:"🇦🇷",AUT:"🇦🇹",ALG:"🇩🇿",JOR:"🇯🇴",
  POR:"🇵🇹",COL:"🇨🇴",UZB:"🇺🇿",COD:"🇨🇩",ENG:"🏴󠁧󠁢󠁥󠁮󠁧󠁿",CRO:"🇭🇷",GHA:"🇬🇭",PAN:"🇵🇦",
};

// Hebrew team names
const HE: Record<string,string> = {
  MEX:"מקסיקו",KOR:"דרום קוריאה",CZE:"צ׳כיה",RSA:"דרום אפריקה",CAN:"קנדה",QAT:"קטאר",SUI:"שווייץ",BIH:"בוסניה",
  BRA:"ברזיל",MAR:"מרוקו",SCO:"סקוטלנד",HAI:"האיטי",USA:"ארה״ב",PAR:"פרגוואי",TUR:"טורקיה",AUS:"אוסטרליה",
  GER:"גרמניה",ECU:"אקוודור",CIV:"חוף השנהב",CUR:"קוראסאו",NED:"הולנד",JPN:"יפן",SWE:"שוודיה",TUN:"תוניסיה",
  BEL:"בלגיה",IRN:"איראן",EGY:"מצרים",NZL:"ניו זילנד",ESP:"ספרד",URU:"אורוגוואי",KSA:"סעודיה",CPV:"כף ורדה",
  FRA:"צרפת",SEN:"סנגל",NOR:"נורבגיה",IRQ:"עיראק",ARG:"ארגנטינה",AUT:"אוסטריה",ALG:"אלג׳יריה",JOR:"ירדן",
  POR:"פורטוגל",COL:"קולומביה",UZB:"אוזבקיסטן",COD:"קונגו",ENG:"אנגליה",CRO:"קרואטיה",GHA:"גאנה",PAN:"פנמה",
};

interface Match {
  id: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeTla: string;
  awayTla: string;
  group: string;
  stage: string;
}

export default function SchedulePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    fetchMatches();
  }, []);

  async function fetchMatches() {
    try {
      const res = await fetch("/api/matches");
      const data = await res.json();
      setMatches(data.matches || []);
    } catch {
      // Fallback — use static sample
    }
    setLoading(false);
  }

  // Convert UTC to Israel time
  function toIsraelTime(utcDate: string): string {
    const d = new Date(utcDate);
    return d.toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function toIsraelTimeShort(utcDate: string): string {
    const d = new Date(utcDate);
    return d.toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function toIsraelDate(utcDate: string): string {
    const d = new Date(utcDate);
    return d.toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  // Group matches by date
  const grouped: Record<string, Match[]> = {};
  const filtered = filter === "ALL" ? matches : matches.filter(m => m.group === `GROUP_${filter}` || m.stage === filter);
  for (const m of filtered) {
    const date = new Date(m.date).toISOString().split("T")[0];
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(m);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24" dir="rtl">
      <div className="mb-5">
        <h1 className="text-3xl font-black text-gray-900" style={{ fontFamily: "var(--font-secular)" }}>לוח משחקים</h1>
        <p className="text-base text-gray-600 mt-1">כל 104 המשחקים בשעון ישראל</p>
      </div>

      {/* Filter */}
      <div className="mb-4 flex gap-1 flex-wrap">
        {[
          { key: "ALL", label: "הכל" },
          ...["A","B","C","D","E","F","G","H","I","J","K","L"].map(g => ({ key: g, label: `בית ${g}` })),
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === f.key ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}>{f.label}</button>
        ))}
      </div>

      {loading ? (
        <LoadingPage />
      ) : matches.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 text-center">
          <p className="text-gray-500">לוח המשחקים יתעדכן מ-Football-Data.org כשיהיה זמין</p>
          <p className="text-sm text-gray-400 mt-2">בינתיים, מלאו את ההימורים שלכם בדפי ההימורים</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).sort().map(([date, dayMatches]) => (
            <div key={date}>
              <h2 className="text-base font-bold text-gray-800 mb-2 sticky top-28 bg-[#F8F9FB] py-1 z-10">
                {toIsraelDate(dayMatches[0].date)}
              </h2>
              <div className="space-y-2">
                {dayMatches.map(m => (
                  <div key={m.id} className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 grid grid-cols-[1fr_80px_1fr] items-center">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="font-bold text-sm text-end">{HE[m.homeTla] || m.homeTeam}</span>
                      <span className="text-lg shrink-0">{F[m.homeTla] || "🏳️"}</span>
                    </div>
                    <div className="text-center">
                      <p className="text-base font-black text-gray-900 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>{toIsraelTimeShort(m.date)}</p>
                      <p className="text-[10px] text-gray-400">{m.group?.replace("GROUP_", "בית ") || m.stage}</p>
                    </div>
                    <div className="flex items-center gap-2 justify-start">
                      <span className="text-lg shrink-0">{F[m.awayTla] || "🏳️"}</span>
                      <span className="font-bold text-sm">{HE[m.awayTla] || m.awayTeam}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
