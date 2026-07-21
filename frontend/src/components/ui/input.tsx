import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useFieldControlProps } from "@/components/ui/form-field";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, id, required, ...props }, ref) {
  const field = useFieldControlProps();
  return (
    <input
      ref={ref}
      id={id ?? field?.controlId}
      required={required}
      aria-required={field?.required || required || undefined}
      aria-invalid={field?.invalid || undefined}
      aria-describedby={field?.describedBy}
      className={cn(
        "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
});
