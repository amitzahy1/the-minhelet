"use client";

import { useState, useEffect } from "react";
import { LOCK_DEADLINE } from "@/lib/constants";

const TOURNAMENT_START = new Date("2026-06-11T00:00:00Z");

// Format: "10.06.2026 17:00"
function formatDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

const LOCK_DATE_STR = formatDate(new Date(LOCK_DEADLINE.getTime() + 3 * 60 * 60 * 1000)); // UTC+3
const TOURNAMENT_DATE_STR = formatDate(new Date(TOURNAMENT_START.getTime() + 3 * 60 * 60 * 1000));

function getStageInfo(now: Date): { stage: string; details: string } {
  if (now < LOCK_DEADLINE) {
    const diff = LOCK_DEADLINE.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const countdown = days > 0
      ? `בעוד ${days} ימים ${hours} שעות`
      : `בעוד ${hours}:${String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, "0")}`;
    return {
      stage: `שלב הימורים — נעילה ${countdown}`,
      details: `נעילה ב-${LOCK_DATE_STR} · השלימו את כל ההימורים לפני הנעילה`,
    };
  }

  if (now < TOURNAMENT_START) {
    return {
      stage: "ההימורים ננעלו!",
      details: `ננעל ב-${LOCK_DATE_STR} · השוואת הימורים פתוחה לצפייה · הטורניר מתחיל ב-${TOURNAMENT_DATE_STR}`,
    };
  }

  return {
    stage: "הטורניר בעיצומו!",
    details: "עקבו בלייב אחרי הניקוד",
  };
}

export function DemoBanner() {
  const [info, setInfo] = useState<{ stage: string; details: string } | null>(null);

  useEffect(() => {
    function update() {
      setInfo(getStageInfo(new Date()));
    }
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!info) return null;

  return (
    <div className="bg-gradient-to-l from-blue-500 to-indigo-600 text-white text-center text-xs sm:text-sm font-bold py-1.5 px-4">
      <span>⚽ {info.stage}</span>
      <span className="hidden sm:inline"> · {info.details}</span>
      <span className="sm:hidden block text-[10px] font-medium mt-0.5 opacity-90">{info.details}</span>
    </div>
  );
}
