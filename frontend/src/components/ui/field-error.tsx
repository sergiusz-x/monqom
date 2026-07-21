import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FieldErrorProps extends HTMLAttributes<HTMLParagraphElement> {
  message?: string | null;
}

export function FieldError({ message, className, ...props }: FieldErrorProps) {
  if (!message) return null;

  return (
    <p
      className={cn("text-xs text-destructive", className)}
      role="alert"
      {...props}
    >
      {message}
    </p>
  );
}
