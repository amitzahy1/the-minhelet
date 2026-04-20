"use client";

import { useToastStore } from "@/stores/toast-store";

const KIND_STYLES: Record<string, string> = {
  info: "bg-blue-50 border-blue-200 text-blue-800",
  success: "bg-green-50 border-green-200 text-green-800",
  warning: "bg-amber-50 border-amber-300 text-amber-900",
  error: "bg-red-50 border-red-300 text-red-800",
};

const KIND_ICONS: Record<string, string> = {
  info: "ℹ️",
  success: "✓",
  warning: "⚠️",
  error: "⚠",
};

/**
 * Stacks the transient toasts near the top-center of the screen so they
 * don't fight with the bottom-corner SaveIndicator pill.
 */
export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 sm:top-6 start-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <button
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`pointer-events-auto rounded-full border-2 shadow-lg px-4 py-2 flex items-center gap-2 text-sm font-bold max-w-[90vw] ${KIND_STYLES[t.kind]}`}
        >
          <span className="text-base leading-none">{KIND_ICONS[t.kind]}</span>
          <span className="truncate">{t.message}</span>
        </button>
      ))}
    </div>
  );
}
