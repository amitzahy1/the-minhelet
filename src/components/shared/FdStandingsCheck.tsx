"use client";

// ============================================================================
// FdStandingsCheck — compact widget showing Football-Data.org's parallel
// group tables as a cross-check against our internal computation. Hidden by
// default; expandable. Useful for catching divergence between our group-
// standings math (head-to-head + FIFA Annex C tiebreaks) and FD's simpler
// points/GD/GF sort. If they disagree mid-tournament we want to know fast.
// ============================================================================

import { useEffect, useState } from "react";

interface FdRow {
  position: number;
  tla: string;
  name: string;
  crest: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  gf: number;
  ga: number;
  gd: number;
  form: string;
}
interface FdGroup { group: string | null; rows: FdRow[] }

export function FdStandingsCheck() {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<FdGroup[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    (async () => {
      try {
        const r = await fetch("/api/fd-standings");
        const j = await r.json();
        setGroups(j.groups || []);
        if (j.error) setError(String(j.error));
      } catch (e) {
        setError(String(e));
      } finally {
        setLoaded(true);
      }
    })();
  }, [open, loaded]);

  // Hide entirely until any group has been played — pre-tournament noise.
  const anyPlayed = groups.some((g) => g.rows.some((r) => r.played > 0));

  return (
    <details
      className="rounded-xl border border-gray-200 bg-gray-50/40 overflow-hidden"
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer px-4 py-2.5 text-xs text-gray-600 font-bold flex items-center justify-between hover:bg-gray-100/60">
        <span>📊 השוואה מול Football-Data.org</span>
        <span className="text-[10px] text-gray-400 font-medium">לחצו לפתיחה</span>
      </summary>
      <div className="p-3 space-y-3 text-xs">
        {!loaded && open && <p className="text-gray-400">טוען...</p>}
        {error && <p className="text-red-500">שגיאה: {error}</p>}
        {loaded && !anyPlayed && (
          <p className="text-gray-500 leading-relaxed">
            הטורניר עוד לא התחיל — Football-Data החזירו טבלה ריקה. ההשוואה תהפוך
            לבעלת ערך אחרי שיתחילו המשחקים. אם הטבלאות שלנו מתחילות להראות מספרים
            שונים מ-FD, פתחו את הוויג׳ט הזה לאיתור.
          </p>
        )}
        {loaded && anyPlayed && groups.filter((g) => g.rows.some((r) => r.played > 0)).map((g, idx) => (
          <div key={idx} className="rounded-lg border border-gray-200 bg-white p-2.5">
            <p className="font-bold text-gray-700 mb-1.5">{g.group?.replace("GROUP_", "בית ") || "כללי"}</p>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-gray-400 font-semibold text-[10px]">
                  <th className="text-start">#</th>
                  <th className="text-start">נבחרת</th>
                  <th className="text-center">M</th>
                  <th className="text-center">N</th>
                  <th className="text-center">+/-</th>
                  <th className="text-center font-black">נק׳</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.tla} className="border-t border-gray-100">
                    <td className="py-1 text-gray-400 font-bold">{r.position}</td>
                    <td className="py-1 font-bold text-gray-800">{r.tla}</td>
                    <td className="py-1 text-center" style={{ fontFamily: "var(--font-inter)" }}>{r.played}</td>
                    <td className="py-1 text-center" style={{ fontFamily: "var(--font-inter)" }}>{r.won}</td>
                    <td className="py-1 text-center" style={{ fontFamily: "var(--font-inter)" }}>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                    <td className="py-1 text-center font-black" style={{ fontFamily: "var(--font-inter)" }}>{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </details>
  );
}
