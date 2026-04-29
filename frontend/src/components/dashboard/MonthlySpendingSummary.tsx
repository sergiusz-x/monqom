import type { SpendingSummary } from "@/types/dashboard";

interface MonthlySpendingSummaryProps {
  summary: SpendingSummary;
  monthLabel: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatChange(summary: SpendingSummary): string {
  if (summary.change_percentage === null) {
    return "No previous month data";
  }

  if (summary.direction === "flat") {
    return "No change from previous month";
  }

  const directionLabel = summary.direction === "up" ? "up" : "down";
  return `${Math.abs(summary.change_percentage).toFixed(1)}% ${directionLabel} vs previous month`;
}

function getDirectionSymbol(direction: SpendingSummary["direction"]): string {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "→";
}

export function MonthlySpendingSummary({
  summary,
  monthLabel,
  onPreviousMonth,
  onNextMonth,
}: MonthlySpendingSummaryProps) {
  return (
    <section
      className="rounded-2xl border border-border bg-card p-6 shadow-sm"
      aria-label="Monthly spending summary"
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Total spending</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {formatCurrency(summary.current_total, summary.currency)}
          </h1>
        </div>
        <div className="flex items-center gap-2" aria-label="Month selector">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-sm hover:bg-muted"
            onClick={onPreviousMonth}
            aria-label="Previous month"
          >
            ←
          </button>
          <span className="min-w-28 text-center text-sm font-medium">
            {monthLabel}
          </span>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-sm hover:bg-muted"
            onClick={onNextMonth}
            aria-label="Next month"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Previous month
          </p>
          <p className="mt-1 text-lg font-medium">
            {formatCurrency(summary.previous_total, summary.currency)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Change
          </p>
          <p className="mt-1 text-lg font-medium">
            {getDirectionSymbol(summary.direction)}{" "}
            {formatCurrency(Math.abs(summary.change_amount), summary.currency)}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatChange(summary)}
          </p>
        </div>
      </div>
    </section>
  );
}
