"use client";

export interface HeatmapProps {
  data: {
    name: string;
    groups: Record<string, number>; // "A" -> 0-100 accuracy
  }[];
}

const GROUPS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

// Mock data for demonstration — 5 bettors, 12 groups
const MOCK_DATA: HeatmapProps["data"] = [
  { name: "דני", groups: { A: 100, B: 75, C: 50, D: 100, E: 25, F: 75, G: 50, H: 100, I: 75, J: 50, K: 25, L: 100 } },
  { name: "יוני", groups: { A: 75, B: 50, C: 100, D: 25, E: 75, F: 50, G: 100, H: 75, I: 50, J: 25, K: 100, L: 75 } },
  { name: "אמית", groups: { A: 50, B: 100, C: 75, D: 50, E: 100, F: 25, G: 75, H: 50, I: 100, J: 75, K: 50, L: 25 } },
  { name: "רון ב", groups: { A: 25, B: 50, C: 25, D: 75, E: 50, F: 100, G: 25, H: 75, I: 25, J: 100, K: 75, L: 50 } },
  { name: "דור דסא", groups: { A: 75, B: 25, C: 100, D: 50, E: 75, F: 50, G: 100, H: 25, I: 50, J: 75, K: 100, L: 50 } },
];

/**
 * Returns a background color for a 0-100 accuracy value.
 * 0% = light red, 50% = yellow, 100% = dark green.
 */
function getHeatColor(value: number): string {
  if (value <= 0) return "#fecaca";   // red-200
  if (value <= 15) return "#fdba74";  // orange-300
  if (value <= 30) return "#fcd34d";  // amber-300
  if (value <= 50) return "#fde047";  // yellow-300
  if (value <= 65) return "#bef264";  // lime-300
  if (value <= 80) return "#86efac";  // green-300
  if (value <= 90) return "#4ade80";  // green-400
  return "#16a34a";                   // green-600
}

function getTextColor(value: number): string {
  if (value > 80) return "#fff";
  return "#1f2937"; // gray-800
}

export function PredictionHeatmap({ data }: { data?: HeatmapProps["data"] }) {
  const rows = data ?? MOCK_DATA;

  return (
    <div className="w-full overflow-x-auto" dir="rtl">
      <div
        className="inline-grid min-w-max"
        style={{
          gridTemplateColumns: `auto repeat(${GROUPS.length}, 52px)`,
          gap: "2px",
        }}
      >
        {/* Header row */}
        <div className="sticky start-0 z-10 bg-white" />
        {GROUPS.map((g) => (
          <div
            key={g}
            className="text-center text-xs font-bold text-gray-600 py-2"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            בית {g}
          </div>
        ))}

        {/* Data rows */}
        {rows.map((bettor) => (
          <>
            {/* Bettor name — sticky */}
            <div
              key={`name-${bettor.name}`}
              className="sticky start-0 z-10 bg-white flex items-center pe-3 text-sm font-bold text-gray-900 whitespace-nowrap"
            >
              {bettor.name}
            </div>
            {/* Group cells */}
            {GROUPS.map((g) => {
              const val = bettor.groups[g] ?? 0;
              return (
                <div
                  key={`${bettor.name}-${g}`}
                  className="flex items-center justify-center rounded-md text-xs font-bold h-10 transition-colors"
                  style={{
                    backgroundColor: getHeatColor(val),
                    color: getTextColor(val),
                    fontFamily: "var(--font-inter)",
                  }}
                >
                  {val}%
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}
