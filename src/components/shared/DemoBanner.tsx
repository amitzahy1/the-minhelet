"use client";

import { useState, useEffect } from "react";
import { LOCK_DEADLINE } from "@/lib/constants";

const TOURNAMENT_START = new Date("2026-06-11T00:00:00Z");

function getStageInfo(now: Date): string {
  if (now < LOCK_DEADLINE) {
    const diff = LOCK_DEADLINE.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) {
      return `מצב דמו — נעילה בעוד ${days} ימים ${hours} שעות · 18.04.2026 20:00`;
    }
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `מצב דמו — נעילה בעוד ${hours}:${String(minutes).padStart(2, "0")} · 18.04.2026 20:00`;
  }

  if (now < TOURNAMENT_START) {
    return "מצב דמו — ההימורים ננעלו! השוואת ההימורים נפתחה לצפייה";
  }

  return "מצב דמו — הטורניר בעיצומו!";
}

export function DemoBanner() {
  const [text, setText] = useState("");

  useEffect(() => {
    function update() {
      setText(getStageInfo(new Date()));
    }
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!text) return null;

  return (
    <div className="bg-amber-400 text-amber-950 text-center text-xs sm:text-sm font-bold py-1.5 px-4">
      ⚠️ {text}
    </div>
  );
}
