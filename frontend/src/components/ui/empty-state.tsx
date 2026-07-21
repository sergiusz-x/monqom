import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-6 text-center",
        className,
      )}
    >
      <div className="mb-3 text-muted-foreground" aria-hidden="true">
        {icon ?? <Inbox className="size-6" />}
      </div>
      <h2 className="font-medium">{title}</h2>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ??
        (actionLabel && onAction ? (
          <Button type="button" className="mt-4" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null)}
    </div>
  );
}
