import { AsyncState } from "./async-state";

interface RetryAlertProps {
  message: string;
  onRetry: () => void;
  className?: string;
}

/**
 * Thin wrapper around `AsyncState` for the common error+retry pattern.
 *
 * @example
 * ```tsx
 * <RetryAlert message={error.message} onRetry={refetch} />
 * ```
 */
export function RetryAlert({ message, onRetry, className }: RetryAlertProps) {
  return (
    <AsyncState
      status="error"
      message={message}
      onRetry={onRetry}
      className={className}
    />
  );
}
