// ============================================================================
// WC2026 — Canvas-rendered leaderboard share card.
//
// WhatsApp desktop mangles emoji that travel through wa.me URL text (even
// BMP ones like ⚽ → �), and bidi reordering breaks *bold* markers on RTL
// lines. Rendering the table to a PNG sidesteps the whole class of bugs:
// emojis are drawn by the system emoji font INSIDE the image, RTL layout is
// laid out by us, and WhatsApp just shows a picture.
//
// Share strategy (shareLeaderboardImage):
//   1. navigator.share with the PNG file — mobile: opens the native sheet,
//      user picks the WhatsApp group, image lands perfectly.
//   2. Clipboard PNG — desktop: image is copied; user pastes (Ctrl+V) into
//      the group. Caller shows the "copied" hint.
//   3. Download fallback — when clipboard is unavailable.
// ============================================================================

export interface ShareImageRow {
  rank: number;
  name: string;
  total: number;
  today: string;
  isLifter?: boolean;
  isSheep?: boolean;
}

const FONT = "-apple-system, 'Segoe UI', 'Noto Sans Hebrew', 'Arial Hebrew', sans-serif";

export function renderLeaderboardImage(rows: ShareImageRow[], dateLabel: string): Promise<Blob> {
  const scale = 2;
  const W = 460;
  const pad = 18;
  const headerH = 78;
  const rowH = 42;
  const footerH = 44;
  const H = headerH + rows.length * rowH + footerH;

  const canvas = document.createElement("canvas");
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Card background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Header — dark band with title
  const headerGrad = ctx.createLinearGradient(0, 0, W, 0);
  headerGrad.addColorStop(0, "#0f172a");
  headerGrad.addColorStop(1, "#1e3a5f");
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, W, headerH);

  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 22px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText("🏆 The Minhelet", W - pad, 30);
  ctx.font = `600 13px ${FONT}`;
  ctx.fillStyle = "#cbd5e1";
  ctx.fillText(`דירוג עדכני · ${dateLabel}`, W - pad, 56);
  ctx.font = `26px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("⚽", pad, 40);

  // Rows
  rows.forEach((r, i) => {
    const y = headerH + i * rowH;
    const cy = y + rowH / 2;

    // Row background: gold tint for 1st, soft gray for last, zebra otherwise
    ctx.fillStyle =
      r.rank === 1 ? "#fef9e7" :
      i === rows.length - 1 && r.isSheep ? "#f3f4f6" :
      i % 2 === 0 ? "#ffffff" : "#f8fafc";
    ctx.fillRect(0, y, W, rowH);

    // Rank / medal (right edge)
    ctx.textAlign = "center";
    const rankX = W - pad - 14;
    if (r.rank <= 3) {
      ctx.font = `18px ${FONT}`;
      ctx.fillText(r.rank === 1 ? "🥇" : r.rank === 2 ? "🥈" : "🥉", rankX, cy);
    } else {
      ctx.font = `700 14px ${FONT}`;
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(String(r.rank), rankX, cy);
    }

    // Name + jinx mark (RTL: name sits right of center, after the rank)
    ctx.textAlign = "right";
    ctx.fillStyle = "#0f172a";
    ctx.font = `800 15px ${FONT}`;
    const nameX = W - pad - 34;
    const mark = r.isLifter ? " 🏆" : r.isSheep ? " 🐑" : "";
    // Truncate long names so the points column never collides
    let name = r.name;
    while (ctx.measureText(name + mark).width > W - 170 && name.length > 3) {
      name = name.slice(0, -2);
    }
    if (name !== r.name) name += "…";
    ctx.fillText(name + mark, nameX, cy);
    if (r.isLifter || r.isSheep) {
      ctx.font = `600 10px ${FONT}`;
      ctx.fillStyle = r.isLifter ? "#b45309" : "#6b7280";
      const label = r.isLifter ? "מניף" : "הכבש?";
      ctx.fillText(label, nameX - ctx.measureText(name).width - 26, cy);
    }

    // Today (left-center column)
    ctx.textAlign = "left";
    ctx.font = `700 13px ${FONT}`;
    ctx.fillStyle = r.today.startsWith("+") ? "#16a34a" : "#94a3b8";
    ctx.fillText(`${r.today} היום`, pad + 64, cy);

    // Total points (left edge, big)
    ctx.font = `900 18px ${FONT}`;
    ctx.fillStyle = "#0f172a";
    ctx.fillText(String(r.total), pad, cy);

    // Separator
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y + rowH);
    ctx.lineTo(W, y + rowH);
    ctx.stroke();
  });

  // Footer
  const fy = headerH + rows.length * rowH;
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, fy, W, footerH);
  ctx.textAlign = "center";
  ctx.font = `700 12px ${FONT}`;
  ctx.fillStyle = "#64748b";
  ctx.fillText("the-minhelet.vercel.app", W / 2, fy + footerH / 2);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}

export type ShareImageOutcome = "shared" | "copied" | "downloaded";

/**
 * Share the rendered leaderboard PNG. Returns how it was delivered so the
 * caller can show the right hint ("copied — paste in WhatsApp").
 */
export async function shareLeaderboardImage(
  rows: ShareImageRow[],
  dateLabel: string,
): Promise<ShareImageOutcome> {
  const blob = await renderLeaderboardImage(rows, dateLabel);
  const file = new File([blob], "minhelet-standings.png", { type: "image/png" });

  // 1. Native share with file (mobile — straight into the WhatsApp group)
  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "shared"; // user closed the sheet
      // fall through
    }
  }

  // 2. Clipboard PNG (desktop — paste into the group)
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return "copied";
  } catch {
    // fall through
  }

  // 3. Download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "minhelet-standings.png";
  a.click();
  URL.revokeObjectURL(url);
  return "downloaded";
}
