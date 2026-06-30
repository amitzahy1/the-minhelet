"use client";

// ============================================================================
// Set of teams eliminated from the tournament, for the "מי חי" (who's-alive)
// comparison. Reuses the cached real-fixtures loader (same 2-min cache the
// live knockout status uses — no extra fetch storm) and the shared
// `computeEliminatedTeams` resolver, so the page can diff each bettor's picks
// against the real bracket instead of treating every pick as alive.
// ============================================================================

import { useEffect, useState } from "react";
import { loadRealFixtures } from "@/lib/fixtures-client";
import { computeEliminatedTeams } from "@/lib/scoring/knockout-resolver";
import type { FinishedMatch } from "@/lib/results-hits";

export function useEliminatedTeams(): { eliminated: Set<string>; ready: boolean } {
  const [eliminated, setEliminated] = useState<Set<string>>(() => new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = () =>
      loadRealFixtures().then((fixtures) => {
        if (!alive) return;
        // Identical scored-match mapping to useRealKnockoutStatus.
        const scored: FinishedMatch[] = fixtures
          .filter((m) => m.homeGoals != null && m.awayGoals != null)
          .map((m) => ({
            id: m.id, date: m.date, homeTla: m.homeTla, awayTla: m.awayTla,
            group: m.group ?? "", stage: m.stage ?? "",
            homeGoals: m.homeGoals as number, awayGoals: m.awayGoals as number,
            homePenalties: m.homePenalties ?? null, awayPenalties: m.awayPenalties ?? null,
            winner: m.winner ?? null,
          }));
        setEliminated(computeEliminatedTeams(scored));
        setReady(true);
      });
    run();
    const id = setInterval(run, 120_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return { eliminated, ready };
}
