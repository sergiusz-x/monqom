import { cn } from "@/lib/utils";
import type { BudgetProgressItem } from "@/types/budget";
import { formatCurrency } from "@/lib/money";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { translateSystemLabel } from "@/i18n/translate-system-label";

export interface BudgetProgressBarProps {
  item: BudgetProgressItem;
  currency?: string;
}

function getBarColorClass(percentage: number): string {
  if (percentage < 75) return "bg-green-500";
  if (percentage < 90) return "bg-yellow-500";
  return "bg-red-500";
}

export function BudgetProgressBar({
  item,
  currency = "USD",
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
          <span className="font-medium">{categoryName}</span>
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
  const barWidth = Math.min(percentage, 100);
  const colorClass = getBarColorClass(percentage);

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">{categoryName}</span>
        <span
          className={cn(
            "text-sm font-semibold",
            isOverBudget ? "text-red-500" : "text-foreground",
          )}
        >
          {percentage.toFixed(1)}%
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-2 rounded-full transition-all", colorClass)}
          style={{ width: `${barWidth}%` }}
          role="progressbar"
          aria-valuenow={barWidth}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("budgets.progress", { category: categoryName })}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {t("budgets.spentOf", {
            spent: formatCurrency(item.spent, currency),
            limit: formatCurrency(item.budgetAmount, currency),
          })}
        </span>
        {isOverBudget ? (
          <span className="font-medium text-red-500">
            {t("budgets.overBy", {
              amount: formatCurrency(Math.abs(item.remaining!), currency),
            })}
          </span>
        ) : (
          <span>
            {t("budgets.remaining", {
              amount: formatCurrency(item.remaining!, currency),
            })}
          </span>
        )}
      </div>
    </Card>
  );
}
