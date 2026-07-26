import { cn } from "../lib/utils";

interface LoadingProps {
  /** Additional CSS classes for the wrapper element. */
  className?: string;
  /** Visible or screen-reader-only label announced to assistive technology. */
  label?: string;
}

/**
 * Accessible spinner for indicating an in-progress operation.
 *
 * @example
 * ```tsx
 * // Minimal – screen readers announce "Loading…"
 * <Loading />
 *
 * // Custom label
 * <Loading label="Fetching transactions…" />
 * ```
 */
export function Loading({ className, label = "Loading…" }: LoadingProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("flex items-center justify-center", className)}
    >
      <svg
        aria-hidden="true"
        focusable="false"
        className="h-6 w-6 animate-spin text-current"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {/* Visually hidden text for screen readers when a custom label is provided */}
      <span className="sr-only">{label}</span>
    </div>
  );
}
