"use client";

// ============================================================================
// SquadComparisonTable — bottom-of-squads-page comparison of all 26 announced
// teams. Computes total / median / average squad value, plus counts of
// €100M and €50M players, so the user can sanity-check the title contenders
// against the underdogs at a glance.
// ============================================================================

import { useMemo, useState } from "react";
import { OFFICIAL_ROSTERS } from "@/lib/tournament/official-rosters";
import { OFFICIAL_SQUADS } from "@/lib/tournament/official-squads";
import { getMarketValue, formatMarketValue } from "@/lib/tournament/market-values";
import { ALL_TEAMS } from "@/lib/tournament/groups";
import { getFlag } from "@/lib/flags";

type SortKey = "total" | "median" | "avg" | "max" | "count100" | "count50" | "rank";

interface Row {
  code: string;
  nameHe: string;
  group: string;
  total: number;
  median: number;
  avg: number;
  max: { value: number; name: string };
  count100: number;
  count50: number;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function buildRows(): Row[] {
  const teamMeta = new Map(ALL_TEAMS.map((t) => [t.code, t]));
  const rows: Row[] = [];
  for (const code of Object.keys(OFFICIAL_SQUADS)) {
    const roster = OFFICIAL_ROSTERS[code];
    if (!roster) continue;
    const meta = teamMeta.get(code);
    const values: { v: number; name: string }[] = [];
    for (const p of roster) {
      const v = getMarketValue(p.nameEn);
      if (v !== null) values.push({ v, name: p.nameEn });
    }
    if (values.length === 0) continue;
    const nums = values.map((x) => x.v);
    const total = nums.reduce((s, v) => s + v, 0);
    const maxEntry = values.reduce((a, b) => (a.v >= b.v ? a : b));
    rows.push({
      code,
      nameHe: meta?.name_he || code,
      group: meta?.group_id || "",
      total: Math.round(total * 10) / 10,
      median: Math.round(median(nums) * 10) / 10,
      avg: Math.round((total / nums.length) * 10) / 10,
      max: { value: maxEntry.v, name: maxEntry.name },
      count100: nums.filter((v) => v >= 100).length,
      count50: nums.filter((v) => v >= 50).length,
    });
  }
  return rows;
}

function SortableHead({
  label, sortKey, current, dir, onClick,
}: { label: string; sortKey: SortKey; current: SortKey; dir: "asc" | "desc"; onClick: (k: SortKey) => void }) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={`w-full px-2 py-2 text-center text-xs font-semibold transition-colors ${
        active ? "text-blue-600" : "text-gray-500 hover:text-gray-800"
      }`}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {active && <span className="text-[8px]">{dir === "desc" ? "▼" : "▲"}</span>}
      </span>
    </button>
  );
}

