"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FLAGS, getFlag, TEAM_NAMES_HE, getTeamNameHe } from "@/lib/flags";

interface PredictionRevealsProps {
  predictions: {
    name: string;
    champion: string;
    championName: string;
  }[];
  isLocked: boolean;
}

// Mock data
const MOCK_PREDICTIONS: PredictionRevealsProps["predictions"] = [
  { name: "דני", champion: "NZL", championName: "ניו זילנד" },
  { name: "יוני", champion: "FRA", championName: "צרפת" },
  { name: "דור דסא", champion: "BRA", championName: "ברזיל" },
  { name: "אמית", champion: "ARG", championName: "ארגנטינה" },
  { name: "רון ב", champion: "ARG", championName: "ארגנטינה" },
  { name: "רון ג", champion: "FRA", championName: "צרפת" },
  { name: "רועי", champion: "ARG", championName: "ארגנטינה" },
  { name: "עידן", champion: "ARG", championName: "ארגנטינה" },
];

function computeStats(predictions: PredictionRevealsProps["predictions"]) {
  const counts: Record<string, { count: number; names: string[] }> = {};
  for (const p of predictions) {
    if (!counts[p.champion]) counts[p.champion] = { count: 0, names: [] };
    counts[p.champion].count++;
    counts[p.champion].names.push(p.name);
  }

  const sorted = Object.entries(counts).sort((a, b) => b[1].count - a[1].count);
  const consensus = sorted[0];
  const loneWolf = sorted[sorted.length - 1];

  // Find the actual lone wolf person (someone with the rarest pick)
  const loneWolfPerson = loneWolf[1].names[0];
  const loneWolfTeam = loneWolf[0];

  return {
    consensusTeam: consensus[0],
    consensusCount: consensus[1].count,
    total: predictions.length,
    loneWolfName: loneWolfPerson,
    loneWolfTeam,
    loneWolfTeamName: getTeamNameHe(loneWolfTeam),
  };
}

function FlipCard({
  prediction,
  index,
}: {
  prediction: PredictionRevealsProps["predictions"][0];
  index: number;
}) {
  const [isFlipped, setIsFlipped] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.5, duration: 0.4 }}
      className="perspective-[800px] w-full"
    >
      <motion.div
        className="relative w-full cursor-pointer"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
        onClick={() => setIsFlipped(true)}
        onAnimationComplete={() => {
          // Auto-flip after appearing
          if (!isFlipped) {
            setTimeout(() => setIsFlipped(true), 800);
          }
        }}
      >
        {/* Front - bettor name */}
        <div
          className="rounded-2xl border-2 border-gray-200 bg-gradient-to-br from-gray-50 to-gray-100 p-5 text-center shadow-md"
          style={{ backfaceVisibility: "hidden" }}
        >
          <p className="text-lg font-black text-gray-800">{prediction.name}</p>
          <p className="text-sm text-gray-500 mt-1">לחצו לחשיפה</p>
          <div className="mt-3 text-3xl animate-pulse">?</div>
        </div>

        {/* Back - champion pick */}
        <div
          className="absolute inset-0 rounded-2xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100 p-5 text-center shadow-lg"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <p className="text-sm font-bold text-amber-700">{prediction.name}</p>
          <div className="mt-2 text-4xl">{getFlag(prediction.champion)}</div>
          <p className="text-xl font-black text-amber-900 mt-2">
            {prediction.championName}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function PredictionReveals({
  predictions = MOCK_PREDICTIONS,
  isLocked = true,
}: Partial<PredictionRevealsProps>) {
  if (!isLocked) {
    return (
      <div className="max-w-lg mx-auto text-center py-16 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl border border-gray-200 shadow-md p-8"
        >
          <div className="text-5xl mb-4">🔒</div>
          <h2
            className="text-2xl font-black text-gray-900 mb-2"
            style={{ fontFamily: "var(--font-secular)" }}
          >
            הניחושים ייחשפו אחרי הנעילה
          </h2>
          <p className="text-gray-500">
            המתינו עד ה-10 ביוני כדי לראות את הבחירות של כולם
          </p>
        </motion.div>
      </div>
    );
  }

  const stats = computeStats(predictions);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="text-4xl mb-2">🏆</div>
        <h2
          className="text-3xl font-black text-gray-900"
          style={{ fontFamily: "var(--font-secular)" }}
        >
          חשיפת האלופות
        </h2>
        <p className="text-gray-500 mt-1">לחצו על כרטיס כדי לחשוף את הניחוש</p>
      </motion.div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-10">
        {predictions.map((p, i) => (
          <FlipCard key={p.name} prediction={p} index={i} />
        ))}
      </div>

      {/* Summary section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: predictions.length * 0.5 + 1 }}
        className="space-y-4"
      >
        {/* Consensus */}
        <div className="bg-gradient-to-l from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5 text-center shadow-sm">
          <p className="text-sm font-bold text-green-700 mb-1">הקונצנזוס</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-3xl">{getFlag(stats.consensusTeam)}</span>
            <span className="text-2xl font-black text-green-900">
              {getTeamNameHe(stats.consensusTeam)}
            </span>
          </div>
          <p className="text-sm text-green-600 mt-1">
            {stats.consensusCount} מתוך {stats.total}
          </p>
        </div>

        {/* Lone Wolf */}
        <div className="bg-gradient-to-l from-purple-50 to-indigo-50 border border-purple-200 rounded-2xl p-5 text-center shadow-sm">
          <p className="text-sm font-bold text-purple-700 mb-1">🐺 זאב בודד</p>
          <p className="text-lg font-black text-purple-900">
            {stats.loneWolfName}
          </p>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span className="text-2xl">{getFlag(stats.loneWolfTeam)}</span>
            <span className="text-lg font-bold text-purple-800">
              {stats.loneWolfTeamName}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
