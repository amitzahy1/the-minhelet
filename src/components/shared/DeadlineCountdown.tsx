"use client";

import { useState, useEffect } from "react";

// Tournament lock deadline: June 10, 2026, 17:00 Israel time
const DEADLINE = new Date("2026-06-10T14:00:00Z"); // 17:00 IST = 14:00 UTC

export function DeadlineCountdown() {
  const [timeLeft, setTimeLeft] = useState("");
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    function update() {
      const now = new Date();
      const diff = DEADLINE.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft("ההימורים ננעלו!");
        setUrgent(true);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 7) {
        setTimeLeft(`${days} ימים`);
        setUrgent(false);
      } else if (days > 0) {
        setTimeLeft(`${days} ימים ${hours} שעות`);
        setUrgent(days <= 3);
      } else {
        setTimeLeft(`${hours}:${String(minutes).padStart(2, "0")}`);
        setUrgent(true);
      }
    }

    update();
    const interval = setInterval(update, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${
      urgent ? "bg-red-50 text-red-700 border border-red-200" : "bg-blue-50 text-blue-700 border border-blue-200"
    }`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      <span>נעילה בעוד {timeLeft}</span>
    </div>
  );
}
