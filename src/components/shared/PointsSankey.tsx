"use client";

import { motion } from "framer-motion";

interface PointsSankeyProps {
  player: {
    name: string;
    toto: number;
    exact: number;
    groups: number;
    knockout: number;
    specials: number;
    total: number;
  };
}

const MOCK_PLAYER: PointsSankeyProps["player"] = {
  name: "אמית",
  toto: 62,
  exact: 28,
  groups: 31,
  knockout: 20,
  specials: 13,
  total: 154,
};

const SOURCES = [
  { key: "toto" as const, label: "טוטו", color: "#3B82F6" },
  { key: "exact" as const, label: "מדויק", color: "#10B981" },
  { key: "groups" as const, label: "בתים", color: "#F59E0B" },
  { key: "knockout" as const, label: "נוק-אאוט", color: "#8B5CF6" },
  { key: "specials" as const, label: "מיוחדים", color: "#EC4899" },
];

function buildCurvePath(
  x1: number, y1: number, x2: number, y2: number
): string {
  const cx1 = x1 + (x2 - x1) * 0.4;
  const cx2 = x1 + (x2 - x1) * 0.6;
  return `M ${x1},${y1} C ${cx1},${y1} ${cx2},${y2} ${x2},${y2}`;
}

export function PointsSankey({ player = MOCK_PLAYER }: Partial<PointsSankeyProps>) {
  const total = player.total || 1;
  const svgWidth = 400;
  const svgHeight = 280;
  const leftX = 100;
  const rightX = 300;
  const nodeHeight = 32;
  const sourceGap = 12;
  const totalSourcesHeight = SOURCES.length * nodeHeight + (SOURCES.length - 1) * sourceGap;
  const sourceStartY = (svgHeight - totalSourcesHeight) / 2;

  // Calculate right node dimensions
  const rightNodeHeight = Math.max(60, totalSourcesHeight * 0.7);
  const rightNodeY = (svgHeight - rightNodeHeight) / 2;

  // Track cumulative position on the right node
  let rightCumulative = 0;

  const paths = SOURCES.map((source, i) => {
    const value = player[source.key];
    const sourceY = sourceStartY + i * (nodeHeight + sourceGap) + nodeHeight / 2;

    // Width on right node proportional to value
    const portionHeight = (value / total) * rightNodeHeight;
    const targetY = rightNodeY + rightCumulative + portionHeight / 2;
    rightCumulative += portionHeight;

    // Path thickness proportional to value
    const thickness = Math.max(2, (value / total) * 40);

    return {
      ...source,
      value,
      sourceY,
      targetY,
      thickness,
      path: buildCurvePath(leftX + 4, sourceY, rightX - 4, targetY),
    };
  });

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-5 max-w-[400px]" dir="rtl">
      <h3 className="text-lg font-bold text-gray-900 mb-1">פילוח נקודות</h3>
      <p className="text-sm text-gray-500 mb-3">{player.name} - {player.total} נקודות</p>

      <svg
        width="100%"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="overflow-visible"
        style={{ direction: "ltr" }}
      >
        {/* Flow paths */}
        {paths.map((p, i) => (
          <motion.path
            key={p.key}
            d={p.path}
            fill="none"
            stroke={p.color}
            strokeWidth={p.thickness}
            strokeOpacity={0.35}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: i * 0.12, ease: "easeInOut" }}
          />
        ))}

        {/* Source nodes (left side) */}
        {paths.map((p) => (
          <g key={`src-${p.key}`}>
            <rect
              x={leftX - 60}
              y={p.sourceY - nodeHeight / 2 + 2}
              width={60}
              height={nodeHeight - 4}
              rx={6}
              fill={p.color}
              fillOpacity={0.12}
              stroke={p.color}
              strokeWidth={1.5}
              strokeOpacity={0.3}
            />
            <text
              x={leftX - 30}
              y={p.sourceY + 1}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-xs font-bold"
              fill={p.color}
            >
              {p.label}
            </text>
            <text
              x={leftX - 30}
              y={p.sourceY + 13}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-[10px] font-bold"
              fill="#6B7280"
              style={{ fontFamily: "var(--font-inter)" }}
            >
              {p.value}
            </text>
          </g>
        ))}

        {/* Target node (right side) */}
        <rect
          x={rightX}
          y={rightNodeY}
          width={60}
          height={rightNodeHeight}
          rx={8}
          fill="#1F2937"
          fillOpacity={0.08}
          stroke="#1F2937"
          strokeWidth={1.5}
          strokeOpacity={0.2}
        />
        <text
          x={rightX + 30}
          y={(svgHeight / 2) - 8}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-sm font-bold"
          fill="#1F2937"
        >
          {"סה\"כ"}
        </text>
        <text
          x={rightX + 30}
          y={(svgHeight / 2) + 10}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-lg font-black"
          fill="#1F2937"
          style={{ fontFamily: "var(--font-inter)" }}
        >
          {player.total}
        </text>
      </svg>
    </div>
  );
}

export default PointsSankey;
