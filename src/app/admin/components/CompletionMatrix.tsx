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

export function CompletionMatrix() {
  const [users, setUsers] = useState<UserCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/completion");
        const data = await res.json();
        if (data.users) setUsers(data.users);
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
                      {check(u.specials >= 25)}
                      {u.specials < 25 && <span className="text-[10px] text-gray-400" style={{ fontFamily: "var(--font-inter)" }}>{u.specials}/25</span>}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-bold ${pctColor(u.totalPct)}`} style={{ fontFamily: "var(--font-inter)" }}>
                      {u.totalPct}%
                    </span>
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
