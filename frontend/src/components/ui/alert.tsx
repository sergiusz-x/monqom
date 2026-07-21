import type { HTMLAttributes, ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertVariant = "error" | "warning" | "info" | "success";

const variantStyles: Record<AlertVariant, string> = {
  error: "border-destructive/30 bg-destructive/10 text-destructive",
  warning: "border-warning/30 bg-warning/10 text-warning",
  info: "border-info/30 bg-info/10 text-info",
  success: "border-success/30 bg-success/10 text-success",
};

const variantIcons = {
  error: CircleAlert,
  warning: TriangleAlert,
  info: Info,
  success: CircleCheck,
};

interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant;
  title?: ReactNode;
  compact?: boolean;
}

export function Alert({
  variant = "info",
  title,
  compact = false,
  className,
  children,
  role,
  ...props
}: AlertProps) {
  const Icon = variantIcons[variant];

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border text-sm",
        compact ? "px-3 py-2" : "p-4",
        variantStyles[variant],
        className,
      )}
      role={role ?? (variant === "error" ? "alert" : "status")}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold">{title}</div>}
        <div className={cn(title && "mt-1", "text-current/90")}>{children}</div>
      </div>
    </div>
  );
}
