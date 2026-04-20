"use client";

import { useEffect, useState } from "react";
import { useSaveStatus } from "@/stores/save-status-store";

/**
 * Floating pill that tells the user whether their last bet change has
 * actually been saved to the DB. Idle → hidden. Pending → "שינויים לא
 * נשמרו" (ambers). Saving → "שומר…" (gray). Saved → "✓ נשמר" (green,
 * auto-dismisses after 2.5s). Error → "שגיאה בשמירה" (red, sticky).
 */
export function SaveIndicator() {
  const status = useSaveStatus((s) => s.status);
  const lastSavedAt = useSaveStatus((s) => s.lastSavedAt);
  const lastError = useSaveStatus((s) => s.lastError);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === "idle") return;
    setVisible(true);
    if (status === "saved") {
      const t = setTimeout(() => setVisible(false), 2500);
      return () => clearTimeout(t);
    }
  }, [status, lastSavedAt]);

  if (!visible || status === "idle") return null;

  const styles: Record<Exclude<typeof status, "idle">, { bg: string; border: string; text: string; icon: string; label: string }> = {
    pending: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", icon: "⋯", label: "שינוי ממתין לשמירה" },
    saving:  { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700", icon: "💾", label: "שומר..." },
    saved:   { bg: "bg-green-50", border: "border-green-300", text: "text-green-800", icon: "✓", label: "נשמר" },
    error:   { bg: "bg-red-50", border: "border-red-300", text: "text-red-700", icon: "⚠", label: lastError ? `שגיאה: ${lastError}` : "שגיאה בשמירה" },
  };

  const s = styles[status];

  return (
    <div
      className={`fixed bottom-20 sm:bottom-6 end-4 sm:end-6 z-40 rounded-full border shadow-md px-4 py-2 flex items-center gap-2 text-sm font-bold transition-all ${s.bg} ${s.border} ${s.text}`}
      aria-live="polite"
    >
      <span className="text-base leading-none">{s.icon}</span>
      <span>{s.label}</span>
    </div>
  );
}
