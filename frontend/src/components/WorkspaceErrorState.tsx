import { AsyncState } from "@monqom/ui";

interface WorkspaceErrorStateProps {
  message: string;
  className?: string;
  onRetry?: () => void;
}

export function WorkspaceErrorState({
  message,
  className = "",
  onRetry,
}: WorkspaceErrorStateProps) {
  return (
    <AsyncState
      status="error"
      message={message}
      onRetry={onRetry}
      className={className}
    />
  );
}
