// ============================================================================
// WC2026 — Auto-backup system
// Saves all bets to CSV after every change + daily snapshots
// ============================================================================

import { useBettingStore, type BettingState } from "@/stores/betting-store";

/**
 * Export all bets as a CSV string
 */
export function exportBetsToCSV(state: BettingState): string {
  const lines: string[] = [];
  const now = new Date().toISOString();

  // Header
  lines.push("type,group,match,home_team,away_team,home_goals,away_goals,winner,position,value,timestamp");

  // Group bets
  for (const [groupId, group] of Object.entries(state.groups)) {
    // Group order
    group.order.forEach((teamIdx, pos) => {
      lines.push(`group_order,${groupId},,,,,,${teamIdx},${pos + 1},,${now}`);
    });

    // Match scores
    group.scores.forEach((score, matchIdx) => {
      if (score.home !== null) {
        lines.push(`group_match,${groupId},${matchIdx},,,,${score.home},${score.away},,,${now}`);
      }
    });
  }

  // Knockout bets
  for (const [key, match] of Object.entries(state.knockout)) {
    if (match.winner) {
      lines.push(`knockout,,,${key},,${match.score1 ?? ""},${match.score2 ?? ""},${match.winner},,${now}`);
    }
  }

  // Special bets
  const sb = state.specialBets;
  if (sb.winner) lines.push(`special,,,,,,,,winner,${sb.winner},${now}`);
  if (sb.finalist1) lines.push(`special,,,,,,,,finalist1,${sb.finalist1},${now}`);
  if (sb.finalist2) lines.push(`special,,,,,,,,finalist2,${sb.finalist2},${now}`);
  sb.semifinalists.forEach((v, i) => { if (v) lines.push(`special,,,,,,,,semifinalist_${i+1},${v},${now}`); });
  sb.quarterfinalists.forEach((v, i) => { if (v) lines.push(`special,,,,,,,,quarterfinalist_${i+1},${v},${now}`); });
  if (sb.topScorerPlayer) lines.push(`special,,,,,,,,top_scorer,${sb.topScorerTeam}:${sb.topScorerPlayer},${now}`);
  if (sb.topAssistsPlayer) lines.push(`special,,,,,,,,top_assists,${sb.topAssistsTeam}:${sb.topAssistsPlayer},${now}`);
  if (sb.bestAttack) lines.push(`special,,,,,,,,best_attack,${sb.bestAttack},${now}`);
  if (sb.prolificGroup) lines.push(`special,,,,,,,,prolific_group,${sb.prolificGroup},${now}`);
  if (sb.driestGroup) lines.push(`special,,,,,,,,driest_group,${sb.driestGroup},${now}`);
  if (sb.dirtiestTeam) lines.push(`special,,,,,,,,dirtiest_team,${sb.dirtiestTeam},${now}`);
  sb.matchups.forEach((v, i) => { if (v) lines.push(`special,,,,,,,,matchup_${i+1},${v},${now}`); });
  if (sb.penaltiesOverUnder) lines.push(`special,,,,,,,,penalties_ou,${sb.penaltiesOverUnder},${now}`);
  if (sb.mostGoalsMatchStage) lines.push(`special,,,,,,,,most_goals_stage,${sb.mostGoalsMatchStage},${now}`);
  if (sb.firstRedCardTeam) lines.push(`special,,,,,,,,first_red_card,${sb.firstRedCardTeam},${now}`);
  if (sb.youngestScorerTeam) lines.push(`special,,,,,,,,youngest_scorer,${sb.youngestScorerTeam},${now}`);

  return lines.join("\n");
}

/**
 * Export all bets as JSON string (full state backup)
 */
export function exportBetsToJSON(state: BettingState): string {
  return JSON.stringify({
    exportedAt: new Date().toISOString(),
    version: "1.0",
    groups: state.groups,
    knockout: state.knockout,
    specialBets: state.specialBets,
    bracketLocked: state.bracketLocked,
  }, null, 2);
}

/**
 * Download a file to the user's computer
 */
export function downloadFile(content: string, filename: string, type: string = "text/csv") {
  const blob = new Blob(["\uFEFF" + content], { type: `${type};charset=utf-8` }); // BOM for Hebrew in Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Auto-save to localStorage with timestamp (keeps last 7 days of snapshots)
 */
export function autoSaveSnapshot(state: BettingState) {
  const today = new Date().toISOString().split("T")[0]; // "2026-04-06"
  const key = `wc2026-backup-${today}`;
  const json = exportBetsToJSON(state);

  try {
    localStorage.setItem(key, json);

    // Clean old backups (keep last 7)
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith("wc2026-backup-"));
    if (allKeys.length > 7) {
      allKeys.sort();
      const toDelete = allKeys.slice(0, allKeys.length - 7);
      toDelete.forEach(k => localStorage.removeItem(k));
    }
  } catch {
    // localStorage full — ignore
  }
}

/**
 * Get list of available backups
 */
export function getAvailableBackups(): { date: string; key: string }[] {
  return Object.keys(localStorage)
    .filter(k => k.startsWith("wc2026-backup-"))
    .map(k => ({ date: k.replace("wc2026-backup-", ""), key: k }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Restore from a backup
 */
export function restoreFromBackup(key: string): BettingState | null {
  const json = localStorage.getItem(key);
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}
