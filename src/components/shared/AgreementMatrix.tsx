"use client";

// Pairwise pick-agreement heatmap ("מי חושב כמו מי") — compare page tab.
// Two modes:
//   • "total"  — agreement across EVERY bet (group order + scores + knockout
//                winners + champion + special bets). Superset of the metric the
//                מתנשקים/המנותק titles use, so it can read a touch higher/lower
//                than those titles — by design, the user wanted the matrix to
//                reflect ALL bets, the titles stay on the never-redacted subset.
//   • "scores" — agreement on group-stage SCORE guesses only (exact scoreline).
// Green = thinking alike, red = opposites; symmetric, diagonal is —.

import { scoreAgreementPct, totalAgreementPct } from "@/lib/league-titles";
import type { BettorBracket, BettorSpecialBets } from "@/lib/supabase/shared-data";

type Mode = "total" | "scores";

const MODE_META: Record<
  Mode,
  { title: string; subtitle: React.ReactNode; headline: string }
> = {
  total: {
    title: "מטריצת הסכמה — סה״כ",
    subtitle: (
      <>
        כמה אחוז מכל ההימורים של כל זוג זהים (סדר בתים, ניחושי תוצאות, עץ נוקאאוט,
        אלופה, הימורים מיוחדים) ·
        <span className="text-green-700 font-bold"> ירוק = חושבים אותו דבר</span> ·
        <span className="text-red-600 font-bold"> אדום = הפוכים</span>
      </>
    ),
    headline: "🏅 הזוגות הכי קרובים:",
  },
  scores: {
    title: "מטריצת הסכמה — ניחושי תוצאות",
    subtitle: (
      <>
        כמה אחוז מניחושי התוצאות (תוצאה מדויקת) של כל זוג זהים — לפי המשחקים
        שנחשפו ·
        <span className="text-green-700 font-bold"> ירוק = מנחשים דומה</span> ·
        <span className="text-red-600 font-bold"> אדום = שונים</span>
      </>
    ),
    headline: "🎯 הניחושים הכי דומים:",
  },
};

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
  specialBets,
  currentUserId,
  mode = "total",
}: {
  brackets: BettorBracket[];
  specialBets?: BettorSpecialBets[];
  currentUserId?: string | null;
  mode?: Mode;
}) {
  const bettors = brackets.filter((b) => b.userId);
  if (bettors.length < 2) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-8 text-center">
        <p className="text-sm text-gray-500">אין מספיק מהמרים למטריצה</p>
      </div>
    );
  }

  const meta = MODE_META[mode];
  const sbByUser = new Map((specialBets || []).map((s) => [s.userId, s]));
  const pct = (a: BettorBracket, b: BettorBracket): number | null =>
    mode === "scores"
      ? scoreAgreementPct(a, b)
      : totalAgreementPct(a, b, sbByUser.get(a.userId), sbByUser.get(b.userId));

  const matrix = bettors.map((a) =>
    bettors.map((b) => (a.userId === b.userId ? null : pct(a, b))),
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
        <h3 className="text-lg font-bold text-gray-900">{meta.title}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{meta.subtitle}</p>
      </div>
      {/* Top-5 closest pairs — one compact chip row (wraps on mobile) */}
      {closestPairs.length > 0 && (
        <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2 flex-wrap">
          <p className="text-xs font-bold text-gray-600 shrink-0">{meta.headline}</p>
          {closestPairs.map((p, i) => (
            <span
              key={`${p.a}-${p.b}`}
              className="inline-flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-2.5 py-1 text-xs whitespace-nowrap"
            >
              <span className="font-black text-gray-400" style={{ fontFamily: "var(--font-inter)" }}>{i + 1}</span>
              <span className="font-bold text-gray-800">{p.a} + {p.b}</span>
              <span className="font-black text-green-700 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
                {Math.round(p.pct)}%
              </span>
            </span>
          ))}
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
