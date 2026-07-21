import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full max-w-5xl px-4 py-6 sm:px-6", className)}
    >
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  beforeTitle?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  visuallyHidden?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  beforeTitle,
  description,
  actions,
  visuallyHidden = false,
  className,
}: PageHeaderProps) {
  if (visuallyHidden) return <h1 className="sr-only">{title}</h1>;

  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div>
        {beforeTitle}
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
