import { AsyncState } from "@/components/ui/async-state";

interface RetryAlertProps {
  message: string;
  onRetry: () => void;
  className?: string;
}

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
