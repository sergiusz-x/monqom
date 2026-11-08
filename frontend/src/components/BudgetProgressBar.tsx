import { cn } from "@/lib/utils";
import type { BudgetProgressItem } from "@/types/budget";
import { formatCurrency } from "@/lib/money";
import { useTranslation } from "react-i18next";

import { translateSystemLabel } from "@/i18n/translate-system-label";
import { ChevronRight } from "lucide-react";
import { Card, ProgressBar } from "@monqom/ui";

export interface BudgetProgressBarProps {
  item: BudgetProgressItem;
  currency?: string;
  icon?: string | null;
  interactive?: boolean;
}

function getBarColorClass(percentage: number): string {
  if (percentage < 80) return "bg-green-500";
  if (percentage <= 100) return "bg-yellow-500";
  return "bg-red-500";
}

export function BudgetProgressBar({
  item,
  currency = "USD",
  icon,
  interactive = false,
}: BudgetProgressBarProps) {
  const { t } = useTranslation();
  const categoryName = translateSystemLabel(
    t,
    item.categorySystemKey,
    item.categoryName,
  );
  if (item.budgetAmount === null) {
    return (
      <Card>
        <div className="flex items-center justify-between">
          <span className="min-w-0 truncate font-medium">
            {icon && (
              <span aria-hidden="true" className="mr-2">
                {icon}
              </span>
            )}
            {categoryName}
          </span>
          <span className="font-semibold">
            {formatCurrency(item.spent, currency)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("budgets.noBudget")}
        </p>
      </Card>
    );
  }

  const percentage = item.percentage!;
  const isOverBudget = percentage > 100;
  const colorClass = getBarColorClass(percentage);

  return (
    <Card
      className={cn(
        "h-full transition-colors",
        interactive && "group-hover:bg-muted/30",
      )}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-xl"
          >
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-semibold">
          {categoryName}
        </span>
        {interactive && (
          <ChevronRight
            aria-hidden="true"
            size={18}
            className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
          />
        )}
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 text-muted-foreground">
          {t("budgets.spentOf", {
            spent: formatCurrency(item.spent, currency),
            limit: formatCurrency(item.budgetAmount, currency),
          })}
        </span>
        <span
          className={cn(
            "shrink-0 font-medium tabular-nums",
            isOverBudget ? "text-red-500" : "text-muted-foreground",
          )}
        >
          {Math.round(percentage)}%
        </span>
      </div>
      <ProgressBar
        className="mt-2"
        value={percentage}
        indicatorClassName={colorClass}
        ariaLabel={t("budgets.progress", { category: categoryName })}
      />
      <p
        className={cn(
          "mt-3 text-sm font-medium tabular-nums",
          isOverBudget ? "text-red-500" : "text-foreground",
        )}
      >
        {isOverBudget
          ? t("budgets.overBy", {
              amount: formatCurrency(Math.abs(item.remaining!), currency),
            })
          : t("budgets.remaining", {
              amount: formatCurrency(item.remaining!, currency),
            })}
      </p>
    </Card>
  );
}
