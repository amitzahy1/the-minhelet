"use client";

// ============================================================================
// Live special-bet inputs for the "מי חי" page: the admin-entered actuals plus
// the current player race, fetched from /api/tournament-stats. Mirrors the
// mapping the standings page does, so scoreSpecialBetsForUser sees identical
// inputs. Used to fold "special bets you're on track for" into points-alive.
// ============================================================================

import { useEffect, useState } from "react";
import type { TournamentActuals, PlayerStat } from "@/lib/scoring/special-bets-scorer";

export function useLiveSpecials(): { actuals: TournamentActuals | null; playerStats: PlayerStat[]; ready: boolean } {
  const [actuals, setActuals] = useState<TournamentActuals | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStat[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        const res = await fetch("/api/tournament-stats");
        const data = await res.json();
        if (!alive) return;
        const a = data?.actuals;
        if (a) {
          setActuals({
            top_scorer_player: a.top_scorer_player ?? null,
            top_assists_player: a.top_assists_player ?? null,
            best_attack_team: a.best_attack_team ?? null,
            most_prolific_group: a.most_prolific_group ?? null,
            driest_group: a.driest_group ?? null,
            dirtiest_team: a.dirtiest_team ?? null,
            dirtiest_board: a.dirtiest_board ?? null,
            matchup_result_1: a.matchup_result_1 ?? null,
            matchup_result_2: a.matchup_result_2 ?? null,
            matchup_result_3: a.matchup_result_3 ?? null,
            penalties_over_under: a.penalties_over_under ?? null,
          });
        }
        if (Array.isArray(data?.scorers)) {
          setPlayerStats(
            data.scorers.map((s: { name: string; goals?: number; assists?: number; played?: number }) => ({
              name: s.name, goals: s.goals ?? 0, assists: s.assists ?? 0, minutes: s.played ?? 0,
            })),
          );
        }
        setReady(true);
      } catch {
        if (alive) setReady(true);
      }
    };
    run();
    const id = setInterval(run, 120_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  return { actuals, playerStats, ready };
}
