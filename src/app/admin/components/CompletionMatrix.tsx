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
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">סטטוס מילוי הימורים</h3>
        <p className="text-sm text-gray-500">תמונת מצב — מי מילא ומי עוד לא</p>
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
