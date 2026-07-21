import { createContext, useContext, useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { FieldError } from "@/components/ui/field-error";

interface FieldContextValue {
  controlId: string;
  describedBy?: string;
  invalid: boolean;
  required: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

interface FormFieldProps {
  children: ReactNode;
  label: ReactNode;
  id?: string;
  error?: string | null;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
}

export function FormField({
  children,
  label,
  id,
  error,
  hint,
  required = false,
  className,
}: FormFieldProps) {
  const generatedId = useId();
  const controlId = id ?? `field-${generatedId.replaceAll(":", "")}`;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={controlId}
        className={cn(
          "block text-sm font-medium",
          required && "after:ml-1 after:content-['*']",
        )}
      >
        {label}
      </label>
      <FieldContext.Provider
        value={{ controlId, describedBy, invalid: Boolean(error), required }}
      >
        {children}
      </FieldContext.Provider>
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      <FieldError id={errorId} message={error} className="text-sm" />
    </div>
  );
}

export function useFieldControlProps() {
  return useContext(FieldContext);
}
