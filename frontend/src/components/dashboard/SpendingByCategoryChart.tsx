import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { EmptyState, SectionCard } from "@monqom/ui";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import { getMonthDateRange } from "@/lib/date-only";
import { formatCurrency } from "@/lib/money";
import type { Category } from "@/types/category";
import type { CategoryBreakdown } from "@/types/dashboard";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

export function SpendingByCategoryChart({
  breakdown,
  month,
  categories,
}: {
  breakdown: CategoryBreakdown;
  month: string;
  categories: Category[];
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<
    string | null | undefined
  >(undefined);
  const { dateFrom, dateTo } = getMonthDateRange(month);
  const groups = useMemo(() => {
    const roots = new Map<string, Category>();
    const visit = (category: Category, root: Category) => {
      roots.set(category.id, root);
      category.children.forEach((child) => visit(child, root));
    };
    categories.forEach((category) => visit(category, category));
    const grouped = new Map<
      string | null,
      { id: string | null; name: string; icon: string | null; amount: number }
    >();
    for (const item of breakdown.categories) {
      const root = item.categoryId ? roots.get(item.categoryId) : undefined;
      const id = root?.id ?? item.categoryId;
      const group = grouped.get(id);
      if (group) group.amount += item.amount;
      else
        grouped.set(id, {
          id,
          name: root
            ? translateSystemLabel(t, root.systemKey, root.name)
            : translateSystemLabel(
                t,
                item.categorySystemKey,
                id === null ? t("dashboard.uncategorized") : item.categoryName,
              ),
          icon: root?.icon ?? null,
          amount: item.amount,
        });
    }
    return [...grouped.values()].sort(
      (a, b) => b.amount - a.amount || a.name.localeCompare(b.name),
    );
  }, [breakdown.categories, categories, t]);
  const slices = groups.map((group, index) => {
    const start =
      (groups.slice(0, index).reduce((sum, item) => sum + item.amount, 0) /
        breakdown.totalSpending) *
      100;
    const share = (group.amount / breakdown.totalSpending) * 100;
    const query = new URLSearchParams({
      ...(group.id === null
        ? { category_status: "uncategorized" }
        : { category_id: group.id }),
      date_from: dateFrom,
      date_to: dateTo,
      type: "expense",
    });
    return {
      ...group,
      start,
      share,
      color: CHART_COLORS[index % CHART_COLORS.length],
      href: `/transactions?${query}`,
    };
  });
  return (
    <SectionCard padding="responsive" elevation="raised" className="min-w-0">
      <h2 className="text-lg font-semibold">{t("dashboard.byCategory")}</h2>
      {groups.length && breakdown.totalSpending > 0 ? (
        <div>
          <div className="relative mx-auto mt-5 flex h-44 w-44 items-center justify-center">
            <svg
              viewBox="0 0 100 100"
              className="absolute inset-0 h-full w-full -rotate-90"
              aria-hidden="true"
              onMouseLeave={() => setActiveCategory(undefined)}
            >
              {slices.map((slice) => (
                <circle
                  key={slice.id ?? "uncategorized"}
                  cx="50"
                  cy="50"
                  r="40"
                  pathLength="100"
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={activeCategory === slice.id ? 18 : 16}
                  strokeDasharray={`${slice.share} ${100 - slice.share}`}
                  strokeDashoffset={-slice.start}
                  className="cursor-pointer transition-opacity"
                  opacity={
                    activeCategory !== undefined && activeCategory !== slice.id
                      ? 0.3
                      : 1
                  }
                  onMouseEnter={() => setActiveCategory(slice.id)}
                  onClick={() => navigate(slice.href)}
                />
              ))}
            </svg>
            <div className="pointer-events-none flex h-32 w-32 flex-col items-center justify-center px-2 text-center">
              <span className="text-xs text-muted-foreground">
                {t("dashboard.totalSpending")}
              </span>
              <span className="mt-1 text-sm font-semibold tabular-nums">
                {formatCurrency(breakdown.totalSpending, breakdown.currency)}
              </span>
            </div>
          </div>
          <ul className="mt-4 divide-y divide-border">
            {slices.map((group, index) => {
              const percentage = Math.max(
                0,
                Math.min(100, (group.amount / breakdown.totalSpending) * 100),
              );
              return (
                <li key={group.id ?? "uncategorized"}>
                  <Link
                    to={group.href}
                    onMouseEnter={() => setActiveCategory(group.id)}
                    onMouseLeave={() => setActiveCategory(undefined)}
                    onFocus={() => setActiveCategory(group.id)}
                    onBlur={() => setActiveCategory(undefined)}
                    className={`-mx-2 block rounded-md px-2 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeCategory === group.id ? "bg-muted/60" : "hover:bg-muted/50"}`}
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 break-words font-medium">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                        {group.icon && (
                          <span aria-hidden="true" className="mr-2">
                            {group.icon}
                          </span>
                        )}
                        {group.name}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatCurrency(group.amount, breakdown.currency)}
                      </span>
                    </div>
                    <span className="ml-[18px] text-xs tabular-nums text-muted-foreground">
                      {Math.round(percentage)}%
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <EmptyState
          title={t("dashboard.noCategory")}
          description={t("dashboard.noCategoryDescription")}
        />
      )}
    </SectionCard>
  );
}
