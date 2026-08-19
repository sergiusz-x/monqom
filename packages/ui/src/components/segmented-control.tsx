import { cn } from "../lib/utils";

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
        className="inline-flex min-w-max gap-1 rounded-full bg-muted/70 p-1"
        role="tablist"
        aria-label={ariaLabel}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={value === option.value}
            className={cn(
              "min-h-9 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors max-sm:min-h-11",
              value === option.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
