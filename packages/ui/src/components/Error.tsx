import { CircleAlert } from "lucide-react";
import { Button } from "./button";
import { cn } from "../lib/utils";

interface ErrorProps {
  title: string;
  description?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Full-block error state displayed when a page or section fails to load.
 *
 * @example
 * ```tsx
 * <Error
 *   title="Failed to load transactions"
 *   description="An unexpected error occurred. Please try again."
 *   retryLabel="Retry"
 *   onRetry={refetch}
 * />
 * ```
 */
export function Error({
  title,
  description,
  retryLabel,
  onRetry,
  className,
}: ErrorProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center",
        className,
      )}
    >
      <div className="mb-3 text-destructive" aria-hidden="true">
        <CircleAlert className="size-6" />
      </div>
      <h2 className="font-medium text-destructive">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {retryLabel && onRetry ? (
        <Button
          type="button"
          variant="destructive"
          className="mt-4"
          onClick={onRetry}
        >
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
