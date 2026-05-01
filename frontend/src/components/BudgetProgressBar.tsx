import { cn } from "@/lib/utils";
import type { BudgetProgressItem } from "@/types/budget";

export interface BudgetProgressBarProps {
  item: BudgetProgressItem;
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getBarColorClass(percentage: number): string {
  if (percentage < 75) return "bg-green-500";
  if (percentage < 90) return "bg-yellow-500";
  return "bg-red-500";
}

export function BudgetProgressBar({ item }: BudgetProgressBarProps) {
  if (item.budget_amount === null) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">{item.category_name}</span>
          <span className="font-semibold">{formatAmount(item.spent)}</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">No budget set</p>
      </div>
    );
  }

  const percentage = item.percentage!;
  const isOverBudget = percentage > 100;
  const barWidth = Math.min(percentage, 100);
  const colorClass = getBarColorClass(percentage);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">{item.category_name}</span>
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
          aria-label={`${item.category_name} budget progress`}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Spent: {formatAmount(item.spent)} of{" "}
          {formatAmount(item.budget_amount)}
        </span>
        {isOverBudget ? (
          <span className="font-medium text-red-500">
            Over by {formatAmount(Math.abs(item.remaining!))}
          </span>
        ) : (
          <span>Remaining: {formatAmount(item.remaining!)}</span>
        )}
      </div>
    </div>
  );
}
