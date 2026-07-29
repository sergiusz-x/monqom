import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SpendingTrendItem } from "@/types/dashboard";
import { formatMonth, formatShortMonth } from "@/lib/date-only";
import { formatCurrency } from "@/lib/money";
import { EmptyState, SectionCard } from "@monqom/ui";

export function SpendingTrendChart({
  trend,
  currency,
  currentMonth,
}: {
  trend: SpendingTrendItem[];
  currency: string;
  currentMonth: string;
}) {
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const hasSpending = trend.some((item) => item.total > 0);
  const maxAmount = Math.max(...trend.map((item) => item.total), 0);
  const selectedItem = trend.find(
    (item) => item.month === (selectedMonth ?? currentMonth),
  );

  return (
    <SectionCard padding="responsive" elevation="raised">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("dashboard.trend")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.trendDescription")}
          </p>
        </div>
        {selectedItem ? (
          <p className="w-fit rounded-full bg-muted px-3 py-1 text-sm font-medium tabular-nums">
            {formatMonth(selectedItem.month)}:{" "}
            {formatCurrency(selectedItem.total, currency)}
          </p>
        ) : null}
      </div>

      {hasSpending ? (
        <div
          className="space-y-3"
          role="list"
          aria-label={t("dashboard.monthlyAmounts")}
        >
          {trend.map((item) => {
            const isCurrent = item.month === currentMonth;
            const isSelected = item.month === selectedMonth;
            const width = maxAmount === 0 ? 0 : (item.total / maxAmount) * 100;

            return (
              <button
                key={item.month}
                type="button"
                className="group grid w-full items-center gap-3 text-left"
                style={{ gridTemplateColumns: "2.5rem minmax(0, 1fr) auto" }}
                aria-pressed={isSelected}
                aria-label={t("dashboard.spendingLabel", {
                  month: formatMonth(item.month),
                  amount: formatCurrency(item.total, currency),
                })}
                onClick={() => setSelectedMonth(item.month)}
              >
                <span
                  className={
                    isCurrent
                      ? "text-sm font-semibold text-foreground"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {formatShortMonth(item.month)}
                </span>
                <span
                  className="overflow-hidden rounded-md bg-muted/70"
                  style={{ display: "block", height: "2rem" }}
                >
                  <span
                    className={
                      "block h-full rounded-md transition-[width,opacity] duration-200 " +
                      (isSelected || isCurrent
                        ? ""
                        : "opacity-75 group-hover:opacity-100")
                    }
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${width}%`,
                      backgroundColor: isSelected
                        ? "var(--chart-2)"
                        : isCurrent
                          ? "var(--chart-1)"
                          : "var(--chart-3)",
                    }}
                  />
                </span>
                <span className="text-right text-sm font-medium tabular-nums text-foreground">
                  {formatCurrency(item.total, currency)}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={t("dashboard.noTrend")}
          description={t("dashboard.noTrendDescription")}
          className="min-h-64"
        />
      )}
    </SectionCard>
  );
}
