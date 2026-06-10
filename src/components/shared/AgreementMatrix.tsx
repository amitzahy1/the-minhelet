"use client";

// Pairwise pick-agreement heatmap ("מי חושב כמו מי") — compare page tab.
// Uses the SAME metric as the מתנשקים/המנותק titles (group order positions +
// Tree-1 knockout winners + champion), so the matrix and the titles can never
// disagree. Green = thinking alike, red = opposites; symmetric, diagonal is —.

import { agreementPct } from "@/lib/league-titles";
import type { BettorBracket } from "@/lib/supabase/shared-data";

/**
 * Color scale NORMALIZED to the league's actual value range. Real agreement
 * values cluster in a narrow band (e.g. 45–91%) — an absolute 0–100 scale
 * paints everything yellow-green. Here the league's lowest pair is full red
 * and the highest full green, so differences pop.
 */
function cellColor(v: number | null, min: number, max: number): React.CSSProperties {
  if (v === null) return { backgroundColor: "#f1f5f9" };
  const t = max > min ? (v - min) / (max - min) : 0.5;
  const hue = Math.round(t * 120); // 0 = red → 120 = green
  return { backgroundColor: `hsl(${hue}, 78%, ${84 - t * 8}%)` };
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
  const values = matrix.flat().filter((v): v is number => v !== null);
  const minV = values.length ? Math.min(...values) : 0;
  const maxV = values.length ? Math.max(...values) : 100;

  // Top-5 closest pairs — the matrix's headline finding, ranked.
  const closestPairs = (() => {
    const pairs: { a: string; b: string; pct: number }[] = [];
    for (let i = 0; i < bettors.length; i++) {
      for (let j = i + 1; j < bettors.length; j++) {
        const v = matrix[i][j];
        if (v !== null) {
          pairs.push({ a: bettors[i].displayName || "ללא שם", b: bettors[j].displayName || "ללא שם", pct: v });
        }
      }
    }
    return pairs.sort((x, y) => y.pct - x.pct).slice(0, 5);
  })();

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
      {/* Top-5 closest pairs */}
      {closestPairs.length > 0 && (
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <p className="text-xs font-bold text-gray-600 mb-2">🏅 חמשת הזוגות הכי קרובים</p>
          <div className="space-y-1">
            {closestPairs.map((p, i) => (
              <div key={`${p.a}-${p.b}`} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-center font-black text-gray-400 text-xs" style={{ fontFamily: "var(--font-inter)" }}>{i + 1}</span>
                <span className="font-bold text-gray-800">{p.a}</span>
                <span className="text-gray-400">+</span>
                <span className="font-bold text-gray-800">{p.b}</span>
                <span className="ms-auto font-black tabular-nums text-green-700" style={{ fontFamily: "var(--font-inter)" }}>
                  {Math.round(p.pct)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
                      style={cellColor(v, minV, maxV)}
                      className="w-11 h-9 min-w-11 text-center rounded-md text-[10px] font-black text-gray-800 tabular-nums whitespace-nowrap"
                    >
                      {v === null ? <span className="text-gray-300">—</span> : `${Math.round(v)}%`}
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
