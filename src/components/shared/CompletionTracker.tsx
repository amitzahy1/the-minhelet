"use client";

import { motion, AnimatePresence } from "framer-motion";

export interface PlayerCompletion {
  name: string;
  completion: {
    groups: number;   // 0-100
    knockout: number; // 0-100
    specials: number; // 0-100
  };
}

interface CompletionTrackerProps {
  players: PlayerCompletion[];
}

const GROUP_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

function getMissingParts(completion: PlayerCompletion["completion"]): string[] {
  const missing: string[] = [];

  if (completion.groups < 100) {
    // Figure out which groups are likely missing based on percentage
    const filledGroups = Math.round((completion.groups / 100) * 12);
    const missingGroups = GROUP_LETTERS.slice(filledGroups);
    if (missingGroups.length > 0) {
      missing.push(`בתים ${missingGroups.join(", ")}`);
    }
  }

  if (completion.knockout < 100) {
    missing.push("נוק-אאוט");
  }

  if (completion.specials < 100) {
    missing.push("הימורים מיוחדים");
  }

  return missing;
}

export function CompletionTracker({ players }: CompletionTrackerProps) {
  const incompletePlayers = players.filter(
    (p) => p.completion.groups < 100 || p.completion.knockout < 100 || p.completion.specials < 100
  );

  if (incompletePlayers.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="bg-amber-50 border border-amber-200 rounded-2xl shadow-md overflow-hidden mb-6"
        dir="rtl"
      >
        <div className="px-5 py-3 bg-gradient-to-l from-amber-50 via-amber-100/40 to-orange-50/60 border-b border-amber-200/60 flex items-center gap-2">
          <span className="text-lg">⚠️</span>
          <h3 className="text-base font-bold text-amber-900">עדיין לא השלימו</h3>
          <span className="text-xs text-amber-600 font-medium ms-auto">
            {incompletePlayers.length} מתוך {players.length}
          </span>
        </div>
        <div className="px-5 py-3 space-y-2">
          {incompletePlayers.map((player, i) => {
            const missing = getMissingParts(player.completion);
            return (
              <motion.div
                key={player.name}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.08 }}
                className="flex items-start gap-2 text-sm"
              >
                <span className="font-bold text-amber-900 shrink-0">{player.name}</span>
                <span className="text-amber-700">—</span>
                <span className="text-amber-700">
                  חסר: {missing.join(" | ")}
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
