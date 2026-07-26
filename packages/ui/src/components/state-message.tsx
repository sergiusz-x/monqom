import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { Alert } from "./alert";

interface StateMessageProps {
  children: ReactNode;
  variant?: "loading" | "empty" | "error";
  className?: string;
}

/**
 * Inline status message for loading, empty, or error states.
 *
 * For block-level error+retry use `AsyncState` instead.
 *
 * @example
 * ```tsx
 * <StateMessage variant="loading">Loading categories…</StateMessage>
 * <StateMessage variant="empty">No results found.</StateMessage>
 * <StateMessage variant="error">Something went wrong.</StateMessage>
 * ```
 */
export function StateMessage({
  children,
  variant = "empty",
  className,
}: StateMessageProps) {
  if (variant === "error") {
    return (
      <Alert variant="error" className={className}>
        {children}
      </Alert>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-8 text-center text-sm text-muted-foreground",
        className,
      )}
      role={variant === "loading" ? "status" : undefined}
    >
      {variant === "loading" && (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      )}
      <span>{children}</span>
    </div>
  );
}
