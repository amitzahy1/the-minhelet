"use client";

// ============================================================================
// TeamLogo — preferred way to render a federation badge. Uses the real
// crest from Football-Data when available, falls back to the flag emoji
// for any team not in fd-crests.json (e.g. typo'd codes, future tournaments).
//
// Use anywhere a flag emoji appeared before. Keeps the API stable: just
// `<TeamLogo code="ARG" size="md" />` and it does the right thing.
// ============================================================================

import { getTeamCrest } from "@/lib/team-crests";
import { getFlag } from "@/lib/flags";

const SIZE_PX: Record<"sm" | "md" | "lg" | "xl", string> = {
  sm: "w-5 h-5 text-base",
  md: "w-7 h-7 text-xl",
  lg: "w-10 h-10 text-3xl",
  xl: "w-16 h-16 text-6xl",
};

interface Props {
  code: string | null | undefined;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Force-disable the crest path and always render the flag emoji. Useful
   *  in dense lists where downloading 11 SVGs per row would be wasteful. */
  flagOnly?: boolean;
}

export function TeamLogo({ code, size = "md", className = "", flagOnly = false }: Props) {
  const sizeCls = SIZE_PX[size];
  if (!code) return <span className={`${sizeCls} ${className}`} aria-hidden>⏳</span>;
  const crest = flagOnly ? null : getTeamCrest(code);
  if (crest) {
    return (
      <img
        src={crest}
        alt={code}
        className={`${sizeCls} object-contain inline-block ${className}`}
        loading="lazy"
        decoding="async"
      />
    );
  }
  return <span className={`${sizeCls} ${className}`} aria-hidden>{getFlag(code)}</span>;
}
