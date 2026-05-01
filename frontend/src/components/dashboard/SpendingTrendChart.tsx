import { useState } from "react";
import type { SpendingTrendItem } from "@/types/dashboard";

interface SpendingTrendChartProps {
  trend: SpendingTrendItem[];
  currency: string;
  currentMonth: string;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatMonthLabel(month: string): string {
  const [yearPart, monthPart] = month.split("-");
  const date = new Date(Number(yearPart), Number(monthPart) - 1, 1);

  return date.toLocaleDateString("en-US", { month: "short" });
}

function formatFullMonthLabel(month: string): string {
  const [yearPart, monthPart] = month.split("-");
  const date = new Date(Number(yearPart), Number(monthPart) - 1, 1);

  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function SpendingTrendChart({
  trend,
  currency,
  currentMonth,
}: SpendingTrendChartProps) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const maxTotal = Math.max(...trend.map((item) => item.total), 0);
  const selectedItem =
    trend.find((item) => item.month === selectedMonth) ??
    trend.find((item) => item.month === currentMonth) ??
    trend.at(-1);

  return (
    <section
      className="rounded-2xl border border-border bg-card p-6 shadow-sm"
      aria-label="Spending trend"
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Spending trend</h2>
          <p className="text-sm text-muted-foreground">
            Monthly spending for the last 6 months
          </p>
        </div>
        {selectedItem ? (
          <p className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
            {formatFullMonthLabel(selectedItem.month)}:{" "}
            {formatCurrency(selectedItem.total, currency)}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-3">
        <div
          className="flex h-48 flex-col justify-between text-right text-xs text-muted-foreground"
          aria-hidden="true"
        >
          <span>{formatCurrency(maxTotal, currency)}</span>
          <span>{formatCurrency(maxTotal / 2, currency)}</span>
          <span>{formatCurrency(0, currency)}</span>
        </div>
        <div className="min-w-0">
          <div
            className="grid h-48 grid-cols-6 items-end gap-2 border-b border-l border-border px-2 sm:gap-4"
            role="list"
            aria-label="Monthly spending amounts"
          >
            {trend.map((item) => {
              const isCurrentMonth = item.month === currentMonth;
              const isSelected = item.month === selectedItem?.month;
              const heightPercent =
                maxTotal === 0 ? 0 : Math.max(4, (item.total / maxTotal) * 100);
              const label = `${formatFullMonthLabel(item.month)} spending ${formatCurrency(
                item.total,
                currency,
              )}`;

              return (
                <button
                  key={item.month}
                  type="button"
                  className="flex h-full min-w-0 items-end justify-center rounded-t-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={label}
                  aria-label={label}
                  aria-current={isCurrentMonth ? "date" : undefined}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedMonth(item.month)}
                >
                  <span
                    className={`w-full rounded-t-md transition-colors ${
                      isCurrentMonth
                        ? "bg-primary"
                        : isSelected
                          ? "bg-primary/80"
                          : "bg-muted-foreground/35 hover:bg-primary/60"
                    }`}
                    style={{ height: `${heightPercent}%` }}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-6 gap-2 px-2 text-center text-xs text-muted-foreground sm:gap-4">
            {trend.map((item) => (
              <span
                key={item.month}
                className={
                  item.month === currentMonth
                    ? "font-semibold text-foreground"
                    : ""
                }
              >
                {formatMonthLabel(item.month)}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>X-axis: month</span>
            <span>Y-axis: spending amount</span>
          </div>
        </div>
      </div>
    </section>
  );
}
