"use client";

import { cn } from "@/lib/utils";

interface TeamBadgeProps {
  code: string;
  name: string;
  flagUrl?: string;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
  className?: string;
}

// Simple emoji flag mapping for common countries
const FLAG_EMOJIS: Record<string, string> = {
  ARG: "🇦🇷", BRA: "🇧🇷", FRA: "🇫🇷", GER: "🇩🇪", ESP: "🇪🇸",
  ENG: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", POR: "🇵🇹", NED: "🇳🇱", BEL: "🇧🇪", ITA: "🇮🇹",
  CRO: "🇭🇷", URU: "🇺🇾", COL: "🇨🇴", MEX: "🇲🇽", USA: "🇺🇸",
  JPN: "🇯🇵", KOR: "🇰🇷", AUS: "🇦🇺", MAR: "🇲🇦", SEN: "🇸🇳",
  NGA: "🇳🇬", CMR: "🇨🇲", CAN: "🇨🇦", CHI: "🇨🇱", PER: "🇵🇪",
  ECU: "🇪🇨", PAR: "🇵🇾", BOL: "🇧🇴", HON: "🇭🇳", CRC: "🇨🇷",
  PAN: "🇵🇦", JAM: "🇯🇲", TRI: "🇹🇹", NZL: "🇳🇿", IRN: "🇮🇷",
  KSA: "🇸🇦", QAT: "🇶🇦", BHR: "🇧🇭", UZB: "🇺🇿", IDN: "🇮🇩",
  BFA: "🇧🇫", CIV: "🇨🇮", TUN: "🇹🇳", ALB: "🇦🇱", DEN: "🇩🇰",
  SRB: "🇷🇸", WAL: "🏴󠁧󠁢󠁷󠁬󠁳󠁿", TBD: "🏳️",
};

export function TeamBadge({
  code,
  name,
  size = "md",
  showName = true,
  className,
}: TeamBadgeProps) {
  const flag = FLAG_EMOJIS[code] || "🏳️";
  const textSize = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  }[size];
  const flagSize = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
  }[size];

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className={flagSize}>{flag}</span>
      {showName && (
        <span className={cn("font-medium", textSize)}>{code}</span>
      )}
    </span>
  );
}

export function getFlag(code: string): string {
  return FLAG_EMOJIS[code] || "🏳️";
}
