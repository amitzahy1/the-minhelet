"use client";

import { useCallback } from "react";

export function useConfetti() {
  const fire = useCallback(async () => {
    try {
      const confetti = (await import("canvas-confetti")).default;
      // Gold and green burst
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ["#FFD700", "#22C55E", "#3B82F6", "#F59E0B"] });
      setTimeout(() => {
        confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 }, colors: ["#FFD700", "#22C55E"] });
        confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 }, colors: ["#3B82F6", "#F59E0B"] });
      }, 250);
    } catch { /* canvas-confetti not loaded */ }
  }, []);

  return fire;
}
