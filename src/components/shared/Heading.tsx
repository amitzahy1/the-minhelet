"use client";

import { cn } from "@/lib/utils";

interface HeadingProps {
  as?: "h1" | "h2" | "h3";
  children: React.ReactNode;
  className?: string;
}

const sizeMap = {
  h1: "text-2xl sm:text-3xl",
  h2: "text-xl sm:text-2xl",
  h3: "text-lg sm:text-xl",
};

export function Heading({ as: Tag = "h2", children, className }: HeadingProps) {
  return (
    <Tag
      className={cn(
        sizeMap[Tag],
        "font-bold text-gray-900",
        className
      )}
      style={{ fontFamily: "var(--font-secular)" }}
    >
      {children}
    </Tag>
  );
}
