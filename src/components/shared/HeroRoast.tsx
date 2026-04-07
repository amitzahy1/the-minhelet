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
      {/* Optional matchday header */}
      {matchday && (
        <div className="bg-gray-900 text-center py-2">
          <span className="text-xs font-bold text-gray-300 tracking-wider uppercase">
            {matchday}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2">
        {/* Hero side */}
        <motion.div
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="bg-gradient-to-bl from-green-400 via-green-500 to-emerald-600 p-5 flex flex-col items-center justify-center text-center relative"
        >
          <span className="text-4xl mb-1">👑</span>
          <p className="text-xs font-bold text-green-100 uppercase tracking-wider mb-1">
            גיבור היום
          </p>
          <p
            className="text-xl font-black text-white"
            style={{ fontFamily: "var(--font-secular)" }}
          >
            {hero.name}
          </p>
          <p
            className="text-3xl font-black text-white mt-1"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            +{hero.points}
          </p>
          <p className="text-xs text-green-100 font-semibold">נקודות</p>
          {hero.highlight && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-2 text-xs font-bold bg-white/20 rounded-full px-3 py-1 text-white"
            >
              {hero.highlight}
            </motion.p>
          )}
        </motion.div>

        {/* Roast side */}
        <motion.div
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="bg-gradient-to-br from-red-500 via-red-600 to-rose-700 p-5 flex flex-col items-center justify-center text-center relative"
        >
          <span className="text-4xl mb-1">💀</span>
          <p className="text-xs font-bold text-red-200 uppercase tracking-wider mb-1">
            שחקן הלילה
          </p>
          <p
            className="text-xl font-black text-white"
            style={{ fontFamily: "var(--font-secular)" }}
          >
            {roast.name}
          </p>
          <p
            className="text-3xl font-black text-white mt-1"
            style={{ fontFamily: "var(--font-inter)" }}
          >
            +{roast.points}
          </p>
          <p className="text-xs text-red-200 font-semibold">נקודות</p>
          {roast.highlight && (
            <motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-2 text-xs font-bold bg-white/20 rounded-full px-3 py-1 text-white"
            >
              {roast.highlight}
            </motion.p>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
