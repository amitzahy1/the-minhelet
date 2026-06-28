"use client";

import { useEffect, useState } from "react";

interface UserCompletion {
  name: string;
  email: string;
  groups: number;
  knockout: number;
  specials: number;
  totalPct: number;
}

interface KoStage {
  stage: string;
  label: string;
  openCount: number;
  users: { name: string; email: string; filled: number }[];
}
interface KoLive { open: boolean; stages: KoStage[] }

export function CompletionMatrix() {
  const [users, setUsers] = useState<UserCompletion[]>([]);
  const [koLive, setKoLive] = useState<KoLive | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/completion");
        const data = await res.json();
        if (data.users) setUsers(data.users);
        if (data.koLive) setKoLive(data.koLive);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/export-bets");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `wc2026-all-bets-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    setExporting(false);
  };

  const check = (done: boolean) => (
    <span className={`text-base font-bold ${done ? "text-green-600" : "text-red-400"}`}>
      {done ? "✓" : "✗"}
    </span>
  );

  const pctColor = (pct: number) =>
    pct === 100 ? "text-green-700 bg-green-100" :
    pct >= 50 ? "text-amber-700 bg-amber-100" :
    "text-red-700 bg-red-100";

  return (
    <div className="space-y-4">
      {/* Real-data tree (עץ נתוני אמת): per-stage completion of the matches that
          are OPEN right now — so the admin knows who still needs to bet. */}
      {koLive?.open && koLive.stages.map((stage) => {
        const missing = stage.users.filter((u) => u.filled < stage.openCount);
        return (
          <div key={stage.stage} className="rounded-xl border border-emerald-300 bg-emerald-50/50 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900 mb-0.5">🟢 עץ נתוני אמת — {stage.label}</h3>
                <p className="text-xs text-gray-500" style={{ fontFamily: "var(--font-inter)" }}>{stage.openCount} משחקים פתוחים כרגע · {missing.length} מהמרים טרם השלימו</p>
              </div>
              {missing.length > 0 && (
                <button
                  onClick={() => {
                    const text = `תזכורת: נפתחו ${stage.openCount} משחקים ב${stage.label} בעץ נתוני אמת. טרם מילאו: ${missing.map((u) => u.name).join(", ")}. בואו נשלים לפני הנעילה! ⚽`;
                    navigator.clipboard.writeText(text);
                    alert("התזכורת הועתקה!");
                  }}
                  className="shrink-0 text-[11px] font-bold text-blue-600 hover:text-blue-800 whitespace-nowrap"
                  title="העתק תזכורת לכל מי שחסר"
                >
                  📋 תזכורת לחסרים
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {stage.users.map((u, i) => {
                const done = u.filled >= stage.openCount;
                return (
                  <div key={i} className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${done ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
                    <span className="font-bold text-gray-800 truncate">{u.name}</span>
                    <span className="shrink-0 font-bold tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
                      {done ? <span className="text-green-600">✓</span> : <span className="text-red-500">{u.filled}/{stage.openCount}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">סטטוס מילוי הימורים</h3>
          <p className="text-sm text-gray-500">תמונת מצב — מי מילא ומי עוד לא</p>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={exporting}
          className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 text-xs font-bold hover:bg-green-100 transition-colors disabled:opacity-50"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {exporting ? "מייצא..." : "הורד CSV"}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-center py-6">טוען נתונים...</p>
      ) : users.length === 0 ? (
        <p className="text-gray-400 text-center py-6">אין מהמרים שהתחילו למלא</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-xs font-bold">
                <th className="py-3 px-3 text-start sticky right-0 bg-gray-50 z-10">שם</th>
                <th className="py-3 px-2 text-center whitespace-nowrap">בתים<br/><span className="text-gray-400 font-normal">/12</span></th>
                <th className="py-3 px-2 text-center whitespace-nowrap">נוקאאוט<br/><span className="text-gray-400 font-normal">/31</span></th>
                <th className="py-3 px-2 text-center whitespace-nowrap">מיוחדים<br/><span className="text-gray-400 font-normal">/25</span></th>
                <th className="py-3 px-3 text-center">סה״כ</th>
                <th className="py-3 px-2 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={i} className="border-t border-gray-100 hover:bg-gray-50/50">
                  <td className="py-3 px-3 sticky right-0 bg-white z-10">
                    <p className="font-bold text-gray-900">{u.name}</p>
                    {u.email && <p className="text-[11px] text-gray-400" dir="ltr">{u.email}</p>}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      {check(u.groups === 12)}
                      {u.groups < 12 && <span className="text-[10px] text-gray-400" style={{ fontFamily: "var(--font-inter)" }}>{u.groups}/12</span>}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      {check(u.knockout === 31)}
                      {u.knockout < 31 && <span className="text-[10px] text-gray-400" style={{ fontFamily: "var(--font-inter)" }}>{u.knockout}/31</span>}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      {check(u.specials >= 24)}
                      {u.specials < 25 && <span className="text-[10px] text-gray-400" style={{ fontFamily: "var(--font-inter)" }}>{u.specials}/25</span>}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${pctColor(u.totalPct)}`} style={{ fontFamily: "var(--font-inter)" }}>
                      {u.totalPct}%
                    </span>
                  </td>
                  <td className="py-3 px-2 text-center">
                    {u.totalPct < 100 && (
                      <button
                        onClick={() => {
                          const missing: string[] = [];
                          if (u.groups < 12) missing.push(`בתים (${u.groups}/12)`);
                          if (u.knockout < 31) missing.push(`נוקאאוט (${u.knockout}/31)`);
                          if (u.specials < 25) missing.push(`מיוחדים (${u.specials}/25)`);
                          const text = `היי ${u.name}! ההימורים ננעלו ועדיין חסרים לך: ${missing.join(", ")}. בוא נשלים ביחד! 🏆`;
                          navigator.clipboard.writeText(text);
                          alert("ההודעה הועתקה! הדבק בוואטסאפ או במייל");
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 whitespace-nowrap"
                        title="העתק תזכורת"
                      >
                        📋 העתק תזכורת
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
