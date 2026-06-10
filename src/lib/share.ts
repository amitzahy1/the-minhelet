// ============================================================================
// WC2026 — WhatsApp Share Utilities
// Generate formatted text for sharing to WhatsApp groups
// ============================================================================

/**
 * Share leaderboard standings to WhatsApp — ALL players, no cap.
 *
 * IMPORTANT: only BMP-safe characters in this text (⚽ ★ ━). Astral-plane
 * emoji (🏆 🥇 🐑 …) arrive as � when the text travels through a wa.me URL
 * into WhatsApp desktop. The UI chips keep the fancy emojis; the share text
 * trades them for symbols that survive everywhere.
 * `sheepName` — unique last place ("הכבש?"); `lifterName` — unique first
 * place ("מניף").
 */
export function shareLeaderboard(
  players: { rank: number; name: string; total: number; today: string }[],
  sheepName?: string | null,
  lifterName?: string | null,
): string {
  const lines = [
    "⚽ *The Minhelet — דירוג עדכני*",
    "━━━━━━━━━━━━━━━",
    ...players.map(p => {
      const medal = p.rank === 1 ? "★" : `${p.rank}.`;
      const mark =
        lifterName && p.name === lifterName ? " · מניף" :
        sheepName && p.name === sheepName ? " · הכבש?" : "";
      return `${medal} *${p.name}* — ${p.total} נק׳ (${p.today} היום)${mark}`;
    }),
    "",
    "the-minhelet.vercel.app",
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
 * Open WhatsApp with pre-filled text.
 *
 * WhatsApp desktop mangles astral-plane characters that arrive through wa.me
 * URLs (🏆 → �), so the share texts above are BMP-safe by construction and
 * this function strips any astral char that still sneaks in via user content
 * (e.g. a display name like "🤖 בוט") — losing an emoji beats sending �.
 * Falls back to same-tab navigation when window.open is blocked (iOS
 * standalone PWAs, popup blockers).
 */
export function openWhatsApp(text: string) {
  const safe = text.replace(/[\u{10000}-\u{10FFFF}]/gu, "").replace(/ {2,}/g, " ");
  const url = `https://wa.me/?text=${encodeURIComponent(safe)}`;
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
