"use client";

import { motion, useAnimation } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { useCallback, useState } from "react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

const PULL_THRESHOLD = 60;

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const controls = useAnimation();

  const handleDrag = useCallback(
    (_: unknown, info: PanInfo) => {
      if (!refreshing && info.offset.y > 0) {
        setPullDistance(info.offset.y);
      }
    },
    [refreshing],
  );

  const handleDragEnd = useCallback(
    async (_: unknown, info: PanInfo) => {
      if (refreshing) return;

      if (info.offset.y > PULL_THRESHOLD) {
        setRefreshing(true);
        setPullDistance(PULL_THRESHOLD);

        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
          setPullDistance(0);
          controls.start({ y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } });
        }
      } else {
        setPullDistance(0);
        controls.start({ y: 0, transition: { type: "spring", stiffness: 300, damping: 25 } });
      }
    },
    [refreshing, onRefresh, controls],
  );

  const isPastThreshold = pullDistance > PULL_THRESHOLD;

  return (
    <div className="relative overflow-hidden">
      {/* Refresh indicator */}
      <div
        className="absolute inset-x-0 top-0 flex items-center justify-center"
        style={{ height: Math.min(pullDistance, PULL_THRESHOLD + 20) }}
      >
        {pullDistance > 10 && (
          <motion.span
            className="text-2xl select-none"
            animate={{
              rotate: refreshing ? 360 : isPastThreshold ? 180 : 0,
            }}
            transition={
              refreshing
                ? { repeat: Infinity, duration: 0.6, ease: "linear" }
                : { type: "spring", stiffness: 200 }
            }
          >
            ⚽
          </motion.span>
        )}
      </div>

      {/* Draggable content */}
      <motion.div
        drag={refreshing ? false : "y"}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={controls}
        style={{ touchAction: "pan-x" }}
      >
        {children}
      </motion.div>
    </div>
  );
}
