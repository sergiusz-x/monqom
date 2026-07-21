import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface AsyncStateProps {
  status: "loading" | "error";
  message: string;
  onRetry?: () => void;
  skeletonRows?: number;
  className?: string;
  compact?: boolean;
}

export function AsyncState({
  status,
  message,
  onRetry,
  skeletonRows = 3,
  className,
  compact = false,
}: AsyncStateProps) {
  const { t } = useTranslation();

  if (status === "error") {
    return (
      <div className={cn("flex min-h-32 items-center", className)}>
        <Alert variant="error" compact={compact} className="w-full">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{message}</span>
            {onRetry ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
              >
                {t("common.retry")}
              </Button>
            ) : null}
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div
      className={cn("min-h-32 space-y-3", className)}
      role="status"
      aria-label={message}
    >
      <span className="sr-only">{message}</span>
      {Array.from({ length: skeletonRows }, (_, index) => (
        <Skeleton key={index} className={index === 0 ? "h-16" : "h-12"} />
      ))}
    </div>
  );
}
