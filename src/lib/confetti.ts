// ============================================================================
// WC2026 — Confetti celebration for exact score predictions
// ============================================================================

import confetti from "canvas-confetti";

export function fireConfetti() {
  // Gold and green confetti burst
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#FFD700", "#22C55E", "#3B82F6", "#F59E0B"],
  });

  // Second burst delayed
  setTimeout(() => {
    confetti({
      particleCount: 50,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ["#FFD700", "#22C55E"],
    });
    confetti({
      particleCount: 50,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ["#3B82F6", "#F59E0B"],
    });
  }, 250);
}

export function fireGoalCelebration() {
  confetti({
    particleCount: 30,
    spread: 50,
    origin: { y: 0.7 },
    colors: ["#22C55E", "#FFFFFF"],
    scalar: 0.8,
  });
}
