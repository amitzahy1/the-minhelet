"use client";

import { useEffect, useState } from "react";
import { useSaveStatus } from "@/stores/save-status-store";

/**
 * Prominent save-status pill. Tells the user, on every bet change, whether it
 * has reached the DB — so nobody navigates away thinking a pick is saved when
 * it isn't.
 *
 *   pending → "שינויים נשמרים…" (amber, pulsing) — stays until saving starts
 *   saving  → "שומר…" (blue, spinner)            — stays until done
 *   saved   → "✓ נשמר" (green)                   — auto-dismisses after 2s
 *   error   → "שמירה נכשלה — מנסה שוב" (red)      — sticky
 *
 * Centered above the bottom nav on mobile (where the thumb is), bottom-end on
 * desktop. Pending/saving/error never auto-hide, so the signal is unmissable.
 */
export function SaveIndicator() {
  const status = useSaveStatus((s) => s.status);
  const lastSavedAt = useSaveStatus((s) => s.lastSavedAt);
  const lastError = useSaveStatus((s) => s.lastError);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === "idle") {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (status === "saved") {
      const t = setTimeout(() => setVisible(false), 2000);
      return () => clearTimeout(t);
    }
  }, [status, lastSavedAt]);

  if (!visible || status === "idle") return null;

  const isBusy = status === "pending" || status === "saving";
  const styles: Record<Exclude<typeof status, "idle">, { bg: string; ring: string; text: string; label: string }> = {
    pending: { bg: "bg-amber-100", ring: "ring-amber-300", text: "text-amber-900", label: "שינויים נשמרים…" },
    saving:  { bg: "bg-blue-100", ring: "ring-blue-300", text: "text-blue-900", label: "שומר…" },
    saved:   { bg: "bg-green-100", ring: "ring-green-400", text: "text-green-900", label: "נשמר" },
    error:   { bg: "bg-red-100", ring: "ring-red-300", text: "text-red-900", label: lastError ? `שמירה נכשלה — ${lastError}` : "שמירה נכשלה — מנסה שוב" },
  };
  const s = styles[status];

  return (
    <div
      className="fixed z-50 bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:end-6 pointer-events-none"
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-2 rounded-full ${s.bg} ${s.text} ring-2 ${s.ring} shadow-lg px-5 py-2.5 text-sm font-black ${isBusy ? "animate-pulse" : ""}`}
      >
        {isBusy ? (
          <svg className="animate-spin h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z" />
          </svg>
        ) : status === "saved" ? (
          <span className="text-base leading-none">✓</span>
        ) : (
          <span className="text-base leading-none">⚠</span>
        )}
        <span className="whitespace-nowrap">{s.label}</span>
      </div>
    </div>
  );
}
