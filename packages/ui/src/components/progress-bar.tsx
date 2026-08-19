import type { HTMLAttributes } from "react";

import { cn } from "../lib/utils";

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  ariaLabel: string;
  indicatorClassName?: string;
}

export function ProgressBar({
  value,
  ariaLabel,
  className,
  indicatorClassName,
  ...props
}: ProgressBarProps) {
  const normalizedValue = Math.min(Math.max(value, 0), 100);

  return (
    <div
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-muted",
        className,
      )}
      {...props}
    >
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuenow={normalizedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          "h-full rounded-full bg-primary transition-[width]",
          indicatorClassName,
        )}
        style={{ width: `${normalizedValue}%` }}
      />
    </div>
  );
}
