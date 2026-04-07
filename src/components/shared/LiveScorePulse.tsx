"use client";

import { motion, useAnimation } from "framer-motion";
import { useEffect, useRef } from "react";

interface LiveScorePulseProps {
  score: number;
  className?: string;
}

export function LiveScorePulse({ score, className = "" }: LiveScorePulseProps) {
  const controls = useAnimation();
  const prevScore = useRef(score);

  useEffect(() => {
    if (score !== prevScore.current) {
      controls.start({
        scale: [1, 1.4, 1],
        color: ["#111827", "#16a34a", "#111827"],
        transition: { duration: 0.5, ease: "easeOut" },
      });
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate(20);
      }
      prevScore.current = score;
    }
  }, [score, controls]);

  return (
    <motion.span
      animate={controls}
      className={`font-bold tabular-nums inline-block ${className}`}
      style={{ fontFamily: "var(--font-inter)" }}
    >
      {score}
    </motion.span>
  );
}
