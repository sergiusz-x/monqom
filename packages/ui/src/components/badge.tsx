import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit items-center rounded-full font-medium",
  {
    variants: {
      tone: {
        default: "bg-primary/10 text-primary",
        success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        danger: "bg-destructive/10 text-destructive",
        neutral: "bg-muted text-muted-foreground",
      },
      size: {
        sm: "px-2 py-1 text-xs",
        default: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: {
      tone: "default",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, size, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props} />
  );
}

export { badgeVariants };
