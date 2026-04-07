"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { FLAGS, getFlag, getTeamNameHe } from "@/lib/flags";

interface WhosAliveProps {
  bettors: {
    name: string;
    champion: string;
    semifinalists: string[];
    quarterfinalists: string[];
    alive: string[];
    dead: string[];
  }[];
}

// Mock data
const MOCK_BETTORS: WhosAliveProps["bettors"] = [
  {
    name: "אמית",
    champion: "ARG",
    semifinalists: ["ARG", "GER", "FRA", "BRA"],
    quarterfinalists: ["ARG", "GER", "FRA", "BRA", "ESP", "ENG", "NED", "POR"],
    alive: ["ARG", "FRA", "BRA", "ESP", "ENG", "NED", "POR"],
    dead: ["GER"],
  },
  {
    name: "דני",
    champion: "NZL",
    semifinalists: ["ARG", "FRA", "BRA", "GER"],
    quarterfinalists: ["ARG", "FRA", "BRA", "GER", "ESP", "POR", "ENG", "NED"],
    alive: ["ARG", "FRA", "BRA", "ESP", "ENG", "NED"],
    dead: ["NZL", "GER", "POR"],
  },
  {
    name: "יוני",
    champion: "FRA",
    semifinalists: ["FRA", "BRA", "ENG", "ARG"],
    quarterfinalists: ["FRA", "BRA", "ENG", "ARG", "GER", "ESP", "NED", "POR"],
    alive: ["FRA", "BRA", "ENG", "ARG", "ESP", "NED", "POR"],
    dead: ["GER"],
  },
  {
    name: "רון ב",
    champion: "ENG",
    semifinalists: ["ENG", "FRA", "BRA", "POR"],
    quarterfinalists: ["ENG", "FRA", "BRA", "POR", "ARG", "GER", "ESP", "NED"],
    alive: ["ENG", "FRA", "BRA", "ARG", "ESP", "NED"],
    dead: ["POR", "GER"],
  },
  {
    name: "רועי",
    champion: "GER",
    semifinalists: ["GER", "FRA", "ARG", "BRA"],
    quarterfinalists: ["GER", "FRA", "ARG", "BRA", "ESP", "ENG", "NED", "POR"],
    alive: ["FRA", "ARG", "BRA", "ESP", "ENG", "NED", "POR"],
    dead: ["GER"],
  },
  {
    name: "עידן",
    champion: "FRA",
    semifinalists: ["FRA", "ARG", "BRA", "ENG"],
    quarterfinalists: ["FRA", "ARG", "BRA", "ENG", "GER", "ESP", "NED", "POR"],
    alive: ["FRA", "ARG", "BRA", "ENG", "ESP", "NED", "POR"],
    dead: ["GER"],
  },
];

function TeamTag({
  code,
  isAlive,
  isChampion,
}: {
  code: string;
  isAlive: boolean;
  isChampion: boolean;
}) {
  if (isChampion) {
    return isAlive ? (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-green-100 border border-green-300 shadow-sm shadow-green-200">
        <span className="text-sm">{getFlag(code)}</span>
        <span className="text-xs font-black text-green-800">
          {getTeamNameHe(code)}
        </span>
        <span className="text-green-600 text-xs">✓</span>
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-100 border border-red-300">
        <span className="text-sm opacity-50">{getFlag(code)}</span>
        <span className="text-xs font-black text-red-400 line-through">
          {getTeamNameHe(code)}
        </span>
        <span className="text-sm">💀</span>
      </span>
    );
  }

  return isAlive ? (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-green-50 border border-green-200 text-xs">
      <span>{getFlag(code)}</span>
      <span className="font-bold text-green-700">{code}</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gray-100 border border-gray-200 text-xs opacity-40">
      <span>{getFlag(code)}</span>
      <span className="font-bold text-gray-400 line-through">{code}</span>
    </span>
  );
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, x: 30 },
  show: { opacity: 1, x: 0 },
};

export default function WhosAlive({
  bettors = MOCK_BETTORS,
}: Partial<WhosAliveProps>) {
  // Sort by most alive predictions first
  const sorted = useMemo(() => {
    return [...bettors].sort((a, b) => {
      const aTotal = a.alive.length + a.dead.length;
      const bTotal = b.alive.length + b.dead.length;
      const aRatio = a.alive.length / (aTotal || 1);
      const bRatio = b.alive.length / (bTotal || 1);
      return bRatio - aRatio;
    });
  }, [bettors]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h2
          className="text-3xl font-black text-gray-900"
          style={{ fontFamily: "var(--font-secular)" }}
        >
          מי עוד בחיים?
        </h2>
        <p className="text-base text-gray-600 mt-1">
          מצב הניחושים של כל מהמר — מי שרד ומי נפל
        </p>
      </motion.div>

      {/* Bettors list */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="space-y-3"
      >
        {sorted.map((bettor) => {
          const allPicks = [
            ...new Set([
              bettor.champion,
              ...bettor.semifinalists,
              ...bettor.quarterfinalists,
            ]),
          ];
          const aliveCount = allPicks.filter((t) =>
            bettor.alive.includes(t)
          ).length;
          const totalPicks = allPicks.length;
          const pct = Math.round((aliveCount / totalPicks) * 100);
          const championAlive = bettor.alive.includes(bettor.champion);

          return (
            <motion.div
              key={bettor.name}
              variants={item}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Header row */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                {/* Name */}
                <span className="text-base font-black text-gray-900 min-w-[60px]">
                  {bettor.name}
                </span>

                {/* Champion pick */}
                <TeamTag
                  code={bettor.champion}
                  isAlive={championAlive}
                  isChampion
                />

                {/* Spacer */}
                <div className="flex-1" />

                {/* Damage meter */}
                <div className="flex items-center gap-2 min-w-[140px]">
                  <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${
                        pct >= 75
                          ? "bg-green-500"
                          : pct >= 50
                          ? "bg-amber-500"
                          : "bg-red-500"
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                    />
                  </div>
                  <span
                    className="text-xs font-bold text-gray-600 whitespace-nowrap"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    {aliveCount}/{totalPicks}
                  </span>
                  <span className="text-[11px] text-gray-400">בחיים</span>
                </div>
              </div>

              {/* Picks detail row */}
              <div className="px-4 py-2.5 flex flex-wrap gap-1.5">
                {allPicks
                  .filter((t) => t !== bettor.champion)
                  .map((team) => (
                    <TeamTag
                      key={team}
                      code={team}
                      isAlive={bettor.alive.includes(team)}
                      isChampion={false}
                    />
                  ))}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
