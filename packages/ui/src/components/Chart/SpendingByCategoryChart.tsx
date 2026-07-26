import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import type { CategoryBreakdown } from "@/types/dashboard";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import { formatCurrency } from "@/lib/money";
import { EmptyState } from "../empty-state";
import { SectionCard } from "../card";

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

function monthDateRange(month: string): { dateFrom: string; dateTo: string } {
  const [yearPart, monthPart] = month.split("-");
  const lastDay = new Date(Number(yearPart), Number(monthPart), 0).getDate();
  return { dateFrom: `${month}-01`, dateTo: `${month}-${String(lastDay).padStart(2, "0")}` };
}

function colorForCategory(categoryId: string, color: string | null): string {
  if (color) return color;
  const hash = [...categoryId].reduce(
    (total, character, index) => (total + character.charCodeAt(0) * (index + 1)) % 997,
    0,
  );
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

export function SpendingByCategoryChart({
  breakdown,
  month,
}: {
  breakdown: CategoryBreakdown;
  month: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dateFrom, dateTo } = monthDateRange(month);
  const categories = [...breakdown.categories]
    .sort((a, b) => b.amount - a.amount || a.categoryName.localeCompare(b.categoryName))
    .map((category) => ({
      ...category,
      name: translateSystemLabel(t, category.categorySystemKey, category.categoryName),
    }));
  const hasSpending = categories.length > 0 && breakdown.totalSpending > 0;

  return (
    <SectionCard padding="responsive" elevation="raised">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("dashboard.byCategory")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.categoryDescription")}
          </p>
        </div>
        <p className="w-fit rounded-full bg-muted px-3 py-1 text-sm font-medium tabular-nums">
          {t("dashboard.total", { amount: formatCurrency(breakdown.totalSpending, breakdown.currency) })}
        </p>
      </div>

      {hasSpending ? (
        <div
          className="w-full"
          style={{ height: Math.max(240, categories.length * 44 + 32) }}
          role="img"
          aria-label={t("dashboard.byCategory")}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={categories}
              layout="vertical"
              margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={112}
                tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "0.5rem",
                  color: "var(--popover-foreground)",
                }}
                formatter={(
                  value: number | string | readonly (number | string)[] | undefined,
                ) =>
                  formatCurrency(
                    Number(Array.isArray(value) ? value[0] : (value ?? 0)),
                    breakdown.currency,
                  )
                }
              />
              <Bar
                dataKey="amount"
                name={t("dashboard.total", { amount: "" }).trim()}
                radius={[0, 6, 6, 0]}
                maxBarSize={24}
              >
                {categories.map((category) => (
                  <Cell
                    key={category.categoryId}
                    cursor="pointer"
                    fill={colorForCategory(category.categoryId, category.categoryColor)}
                    onClick={() =>
                      navigate(
                        `/transactions?category_id=${category.categoryId}&date_from=${dateFrom}&date_to=${dateTo}`,
                      )
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState
          title={t("dashboard.noCategory")}
          description={t("dashboard.noCategoryDescription")}
          className="min-h-64"
        />
      )}
    </SectionCard>
  );
}
