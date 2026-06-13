"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTeamNameHe } from "@/lib/flags";

interface LogRow {
  id: number;
  name: string;
  change_type: string;
  match_key: string;
  old_value: { home?: number | null; away?: number | null; winner?: string | null } | null;
  new_value: { home?: number | null; away?: number | null; winner?: string | null } | null;
  source: string;
  changed_at: string;
}

function fmtScore(v: LogRow["old_value"]): string {
  if (!v) return "—";
  if (v.home != null || v.away != null) return `${v.away ?? "-"}-${v.home ?? "-"}`; // away-home (RTL convention)
  if (v.winner) return getTeamNameHe(v.winner) || v.winner;
  return "—";
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" });
}

export function BetChangeLog() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/bet-log");
      const data = await res.json();
      if (data.needsMigration) setNeedsMigration(true);
      setRows(data.rows || []);
      if (data.error) setError(data.error);
    } catch {
      setError("שגיאת רשת");
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">יומן שינויי הימורים</CardTitle>
          <Button onClick={load} disabled={loading} variant="outline" size="sm">
            {loading ? "טוען..." : "רענן"}
          </Button>
        </div>
        <p className="text-sm text-gray-500">מי שינה איזה הימור, מאיזה ערך לאיזה, ומתי (לפי שעון ישראל). נרשם אוטומטית מרגע התקנת המיגרציה.</p>
      </CardHeader>
      <CardContent>
        {needsMigration ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-bold mb-1">⚙️ צריך להריץ מיגרציה פעם אחת</p>
            <p>הריצו את <code className="bg-amber-100 px-1 rounded">supabase/migrations/027_bet_change_log.sql</code> ב-Supabase (SQL editor). מאותו רגע כל שינוי הימור יירשם כאן.</p>
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">עדיין אין שינויים מתועדים.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 font-bold border-b border-gray-200">
                  <th className="py-2 px-2 text-start">מתי</th>
                  <th className="py-2 px-2 text-start">מהמר</th>
                  <th className="py-2 px-2 text-start">הימור</th>
                  <th className="py-2 px-2 text-center">מ-</th>
                  <th className="py-2 px-2 text-center">ל-</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="py-2 px-2 text-gray-500 whitespace-nowrap" style={{ fontFamily: "var(--font-inter)" }}>{fmtWhen(r.changed_at)}</td>
                    <td className="py-2 px-2 font-bold text-gray-800">{r.name}</td>
                    <td className="py-2 px-2 text-gray-600">
                      {r.change_type === "group_score" ? `בית ${r.match_key.replace(":", " · משחק ")}` : `נוק-אאוט · ${r.match_key}`}
                    </td>
                    <td className="py-2 px-2 text-center text-gray-400 tabular-nums" dir="ltr" style={{ fontFamily: "var(--font-inter)" }}>{fmtScore(r.old_value)}</td>
                    <td className="py-2 px-2 text-center font-bold text-gray-900 tabular-nums" dir="ltr" style={{ fontFamily: "var(--font-inter)" }}>{fmtScore(r.new_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
