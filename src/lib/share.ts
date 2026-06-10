// ============================================================================
// WC2026 — WhatsApp Share Utilities
// Generate formatted text for sharing to WhatsApp groups
// ============================================================================

/**
 * Share leaderboard standings to WhatsApp.
 * `sheepName` — the unique last place ("הכבש?"); `lifterName` — the unique
 * first place ("המניף?"). Both jinx-marks carry into the group chat.
 */
export function shareLeaderboard(
  players: { rank: number; name: string; total: number; today: string }[],
  sheepName?: string | null,
  lifterName?: string | null,
): string {
  const lines = [
    "🏆 *The Minhelet — דירוג עדכני*",
    "━━━━━━━━━━━━━━━",
    ...players.slice(0, 10).map(p => {
      const medal = p.rank === 1 ? "🥇" : p.rank === 2 ? "🥈" : p.rank === 3 ? "🥉" : `${p.rank}.`;
      const mark =
        lifterName && p.name === lifterName ? " 🏆 המניף?" :
        sheepName && p.name === sheepName ? " 🐑 הכבש?" : "";
      return `${medal} *${p.name}* — ${p.total} נק׳ (${p.today} היום)${mark}`;
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
 * Share pre-filled text to WhatsApp.
 *
 * Native share sheet first: some WhatsApp desktop builds mangle astral-plane
 * characters (🏆 🥇 🐑 → �) when fed through a wa.me URL, and navigator.share
 * hands the text over directly so emojis survive; on mobile it also lets the
 * user pick the group in one tap. URL fallback for browsers without the Web
 * Share API, with same-tab navigation when window.open is blocked (iOS
 * standalone PWAs, popup blockers).
 */
export async function openWhatsApp(text: string) {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return; // user closed the sheet
      // else fall through to the URL approach
    }
  }
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (!win) window.location.href = url;
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
