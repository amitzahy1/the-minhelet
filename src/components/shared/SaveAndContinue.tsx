"use client";

import { useState } from "react";
import Link from "next/link";
import { useBettingStore } from "@/stores/betting-store";

/**
 * Explicit save button anchored at the bottom of each betting page.
 * Before the user finishes all bets, the auto-save is disabled — so this
 * button is their only way to persist partial progress. After they save we
 * show a subtle "נשמר" confirmation and (if they're not on the last stage)
 * offer a link to the next stage.
 */
type Props = {
  /** ILabel on the button itself — e.g. "💾 שמור והמשך לעץ הטורניר" */
  label: string;
  /** Optional href to navigate to after successful save */
  nextHref?: string;
  /** Label shown when save completes and a nextHref exists */
  nextLabel?: string;
  /** Completion percentage for this stage (0–100) — tints the button */
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
  const btnClass = isFull
    ? "bg-gradient-to-l from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
    : "bg-gradient-to-l from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600";

  return (
    <div className="mt-8 mb-4 rounded-2xl border-2 border-blue-200 bg-gradient-to-l from-blue-50 via-white to-indigo-50 p-4 sm:p-6 shadow-md">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900">שמירת הימורים</h3>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            {isFull
              ? "מילאת את כל ההימורים בשלב הזה 🎉 לחץ שמור כדי לשמור את ההתקדמות."
              : `מילאת ${completion}% מההימורים. לחץ שמור כדי שלא לאבד את ההתקדמות.`}
          </p>
        </div>
        <div className="text-3xl sm:text-4xl font-bold text-blue-600 tabular-nums" style={{ fontFamily: "Inter" }}>
          {completion}%
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={state === "saving"}
        className={`w-full rounded-xl px-4 py-3 text-white font-bold text-base sm:text-lg shadow-md transition-all disabled:opacity-60 ${btnClass}`}
      >
        {state === "saving" && "⏳ שומר..."}
        {state === "saved" && "✓ נשמר בהצלחה"}
        {state === "error" && `⚠ ${errorMsg || "שמירה נכשלה"} — לחץ שוב`}
        {state === "idle" && label}
      </button>

      {state === "saved" && nextHref && (
        <Link
          href={nextHref}
          className="mt-3 w-full flex items-center justify-center rounded-xl px-4 py-3 bg-white border-2 border-blue-300 text-blue-700 font-bold text-base hover:bg-blue-50 transition-all"
        >
          {nextLabel || "המשך →"}
        </Link>
      )}

      {!isFull && (
        <p className="mt-3 text-xs text-gray-500 text-center">
          ℹ️ טיפ: ההימורים לא יישמרו אוטומטית עד שתסיים את כל השלב. לחץ על כפתור השמירה בעת שעזבת את הדף.
        </p>
      )}
    </div>
  );
}
