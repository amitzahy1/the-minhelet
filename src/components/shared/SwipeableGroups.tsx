"use client";

import { motion, useAnimation } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { useCallback } from "react";

interface SwipeableGroupsProps {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  children: React.ReactNode;
}

const SWIPE_THRESHOLD = 50;

export function SwipeableGroups({
  onSwipeLeft,
  onSwipeRight,
  children,
}: SwipeableGroupsProps) {
  const controls = useAnimation();

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      const { offset } = info;

      if (Math.abs(offset.x) > SWIPE_THRESHOLD) {
        // Haptic feedback
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(10);
        }

        if (offset.x > 0) {
          onSwipeRight();
        } else {
          onSwipeLeft();
        }
      }

      // Snap back
      controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
    },
    [onSwipeLeft, onSwipeRight, controls],
  );

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.3}
      onDragEnd={handleDragEnd}
      animate={controls}
      style={{ touchAction: "pan-y" }}
    >
      {children}
    </motion.div>
  );
}
