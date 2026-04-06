"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScoreInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

export function ScoreInput({
  value,
  onChange,
  disabled = false,
  size = "md",
}: ScoreInputProps) {
  const decrement = () => {
    if (value > 0) onChange(value - 1);
  };

  const increment = () => {
    if (value < 20) onChange(value + 1);
  };

  const buttonSize = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const textSize = size === "sm" ? "text-lg w-8" : "text-2xl w-10";

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        className={cn(buttonSize, "rounded-full text-lg shrink-0")}
        onClick={decrement}
        disabled={disabled || value <= 0}
        type="button"
      >
        -
      </Button>
      <span
        className={cn(
          textSize,
          "text-center font-bold tabular-nums select-none"
        )}
      >
        {value}
      </span>
      <Button
        variant="outline"
        size="icon"
        className={cn(buttonSize, "rounded-full text-lg shrink-0")}
        onClick={increment}
        disabled={disabled}
        type="button"
      >
        +
      </Button>
    </div>
  );
}
