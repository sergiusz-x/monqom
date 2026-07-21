import type { ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert } from "@/components/ui/alert";

interface StateMessageProps {
  children: ReactNode;
  variant?: "loading" | "empty" | "error";
  className?: string;
}

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
