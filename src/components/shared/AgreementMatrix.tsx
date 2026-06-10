"use client";

// Pairwise pick-agreement heatmap ("מי חושב כמו מי") — compare page tab.
// Uses the SAME metric as the מתנשקים/המנותק titles (group order positions +
// Tree-1 knockout winners + champion), so the matrix and the titles can never
// disagree. Green = thinking alike, red = opposites; symmetric, diagonal is —.

import { agreementPct } from "@/lib/league-titles";
import type { BettorBracket } from "@/lib/supabase/shared-data";

function cellColor(v: number | null): React.CSSProperties {
  if (v === null) return { backgroundColor: "#f1f5f9" };
  // 0% → red hue, 100% → green hue; pastel lightness keeps dark text readable.
  const hue = Math.round((Math.max(0, Math.min(100, v)) * 1.2));
  return { backgroundColor: `hsl(${hue}, 72%, 82%)` };
}

export function AgreementMatrix({
  brackets,
  currentUserId,
}: {
  brackets: BettorBracket[];
  currentUserId?: string | null;
}) {
  const bettors = brackets.filter((b) => b.userId);
  if (bettors.length < 2) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-8 text-center">
        <p className="text-sm text-gray-500">אין מספיק מהמרים למטריצה</p>
      </div>
    );
  }

  const matrix = bettors.map((a) =>
    bettors.map((b) => (a.userId === b.userId ? null : agreementPct(a, b))),
  );

  const shortName = (name: string) => {
    const n = (name || "ללא שם").trim();
    return n.length > 6 ? `${n.slice(0, 5)}…` : n;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden">
      <div className="px-5 py-3 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
        <h3 className="text-lg font-bold text-gray-900">מטריצת הסכמה</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          כמה אחוז מההימורים של כל זוג זהים (סדר בתים, עץ נוקאאוט, אלופה) ·
          <span className="text-green-700 font-bold"> ירוק = חושבים אותו דבר</span> ·
          <span className="text-red-600 font-bold"> אדום = הפוכים</span>
        </p>
      </div>
      <div className="overflow-x-auto p-3">
        <table className="border-separate" style={{ borderSpacing: "3px" }}>
          <thead>
            <tr>
              <th className="sticky right-0 bg-white z-10" />
              {bettors.map((b) => (
                <th
                  key={b.userId}
                  title={b.displayName}
                  className={`text-[10px] font-bold px-1 pb-1 max-w-[3.5rem] truncate ${
                    b.userId === currentUserId ? "text-blue-600" : "text-gray-600"
                  }`}
                >
                  {shortName(b.displayName)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bettors.map((row, i) => (
              <tr key={row.userId}>
                <th
                  title={row.displayName}
                  className={`sticky right-0 bg-white z-10 text-[11px] font-bold px-1.5 text-end whitespace-nowrap ${
                    row.userId === currentUserId ? "text-blue-600" : "text-gray-700"
                  }`}
                >
                  {shortName(row.displayName)}
                </th>
                {bettors.map((col, j) => {
                  const v = matrix[i][j];
                  return (
                    <td
                      key={col.userId}
                      title={v === null ? "" : `${row.displayName} ↔ ${col.displayName}: ${Math.round(v)}%`}
                      style={cellColor(v)}
                      className="w-10 h-9 min-w-10 text-center rounded-md text-[11px] font-black text-gray-800 tabular-nums"
                    >
                      {v === null ? <span className="text-gray-300">—</span> : Math.round(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[10px] text-gray-400 mt-2">המספר בכל תא הוא אחוז ההסכמה בין השניים</p>
      </div>
    </div>
  );
}