export function SquadComparisonTable() {
  const rows = useMemo(buildRows, []);
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  function toggleSort(k: SortKey) {
    if (k === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(k); setDir("desc"); }
  }

  const sorted = useMemo(() => {
    const getVal = (r: Row) => {
      switch (sortKey) {
        case "total": return r.total;
        case "median": return r.median;
        case "avg": return r.avg;
        case "max": return r.max.value;
        case "count100": return r.count100;
        case "count50": return r.count50;
        case "rank": default: return 0;
      }
    };
    return [...rows].sort((a, b) => (dir === "desc" ? getVal(b) - getVal(a) : getVal(a) - getVal(b)));
  }, [rows, sortKey, dir]);

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-5 text-sm text-gray-500">
        אין נתוני שווי שוק זמינים להשוואת נבחרות.
      </div>
    );
  }

  // Top-line summary (for context)
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const richestTeam = rows.reduce((a, b) => (a.total >= b.total ? a : b));
  const cheapestTeam = rows.reduce((a, b) => (a.total <= b.total ? a : b));

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden mt-8" dir="rtl">
      <div className="px-5 py-4 bg-gradient-to-l from-white via-emerald-50/30 to-teal-50/40 border-b border-emerald-100/50">
        <h2 className="text-lg font-bold text-gray-900">השוואת שווי סגלים</h2>
        <p className="text-xs text-gray-500 mt-1">
          {rows.length} נבחרות שפרסמו סגל רשמי · סה״כ שווי {formatMarketValue(grandTotal)} ·
          הכי יקרה: {getFlag(richestTeam.code)} {richestTeam.nameHe} ({formatMarketValue(richestTeam.total)}) ·
          הכי זולה: {getFlag(cheapestTeam.code)} {cheapestTeam.nameHe} ({formatMarketValue(cheapestTeam.total)})
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="w-12 px-2 py-2 text-xs text-gray-500 font-semibold">#</th>
              <th className="px-2 py-2 text-xs text-gray-500 font-semibold text-start">נבחרת</th>
              <th className="px-2 py-2 text-xs text-gray-500 font-semibold text-center">בית</th>
              <th><SortableHead label="סה״כ שווי" sortKey="total" current={sortKey} dir={dir} onClick={toggleSort} /></th>
              <th><SortableHead label="חציון" sortKey="median" current={sortKey} dir={dir} onClick={toggleSort} /></th>
              <th><SortableHead label="ממוצע" sortKey="avg" current={sortKey} dir={dir} onClick={toggleSort} /></th>
              <th className="px-2 py-2 text-xs text-gray-500 font-semibold text-center">שחקן הכי יקר</th>
              <th><SortableHead label="100M+" sortKey="count100" current={sortKey} dir={dir} onClick={toggleSort} /></th>
              <th><SortableHead label="50M+" sortKey="count50" current={sortKey} dir={dir} onClick={toggleSort} /></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.code} className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-colors">
                <td className="px-2 py-2.5 text-center text-gray-400 font-bold">
                  {sortKey === "total" && dir === "desc" && i === 0 ? "🥇" : sortKey === "total" && dir === "desc" && i === 1 ? "🥈" : sortKey === "total" && dir === "desc" && i === 2 ? "🥉" : i + 1}
                </td>
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getFlag(r.code)}</span>
                    <span className="font-bold text-gray-800">{r.nameHe}</span>
                    <span className="text-[10px] text-gray-400" style={{ fontFamily: "var(--font-inter)" }}>{r.code}</span>
                  </div>
                </td>
                <td className="px-2 py-2.5 text-center text-xs text-gray-500">{r.group}</td>
                <td className={`px-2 py-2.5 text-center tabular-nums font-bold ${sortKey === "total" ? "text-blue-700" : "text-gray-800"}`} style={{ fontFamily: "var(--font-inter)" }}>
                  {formatMarketValue(r.total)}
                </td>
                <td className={`px-2 py-2.5 text-center tabular-nums ${sortKey === "median" ? "text-blue-700 font-bold" : "text-gray-600"}`} style={{ fontFamily: "var(--font-inter)" }}>
                  {formatMarketValue(r.median)}
                </td>
                <td className={`px-2 py-2.5 text-center tabular-nums ${sortKey === "avg" ? "text-blue-700 font-bold" : "text-gray-600"}`} style={{ fontFamily: "var(--font-inter)" }}>
                  {formatMarketValue(r.avg)}
                </td>
                <td className="px-2 py-2.5 text-center text-xs">
                  <div className="flex flex-col items-center">
                    <span className="text-gray-800 truncate max-w-[120px]">{r.max.name}</span>
                    <span className="text-emerald-600 tabular-nums font-bold" style={{ fontFamily: "var(--font-inter)" }}>{formatMarketValue(r.max.value)}</span>
                  </div>
                </td>
                <td className={`px-2 py-2.5 text-center tabular-nums ${sortKey === "count100" ? "text-blue-700 font-bold" : "text-gray-600"}`} style={{ fontFamily: "var(--font-inter)" }}>
                  {r.count100 || "—"}
                </td>
                <td className={`px-2 py-2.5 text-center tabular-nums ${sortKey === "count50" ? "text-blue-700 font-bold" : "text-gray-600"}`} style={{ fontFamily: "var(--font-inter)" }}>
                  {r.count50 || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-[11px] text-gray-400 leading-relaxed border-t border-gray-100">
        רק נבחרות שפרסמו את ה-26 הרשמי שלהן (סה״כ {rows.length} מ-48). חישוב מבוסס שווי שוק לפי Transfermarkt
        + ערכות חדשות ידנית למאי 2026. נבחרות שעדיין לא פרסמו סגל לא מופיעות בטבלה.
      </p>
    </div>
  );
}
