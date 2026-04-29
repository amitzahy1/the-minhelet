"use client";

import { useMemo } from "react";
import { useSharedData } from "@/hooks/useSharedData";
import { isLocked } from "@/lib/constants";

// ============================================================================
// AgreementBadge — shows what percentage of other bettors made the same pick.
// Only renders after lock deadline (pre-lock: returns null to avoid spoilers).
// ============================================================================

interface Props {
  /** The pick value to match against (team code, player name, etc.) */
  value: string;
  /** Extract the comparable pick from a bracket or special bets object */
  extract: (advancements: unknown, specialBets: unknown, bracket: unknown) => string | null | undefined;
  className?: string;
}

export function AgreementBadge({ value, extract, className = "" }: Props) {
  const { advancements, specialBets, brackets, loading } = useSharedData();

  const pct = useMemo(() => {
    if (!isLocked() || loading || !value) return null;
    const total = advancements.length || brackets.length || 1;
    if (total === 0) return null;

    const count = advancements.filter((adv, i) => {
      const sb = specialBets[i];
      const b = brackets[i];
      return extract(adv, sb, b) === value;
    }).length;

    return Math.round((count / total) * 100);
  }, [value, advancements, specialBets, brackets, loading, extract]);

  if (!isLocked() || pct === null) return null;

  const color = pct >= 50 ? "text-green-700 bg-green-100" : pct >= 25 ? "text-amber-700 bg-amber-100" : "text-gray-600 bg-gray-100";

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold rounded-full px-2 py-0.5 ${color} ${className}`}>
      {pct}% מסכימים
    </span>
  );
}
