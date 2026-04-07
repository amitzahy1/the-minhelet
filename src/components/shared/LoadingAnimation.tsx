"use client";

import { motion } from "framer-motion";

export function LoadingAnimation({ text = "טוען..." }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      {/* Bouncing football */}
      <div className="relative w-16 h-24">
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2"
          animate={{
            y: [0, -40, 0],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="48" fill="white" stroke="#1F2937" strokeWidth="3" />
            <path d="M50 10L62 35H85L67 52L73 78L50 63L27 78L33 52L15 35H38L50 10Z" fill="#1F2937" opacity="0.15" />
            <path d="M30 25L50 10L70 25" stroke="#1F2937" strokeWidth="2" opacity="0.3" />
            <path d="M15 55L30 75L50 90L70 75L85 55" stroke="#1F2937" strokeWidth="2" opacity="0.3" />
          </svg>
        </motion.div>
        {/* Shadow */}
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-2 bg-gray-300 rounded-full"
          animate={{
            scaleX: [1, 0.6, 1],
            opacity: [0.5, 0.2, 0.5],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>
      {/* Text with dots animation */}
      <motion.p
        className="text-base font-bold text-gray-500"
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {text}
      </motion.p>
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <LoadingAnimation />
    </div>
  );
}

export function LoadingCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <LoadingAnimation text="טוען נתונים..." />
    </div>
  );
}
