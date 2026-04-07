"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

interface LiveLeaderboardProps {
  players: {
    id: string;
    name: string;
    points: number;
    rank: number;
    change: number; // +1 went up, -1 went down, 0 no change
  }[];
}

const MOCK_PLAYERS: LiveLeaderboardProps["players"] = [
  { id: "1", name: "דני", points: 168, rank: 1, change: 1 },
  { id: "2", name: "יוני", points: 161, rank: 2, change: 0 },
  { id: "3", name: "דור דסא", points: 157, rank: 3, change: -1 },
  { id: "4", name: "אמית", points: 154, rank: 4, change: 1 },
  { id: "5", name: "רון ב", points: 144, rank: 5, change: -1 },
  { id: "6", name: "רון ג", points: 137, rank: 6, change: 0 },
  { id: "7", name: "רועי", points: 134, rank: 7, change: 1 },
  { id: "8", name: "עידן", points: 129, rank: 8, change: -1 },
  { id: "9", name: "אוהד", points: 125, rank: 9, change: 0 },
  { id: "10", name: "אורי", points: 113, rank: 10, change: 0 },
];

function AnimatedPoints({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(value);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = prevValue.current;
    const to = value;
    prevValue.current = value;

    if (from === to) {
      node.textContent = String(to);
      return;
    }

    const duration = 600;
    const start = performance.now();

    function step(now: number) {
      const elapsed = Math.min(now - start, duration);
      const progress = elapsed / duration;
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(from + (to - from) * eased);
      if (node) node.textContent = String(current);
      if (elapsed < duration) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
  }, [value]);

  return (
    <span
      ref={ref}
      className="font-black text-lg tabular-nums text-gray-900"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      {value}
    </span>
  );
}

function ChangeIndicator({ change }: { change: number }) {
  if (change > 0) {
    return (
      <motion.span
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm font-bold text-green-500 flex items-center gap-0.5"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 4l-8 8h5v8h6v-8h5z" />
        </svg>
        {change}
      </motion.span>
    );
  }
  if (change < 0) {
    return (
      <motion.span
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-sm font-bold text-red-400 flex items-center gap-0.5"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 20l8-8h-5V4H9v8H4z" />
        </svg>
        {Math.abs(change)}
      </motion.span>
    );
  }
  return <span className="text-sm text-gray-400 font-bold">—</span>;
}

function PlayerRow({ player, index }: { player: LiveLeaderboardProps["players"][0]; index: number }) {
  const flashColor =
    player.change > 0
      ? "rgba(34, 197, 94, 0.12)"
      : player.change < 0
      ? "rgba(239, 68, 68, 0.10)"
      : "transparent";

  return (
    <motion.div
      layout
      layoutId={player.id}
      transition={{ type: "spring", stiffness: 350, damping: 32 }}
      initial={false}
      animate={{
        backgroundColor: [flashColor, "rgba(255,255,255,0)"],
      }}
      className={`flex items-center px-4 py-3 border-b border-gray-100 last:border-0`}
    >
      {/* Rank */}
      <span className="w-8 text-center font-bold text-base text-gray-400">
        {index === 0 ? "\u{1F947}" : index === 1 ? "\u{1F948}" : index === 2 ? "\u{1F949}" : index + 1}
      </span>

      {/* Avatar */}
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold me-3 ${
          index === 0
            ? "bg-amber-100 text-amber-700 ring-2 ring-amber-300"
            : index === 1
            ? "bg-gray-200 text-gray-600"
            : index === 2
            ? "bg-orange-100 text-orange-700"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {player.name[0]}
      </div>

      {/* Name */}
      <span className="flex-1 font-bold text-base text-gray-900 truncate">{player.name}</span>

      {/* Change indicator */}
      <div className="w-10 flex justify-center">
        <ChangeIndicator change={player.change} />
      </div>

      {/* Points */}
      <div className="w-16 text-center">
        <AnimatedPoints value={player.points} />
      </div>
    </motion.div>
  );
}

export function LiveLeaderboardAnimation({
  players = MOCK_PLAYERS,
}: Partial<LiveLeaderboardProps>) {
  const sorted = [...players].sort((a, b) => a.rank - b.rank);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-md overflow-hidden" dir="rtl">
      <div className="px-5 py-3 bg-gradient-to-l from-white via-blue-50/30 to-indigo-50/40 border-b border-blue-100/50">
        <h3 className="text-lg font-bold text-gray-800">טבלה חיה</h3>
        <p className="text-sm text-gray-500">הדירוג מתעדכן בזמן אמת</p>
      </div>

      {/* Header row */}
      <div
        className="flex items-center px-4 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200 font-semibold"
        style={{ fontFamily: "var(--font-inter)" }}
      >
        <span className="w-8 text-center">#</span>
        <span className="w-9 me-3" />
        <span className="flex-1 text-start">שחקן</span>
        <span className="w-10 text-center">שינוי</span>
        <span className="w-16 text-center">נקודות</span>
      </div>

      {/* Rows */}
      <div>
        {sorted.map((player, index) => (
          <PlayerRow key={player.id} player={player} index={index} />
        ))}
      </div>
    </div>
  );
}

export default LiveLeaderboardAnimation;
