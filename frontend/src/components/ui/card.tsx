import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const cardVariants = cva("rounded-xl border", {
  variants: {
    tone: {
      default: "border-border bg-card text-card-foreground",
      muted: "border-border bg-muted/20 text-foreground",
      transparent: "border-border bg-transparent text-foreground",
      danger: "border-destructive/30 bg-destructive/5 text-foreground",
    },
    padding: {
      none: "",
      compact: "p-3",
      default: "p-4",
      responsive: "p-4 sm:p-6",
      spacious: "p-6",
    },
    elevation: {
      flat: "",
      raised: "shadow-sm",
    },
  },
  defaultVariants: {
    tone: "default",
    padding: "default",
    elevation: "flat",
  },
});

type SurfaceVariantProps = VariantProps<typeof cardVariants>;

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>, SurfaceVariantProps {}

export function Card({
  className,
  tone,
  padding,
  elevation,
  ...props
}: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ tone, padding, elevation }), className)}
      {...props}
    />
  );
}

export interface SectionCardProps
  extends HTMLAttributes<HTMLElement>, SurfaceVariantProps {}

export function SectionCard({
  className,
  tone,
  padding = "responsive",
  elevation,
  ...props
}: SectionCardProps) {
  return (
    <section
      data-slot="section-card"
      className={cn(cardVariants({ tone, padding, elevation }), className)}
      {...props}
    />
  );
}

export { cardVariants };
