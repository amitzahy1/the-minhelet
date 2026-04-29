"use client";

import { useEffect, useState } from "react";

// ============================================================================
// StillAliveBadge — shows if a bettor's team/player pick is still possible
// Fetches tournament_actuals once and caches in module scope.
// ============================================================================

interface TournamentActuals {
  champion?: string | null;
  top_scorer_player?: string | null;
  top_scorer_team?: string | null;
}

let cached: TournamentActuals | null = null;
let fetchPromise: Promise<TournamentActuals | null> | null = null;

async function getActuals(): Promise<TournamentActuals | null> {
  if (cached) return cached;
  if (!fetchPromise) {
    fetchPromise = fetch("/api/tournament-stats")
      .then((r) => r.json())
      .then((d) => { cached = d?.actuals ?? null; return cached; })
      .catch(() => null);
  }
  return fetchPromise;
}

interface Props {
  teamCode?: string;
  playerName?: string;
  pickType: "champion" | "topScorer" | "finalist" | "semifinalist";
}

export function StillAliveBadge({ teamCode, playerName, pickType }: Props) {
  const [actuals, setActuals] = useState<TournamentActuals | null>(null);

  useEffect(() => {
    getActuals().then(setActuals);
  }, []);

  if (!actuals) return null;

  let isDecided = false;
  let isAlive = true;
  let label = "";

  if (pickType === "champion" && actuals.champion) {
    isDecided = true;
    isAlive = actuals.champion === teamCode;
    label = isAlive ? `✓ ${actuals.champion} אלוף!` : `✗ ${actuals.champion} ניצחה`;
  } else if (pickType === "topScorer" && actuals.top_scorer_player) {
    isDecided = true;
    isAlive = actuals.top_scorer_player === playerName || actuals.top_scorer_team === teamCode;
    label = isAlive ? "✓ מוביל/ה" : "✗ לא מלך/ת שערים";
  }

  if (!isDecided) return null;

  return (
    <span className={`inline-flex items-center text-[10px] font-bold rounded-full px-2 py-0.5 ${
      isAlive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600 line-through"
    }`}>
      {label}
    </span>
  );
}
