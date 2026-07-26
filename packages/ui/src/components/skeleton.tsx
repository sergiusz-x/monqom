import type { HTMLAttributes } from "react";
import { cn } from "../lib/utils";

/**
 * Animated pulse placeholder for loading states.
 *
 * @example
 * ```tsx
 * <Skeleton className="h-10 w-full" />
 * <Skeleton className="h-4 w-3/4 mt-2" />
 * ```
 */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-muted", className)}
      {...props}
    />
  );
}
