"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
  color?: string;
  height?: string;
}

export function ProgressBar({
  value,
  className,
  color = "bg-blue-500",
  height = "h-2",
}: ProgressBarProps) {
  return (
    <div className={cn("w-full bg-gray-200 rounded-full overflow-hidden", height, className)}>
      <motion.div
        className={cn("h-full rounded-full", color)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}
