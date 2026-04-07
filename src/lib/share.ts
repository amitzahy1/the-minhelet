// ============================================================================
// WC2026 — WhatsApp Share Utilities
// Generate formatted text for sharing to WhatsApp groups
// ============================================================================

/**
 * Share leaderboard standings to WhatsApp
 */
export function shareLeaderboard(players: { rank: number; name: string; total: number; today: string }[]): string {
  const lines = [
    "🏆 *The Minhelet — דירוג עדכני*",
    "━━━━━━━━━━━━━━━",
    ...players.slice(0, 10).map(p => {
      const medal = p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : `${p.rank}.`;
      return `${medal} *${p.name}* — ${p.total} נק׳ (${p.today} היום)`;
    }),
    "",
    "🔗 the-minhelet.vercel.app",
  ];
  return lines.join("\n");
}

/**
 * Share exact score prediction
 */
export function shareExactScore(userName: string, homeTeam: string, awayTeam: string, homeGoals: number, awayGoals: number): string {
  return [
    "🎯 *תוצאה מדויקת!*",
    "",
    `${userName} ניחש/ה נכון:`,
    `⚽ ${homeTeam} ${homeGoals} - ${awayGoals} ${awayTeam}`,
    "",
    "🏆 The Minhelet — מונדיאל 2026",
    "🔗 the-minhelet.vercel.app",
  ].join("\n");
}

/**
 * Share your predictions summary
 */
export function sharePredictions(userName: string, champion: string, topScorer: string): string {
  return [
    `⚽ *ההימורים של ${userName} למונדיאל 2026*`,
    "",
    `🏆 זוכה: *${champion}*`,
    `👟 מלך שערים: *${topScorer}*`,
    "",
    "מי מנצח? בואו להמר!",
    "🔗 the-minhelet.vercel.app",
  ].join("\n");
}

/**
 * Share rank achievement
 */
export function shareRank(userName: string, rank: number, total: number): string {
  return [
    rank === 1 ? "👑 *מוביל/ה את הטורניר!*" : `📊 *מקום ${rank} בטורניר*`,
    "",
    `${userName} — ${total} נקודות`,
    "",
    "🏆 The Minhelet — מונדיאל 2026",
    "🔗 the-minhelet.vercel.app",
  ].join("\n");
}

/**
 * Open WhatsApp with pre-filled text
 */
export function openWhatsApp(text: string) {
  const encoded = encodeURIComponent(text);
  window.open(`https://wa.me/?text=${encoded}`, "_blank");
}

/**
 * Copy to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
