"use client";

import { motion } from "framer-motion";

// ============================================================================
// Hero & Roast of the Day — highlights the best and worst performers
// Shows at the top of the standings page to drive engagement
// ============================================================================

interface Performer {
  name: string;
  points: number;
  highlight?: string;
}

interface HeroRoastProps {
  hero: Performer;
  roast: Performer;
  matchday?: string; // e.g. "יום משחק 3"
}

// --- Mock data for demonstration ---
export const MOCK_HERO_ROAST: HeroRoastProps = {
  hero: { name: "דני", points: 12, highlight: "3 תוצאות מדויקות!" },
  roast: { name: "אורי", points: 0, highlight: "0/4 — אין מה לעשות" },
  matchday: "יום משחק 3",
};

export function HeroRoast({ hero, roast, matchday }: HeroRoastProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="rounded-2xl overflow-hidden border border-gray-200 shadow-md mb-6"
      dir="rtl"
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Hero */}
        <div className="flex-1 flex items-center gap-2 bg-green-50 rounded-lg px-3 py-2 border border-green-200">
          <span className="text-lg">👑</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-green-600 font-bold">גיבור היום</p>
            <p className="text-sm font-black text-gray-900 truncate">{hero.name}</p>
          </div>
          <span className="text-sm font-black text-green-600" style={{ fontFamily: "var(--font-inter)" }}>+{hero.points}</span>
        </div>
        {/* Matchday */}
        {matchday && <span className="text-[10px] text-gray-400 font-bold shrink-0">{matchday}</span>}
        {/* Roast */}
        <div className="flex-1 flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2 border border-red-200">
          <span className="text-lg">💀</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-red-500 font-bold">שחקן הלילה</p>
            <p className="text-sm font-black text-gray-900 truncate">{roast.name}</p>
          </div>
          <span className="text-sm font-black text-red-500" style={{ fontFamily: "var(--font-inter)" }}>+{roast.points}</span>
        </div>
      </div>
    </motion.div>
  );
}
