"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface SlotMachineScoreProps {
  value: number;
  className?: string;
}

export function SlotMachineScore({ value, className }: SlotMachineScoreProps) {
  const prevValue = useRef(value);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (value !== prevValue.current) {
      setDirection(value > prevValue.current ? 1 : -1);
      prevValue.current = value;
    }
  }, [value]);

  return (
    <div
      className={`relative inline-flex overflow-hidden ${className ?? ""}`}
      style={{ lineHeight: 1 }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: direction * 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: direction * -30, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
