"use client";

import {
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
} from "recharts";

interface PlayerStats {
  name: string;
  toto: number;     // 0-100
  exact: number;    // 0-100
  groups: number;   // 0-100
  knockout: number; // 0-100
  specials: number; // 0-100
}

export interface RadarChartProps {
  player: PlayerStats;
  leader?: PlayerStats;
}

const AXES: { key: keyof Omit<PlayerStats, "name">; label: string }[] = [
  { key: "toto", label: "טוטו" },
  { key: "exact", label: "מדויק" },
  { key: "groups", label: "בתים" },
  { key: "knockout", label: "נוק-אאוט" },
  { key: "specials", label: "מיוחדים" },
];

// Mock data for demonstration
const MOCK_PLAYER: PlayerStats = {
  name: "אמית",
  toto: 72,
  exact: 58,
  groups: 85,
  knockout: 44,
  specials: 66,
};

const MOCK_LEADER: PlayerStats = {
  name: "דני",
  toto: 88,
  exact: 75,
  groups: 80,
  knockout: 70,
  specials: 60,
};

export function RadarChart({ player = MOCK_PLAYER, leader }: Partial<RadarChartProps> & { player?: PlayerStats }) {
  const displayPlayer = player ?? MOCK_PLAYER;
  const displayLeader = leader ?? MOCK_LEADER;

  const data = AXES.map(({ key, label }) => ({
    axis: label,
    player: displayPlayer[key],
    leader: displayLeader[key],
  }));

  return (
    <div className="w-full max-w-[250px] mx-auto" dir="ltr">
      <ResponsiveContainer width="100%" height={220}>
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#e5e7eb" />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fontSize: 11, fill: "#374151", fontWeight: 600 }}
          />
          {/* Leader overlay — dashed, light gray */}
          <Radar
            name={displayLeader.name}
            dataKey="leader"
            stroke="#c0c0c0"
            fill="#d1d5db"
            fillOpacity={0.15}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          {/* Player — solid blue */}
          <Radar
            name={displayPlayer.name}
            dataKey="player"
            stroke="#3B82F6"
            fill="#3B82F6"
            fillOpacity={0.25}
            strokeWidth={2}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
      {/* Legend */}
      <div className="flex justify-center gap-4 mt-1 text-xs" dir="rtl">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-blue-500 rounded" />
          <span className="text-gray-700 font-bold">{displayPlayer.name}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-0.5 bg-gray-400 rounded" style={{ borderTop: "1.5px dashed #9ca3af", background: "none" }} />
          <span className="text-gray-500">{displayLeader.name}</span>
        </span>
      </div>
    </div>
  );
}
