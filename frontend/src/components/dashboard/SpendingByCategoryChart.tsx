import { Link } from "react-router-dom";
import type { CategoryBreakdown } from "@/types/dashboard";
import { formatCurrency } from "@/lib/money";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionCard } from "@/components/ui/card";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import { cn } from "@/lib/utils";

interface SpendingByCategoryChartProps {
  breakdown: CategoryBreakdown;
  month: string;
}

const FALLBACK_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];
const CATEGORY_PATTERNS = [
  "chart-pattern-1",
  "chart-pattern-2",
  "chart-pattern-3",
  "chart-pattern-4",
] as const;

function formatPercentage(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function colorForCategory(categoryId: string, color: string | null): string {
  if (color) return color;

  let hash = 0;
  for (let index = 0; index < categoryId.length; index += 1) {
    hash = (hash + categoryId.charCodeAt(index) * (index + 1)) % 997;
  }

  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

function monthDateRange(month: string): { dateFrom: string; dateTo: string } {
  const [yearPart, monthPart] = month.split("-");
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();

  return {
    dateFrom: `${month}-01`,
    dateTo: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function transactionFilterHref(categoryId: string, month: string): string {
  const { dateFrom, dateTo } = monthDateRange(month);
  const params = new URLSearchParams({
    category_id: categoryId,
    date_from: dateFrom,
    date_to: dateTo,
  });

  return `/transactions?${params.toString()}`;
}

export function SpendingByCategoryChart({
  breakdown,
  month,
}: SpendingByCategoryChartProps) {
  const { t } = useTranslation();
  const categoryLabel = (name: string, systemKey?: string | null) =>
    translateSystemLabel(t, systemKey, name);
  const categories = [...breakdown.categories].sort((left, right) => {
    if (right.amount !== left.amount) return right.amount - left.amount;
    return left.categoryName.localeCompare(right.categoryName);
  });

  return (
    <SectionCard
      padding="spacious"
      elevation="raised"
      aria-label={t("dashboard.byCategory")}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("dashboard.byCategory")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.total", {
              amount: formatCurrency(
                breakdown.totalSpending,
                breakdown.currency,
              ),
            })}
          </p>
        </div>
      </div>

      {categories.length === 0 ? (
        <EmptyState
          title={t("dashboard.noCategory")}
          description={t("dashboard.noCategoryDescription")}
          className="min-h-40"
        />
      ) : (
        <ul className="space-y-3">
          {categories.map((category, index) => {
            const color = colorForCategory(
              category.categoryId,
              category.categoryColor,
            );
            const percentage = Math.max(0, Math.min(100, category.percentage));
            const label = categoryLabel(
              category.categoryName,
              category.categorySystemKey,
            );
            const pattern = CATEGORY_PATTERNS[index % CATEGORY_PATTERNS.length];

            return (
              <li key={category.categoryId}>
                <Link
                  to={transactionFilterHref(category.categoryId, month)}
                  className="block rounded-lg border border-transparent p-2 hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("dashboard.categoryBreakdownLabel", {
                    category: label,
                    amount: formatCurrency(category.amount, breakdown.currency),
                    percentage: formatPercentage(category.percentage),
                  })}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "h-3 w-3 shrink-0 border border-foreground/30",
                          index % 2 === 0 ? "rounded-full" : "rounded-sm",
                          pattern,
                        )}
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm font-medium">
                        {label}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold">
                        {formatCurrency(category.amount, breakdown.currency)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatPercentage(category.percentage)}
                      </p>
                    </div>
                  </div>
                  <div
                    className="h-2 rounded-full bg-muted"
                    role="img"
                    aria-label={t("dashboard.spendingShare", {
                      category: label,
                      percentage: formatPercentage(category.percentage),
                    })}
                  >
                    <div
                      data-pattern={pattern}
                      className={cn(
                        "h-2 rounded-full border border-foreground/20",
                        pattern,
                      )}
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
