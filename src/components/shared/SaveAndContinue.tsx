"use client";

import { useState } from "react";
import Link from "next/link";
import { useBettingStore } from "@/stores/betting-store";

/**
 * Slim inline save bar — sits at the bottom of each betting page as a
 * quiet footer with a progress bar, a compact save button, and (after a
 * successful save) a link to the next stage. Intentionally understated so
 * it doesn't dominate the layout.
 */
type Props = {
  label: string;
  nextHref?: string;
  nextLabel?: string;
  completion: number;
};

export function SaveAndContinue({ label, nextHref, nextLabel, completion }: Props) {
  const saveNow = useBettingStore((s) => s.saveNow);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSave = async () => {
    setState("saving");
    const result = await saveNow();
    if (result.success) {
      setState("saved");
    } else {
      setState("error");
      setErrorMsg(result.error || "שמירה נכשלה");
    }
  };

  const isFull = completion === 100;
  const barColor = isFull ? "bg-green-500" : completion > 0 ? "bg-blue-500" : "bg-gray-200";
  const btnColor = isFull
    ? "bg-green-600 hover:bg-green-700"
    : "bg-gray-900 hover:bg-gray-800";

  const hint = label.replace("💾 ", "").replace(" ✓", "");

  return (
    <div className="mt-6 mb-24 sm:mb-4 rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1 gap-2">
          <span className="text-xs font-bold text-gray-700 shrink-0" style={{ fontFamily: "var(--font-inter)" }}>
            {completion}%
          </span>
          <span className="text-[11px] text-gray-400 font-medium truncate text-end">{hint}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${completion}%` }} />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={state === "saving"}
        className={`shrink-0 px-4 py-2 rounded-lg text-white text-sm font-bold shadow-sm transition-all disabled:opacity-60 ${btnColor}`}
      >
        {state === "saving" && "שומר…"}
        {state === "saved" && "✓ נשמר"}
        {state === "error" && "⚠ נסה שוב"}
        {state === "idle" && "💾 שמור"}
      </button>

      {/* Show "continue to next stage" when either (a) the user has just
          saved successfully, or (b) the stage is 100% complete (so the
          CTA is visible even before they press save — the auto-save will
          catch their last edit anyway). */}
      {(state === "saved" || (isFull && state !== "saving")) && nextHref && (
        <Link
          href={nextHref}
          className="shrink-0 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-all"
        >
          {nextLabel || "המשך"} ←
        </Link>
      )}

      {state === "error" && errorMsg && (
        <span className="shrink-0 text-[11px] text-red-600 max-w-[140px] truncate" title={errorMsg}>
          {errorMsg}
        </span>
      )}
    </div>
  );
}
