"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LOADING_STEPS = [
  "מתחבר לשרת...",
  "טוען פרופילים...",
  "טוען הימורים...",
  "מכין את הנתונים...",
];

// Stagger each letter for the title reveal
const titleText = "THE MINHELET";

export function SplashScreen() {
  const [stepIdx, setStepIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 99) return 99;
        // Three-phase curve: zips 0→60 fast, slows 60→90, crawls 90→99.
        if (p < 60) return Math.min(60, p + 2.5);
        if (p < 90) return Math.min(90, p + Math.max(0.3, (90 - p) * 0.06));
        return Math.min(99, p + 0.15);
      });
    }, 50);

    const stepInterval = setInterval(() => {
      setStepIdx((i) => (i + 1) % LOADING_STEPS.length);
    }, 1200);

    return () => {
      clearInterval(interval);
      clearInterval(stepInterval);
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full max-w-[100vw] bg-gradient-to-b from-[#F8F9FB] via-white to-[#EEF2FF] flex items-center justify-center overflow-hidden" dir="rtl">
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

      <div className="relative flex flex-col items-center px-4 sm:px-6 w-full max-w-full">

        {/* Logo with layered animations */}
        <motion.div
          className="relative mb-10"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.35 }}
        >
          {/* Outer pulsing glow */}
          <motion.div
            className="absolute -inset-10 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)" }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Spinning outer ring */}
          <motion.div
            className="absolute -inset-4 rounded-full"
            style={{
              background: "conic-gradient(from 0deg, transparent 0%, rgba(99,102,241,0.35) 15%, transparent 30%, rgba(59,130,246,0.35) 50%, transparent 65%, rgba(139,92,246,0.35) 80%, transparent 100%)",
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
          />

          {/* Inner counter-spinning ring */}
          <motion.div
            className="absolute -inset-2 rounded-full"
            style={{
              background: "conic-gradient(from 180deg, transparent 0%, rgba(59,130,246,0.2) 20%, transparent 40%, rgba(99,102,241,0.2) 60%, transparent 80%)",
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          />

          {/* Particle dots orbiting */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute w-2.5 h-2.5 rounded-full bg-blue-400"
              style={{
                top: "50%",
                left: "50%",
                boxShadow: "0 0 8px 2px rgba(96,165,250,0.5)",
              }}
              animate={{
                x: [
                  Math.cos((i * 2 * Math.PI) / 3) * 140,
                  Math.cos((i * 2 * Math.PI) / 3 + Math.PI) * 140,
                  Math.cos((i * 2 * Math.PI) / 3 + 2 * Math.PI) * 140,
                ],
                y: [
                  Math.sin((i * 2 * Math.PI) / 3) * 140,
                  Math.sin((i * 2 * Math.PI) / 3 + Math.PI) * 140,
                  Math.sin((i * 2 * Math.PI) / 3 + 2 * Math.PI) * 140,
                ],
                opacity: [0.8, 1, 0.8],
                scale: [1, 1.3, 1],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "linear",
                delay: i * 0.3,
              }}
            />
          ))}

          {/* Logo image with hover-like float */}
          <motion.img
            src="/logo.png"
            alt="The Minhelet"
            className="relative w-40 h-40 sm:w-56 sm:h-56 md:w-72 md:h-72 rounded-full object-cover shadow-2xl ring-4 ring-white/80"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>

        {/* Title — letter by letter reveal with 3D flip */}
        <div className="mb-2 overflow-hidden w-full max-w-[90vw] sm:max-w-full" dir="ltr" style={{ perspective: "600px" }}>
          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-gray-900 tracking-tight flex justify-center flex-wrap" style={{ fontFamily: "var(--font-secular)" }}>
            {titleText.split("").map((char, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, y: 40, rotateX: -90 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{
                  delay: 0.6 + i * 0.05,
                  duration: 0.5,
                  type: "spring",
                  damping: 12,
                  stiffness: 150,
                }}
                className={char === " " ? "inline-block w-3 sm:w-5" : "inline-block"}
                style={{ transformOrigin: "bottom center" }}
              >
                {char}
              </motion.span>
            ))}
          </h1>
        </div>

        {/* Subtitle — slides in from both sides */}
        <div className="flex items-center gap-4 mb-12 overflow-hidden">
          <motion.div
            className="h-px w-12 sm:w-20 bg-gradient-to-l from-blue-400/60 to-transparent"
            initial={{ scaleX: 0, originX: 1 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.2, duration: 0.6, ease: "easeOut" }}
          />
          <motion.p
            className="text-lg sm:text-xl font-bold text-blue-500/70 uppercase tracking-[0.25em]"
            style={{ fontFamily: "var(--font-inter)" }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.0, duration: 0.5, type: "spring" }}
          >
            World Cup 2026
          </motion.p>
          <motion.div
            className="h-px w-12 sm:w-20 bg-gradient-to-r from-blue-400/60 to-transparent"
            initial={{ scaleX: 0, originX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.2, duration: 0.6, ease: "easeOut" }}
          />
        </div>

        {/* Loading bar + percentage */}
        <motion.div
          className="w-64 sm:w-80"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.5 }}
        >
          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-200/60 rounded-full overflow-hidden mb-3 shadow-inner">
            <motion.div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6, #6366f1, #3b82f6)",
                backgroundSize: "200% 100%",
                animation: "barShimmer 2s linear infinite",
              }}
              transition={{ duration: 0.15, ease: "linear" }}
            />
          </div>

          {/* Status text + percentage */}
          <div className="flex items-center justify-between">
            <AnimatePresence mode="wait">
              <motion.p
                key={stepIdx}
                className="text-sm text-gray-400 font-medium"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
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

      <style jsx>{`
        @keyframes barShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
