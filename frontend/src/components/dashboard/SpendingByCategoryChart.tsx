import { Link } from "react-router-dom";
import type { CategoryBreakdown } from "@/types/dashboard";

interface SpendingByCategoryChartProps {
  breakdown: CategoryBreakdown;
  month: string;
}

const FALLBACK_COLORS = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#9333ea",
  "#dc2626",
  "#0891b2",
  "#ca8a04",
  "#db2777",
];

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

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
  const categories = [...breakdown.categories].sort((left, right) => {
    if (right.amount !== left.amount) return right.amount - left.amount;
    return left.category_name.localeCompare(right.category_name);
  });

  return (
    <section
      className="rounded-2xl border border-border bg-card p-6 shadow-sm"
      aria-label="Spending by category"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Spending by category</h2>
          <p className="text-sm text-muted-foreground">
            {formatCurrency(breakdown.total_spending, breakdown.currency)} total
          </p>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="mb-2 font-medium">No category spending yet</p>
          <p className="text-sm text-muted-foreground">
            Add expenses for this month to see your category breakdown.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {categories.map((category) => {
            const color = colorForCategory(
              category.category_id,
              category.category_color,
            );
            const percentage = Math.max(0, Math.min(100, category.percentage));

            return (
              <li key={category.category_id}>
                <Link
                  to={transactionFilterHref(category.category_id, month)}
                  className="block rounded-lg border border-transparent p-2 hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${category.category_name}: ${formatCurrency(
                    category.amount,
                    breakdown.currency,
                  )}, ${formatPercentage(category.percentage)}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm font-medium">
                        {category.category_name}
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
                    aria-label={`${category.category_name} spending share ${formatPercentage(
                      category.percentage,
                    )}`}
                  >
                    <div
                      className="h-2 rounded-full"
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
    </section>
  );
}
