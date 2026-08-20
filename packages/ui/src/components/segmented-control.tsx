import { cn } from "../lib/utils";
import { Button } from "./button";

export interface SegmentedControlOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: readonly SegmentedControlOption<T>[];
  ariaLabel: string;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  ariaLabel,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn("max-w-full overflow-x-auto", className)}>
      <div
        className="inline-flex min-w-max rounded-lg border border-border bg-muted/30 p-0.5"
        role="tablist"
        aria-label={ariaLabel}
      >
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={value === option.value ? "default" : "ghost"}
            role="tab"
            aria-selected={value === option.value}
            className="h-7 px-3 text-xs"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
