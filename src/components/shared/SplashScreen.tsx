"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LOADING_STEPS = [
  "מתחבר לשרת...",
  "טוען פרופילים...",
  "טוען הימורים...",
  "מכין את הנתונים...",
];

export function SplashScreen() {
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress from 0 to ~90% over time (real loading finishes it)
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return 90;
        // Fast at start, slows down as it approaches 90
        const increment = Math.max(0.5, (90 - p) * 0.08);
        return Math.min(90, p + increment);
      });
    }, 50);

    // Cycle through loading steps
    const stepInterval = setInterval(() => {
      setStepIdx((i) => (i + 1) % LOADING_STEPS.length);
    }, 1200);

    return () => {
      clearInterval(interval);
      clearInterval(stepInterval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F8F9FB] via-white to-[#EEF2FF] flex items-center justify-center overflow-hidden" dir="rtl">
      {/* Animated background orbs */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full bg-blue-400/5"
        animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.15, 0.95, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        style={{ top: "5%", right: "-10%" }}
      />
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full bg-indigo-400/5"
        animate={{ x: [0, -30, 25, 0], y: [0, 25, -20, 0], scale: [1, 0.9, 1.1, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        style={{ bottom: "0%", left: "-5%" }}
      />

      {/* Dot pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "radial-gradient(circle at 1px 1px, #6366f1 1px, transparent 0)",
        backgroundSize: "40px 40px",
      }} />

      <div className="relative flex flex-col items-center px-6">

        {/* Logo with animated glow */}
        <motion.div
          className="relative mb-10"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.7, type: "spring", bounce: 0.4 }}
        >
          {/* Pulsing glow */}
          <motion.div
            className="absolute -inset-6 rounded-full bg-gradient-to-br from-blue-400/20 to-indigo-400/20 blur-3xl"
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Spinning ring */}
          <motion.div
            className="absolute -inset-3 rounded-full"
            style={{
              background: "conic-gradient(from 0deg, transparent 0%, rgba(99,102,241,0.3) 25%, transparent 50%, rgba(59,130,246,0.3) 75%, transparent 100%)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />
          {/* Logo */}
          <img
            src="/logo.png"
            alt="The Minhelet"
            className="relative w-56 h-56 sm:w-72 sm:h-72 rounded-full object-cover shadow-2xl ring-4 ring-white/80"
          />
        </motion.div>

        {/* Title */}
        <motion.h1
          className="text-5xl sm:text-7xl font-black text-gray-900 tracking-tight mb-2"
          style={{ fontFamily: "var(--font-secular)" }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          THE MINHELET
        </motion.h1>

        {/* Subtitle with decorative lines */}
        <motion.div
          className="flex items-center gap-4 mb-12"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <div className="h-px w-12 sm:w-20 bg-gradient-to-l from-blue-400/60 to-transparent" />
          <p className="text-lg sm:text-xl font-bold text-blue-500/70 uppercase tracking-[0.25em]" style={{ fontFamily: "var(--font-inter)" }}>
            World Cup 2026
          </p>
          <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-blue-400/60 to-transparent" />
        </motion.div>

        {/* Loading bar + percentage */}
        <motion.div
          className="w-64 sm:w-80"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-200/60 rounded-full overflow-hidden mb-3">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400"
              style={{ width: `${progress}%` }}
              transition={{ duration: 0.15, ease: "linear" }}
            />
          </div>

          {/* Status text + percentage */}
          <div className="flex items-center justify-between">
            <AnimatePresence mode="wait">
              <motion.p
                key={stepIdx}
                className="text-sm text-gray-400 font-medium"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                {LOADING_STEPS[stepIdx]}
              </motion.p>
            </AnimatePresence>
            <p className="text-sm font-bold text-blue-500/70 tabular-nums" style={{ fontFamily: "var(--font-inter)" }}>
              {Math.round(progress)}%
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
