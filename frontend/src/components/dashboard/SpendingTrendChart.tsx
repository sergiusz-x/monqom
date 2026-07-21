import { useState } from "react";
import type { SpendingTrendItem } from "@/types/dashboard";
import { formatCurrency } from "@/lib/money";
import { formatMonth, formatShortMonth } from "@/lib/date-only";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SpendingTrendChartProps {
  trend: SpendingTrendItem[];
  currency: string;
  currentMonth: string;
}

export function SpendingTrendChart({
  trend,
  currency,
  currentMonth,
}: SpendingTrendChartProps) {
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const maxTotal = Math.max(...trend.map((item) => item.total), 0);
  const selectedItem =
    trend.find((item) => item.month === selectedMonth) ??
    trend.find((item) => item.month === currentMonth) ??
    trend.at(-1);

  return (
    <SectionCard
      padding="spacious"
      elevation="raised"
      aria-label={t("dashboard.trend")}
    >
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("dashboard.trend")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.trendDescription")}
          </p>
        </div>
        {selectedItem ? (
          <p className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
            {formatMonth(selectedItem.month)}:{" "}
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
            aria-label={t("dashboard.monthlyAmounts")}
          >
            {trend.map((item) => {
              const isCurrentMonth = item.month === currentMonth;
              const isSelected = item.month === selectedItem?.month;
              const heightPercent =
                maxTotal === 0 ? 0 : Math.max(4, (item.total / maxTotal) * 100);
              const label = t("dashboard.spendingLabel", {
                month: formatMonth(item.month),
                amount: formatCurrency(item.total, currency),
              });

              return (
                <Button
                  key={item.month}
                  type="button"
                  variant="ghost"
                  className={cn(
                    "h-full min-h-0 min-w-0 items-end rounded-t-md p-0 hover:bg-transparent",
                    isCurrentMonth && "ring-2 ring-foreground ring-inset",
                    isSelected &&
                      !isCurrentMonth &&
                      "outline-2 outline-offset-2 outline-dashed outline-foreground",
                  )}
                  title={label}
                  aria-label={label}
                  aria-current={isCurrentMonth ? "date" : undefined}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedMonth(item.month)}
                >
                  <span
                    data-testid={`spending-bar-${item.month}`}
                    className={cn(
                      "w-full rounded-t-md border border-foreground/20 transition-colors",
                      isCurrentMonth
                        ? "bg-chart-1 chart-pattern-1"
                        : isSelected
                          ? "bg-chart-2 chart-pattern-2"
                          : "bg-chart-3/70 hover:bg-chart-3",
                    )}
                    style={{ height: `${heightPercent}%` }}
                    aria-hidden="true"
                  />
                </Button>
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
                {item.month === currentMonth ? (
                  <span aria-hidden="true">● </span>
                ) : null}
                {formatShortMonth(item.month)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
