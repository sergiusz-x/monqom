import { useBudgetProgress } from "@/hooks/useBudgetProgress";

import { useTranslation } from "react-i18next";
import { BudgetProgressBar } from "./BudgetProgressBar";
import { AsyncState, EmptyState } from "@monqom/ui";

export interface BudgetProgressListProps {
  workspaceId: string;
  month: string;
}

export function BudgetProgressList({
  workspaceId,
  month,
}: BudgetProgressListProps) {
  const { t } = useTranslation();
  const { items, isLoading, error, retry } = useBudgetProgress(
    workspaceId,
    month,
  );

  if (isLoading) {
    return (
      <AsyncState status="loading" message={t("budgets.loadingProgress")} />
    );
  }

  if (error) {
    return (
      <AsyncState status="error" message={error} onRetry={() => void retry()} />
    );
  }

  if (items.length === 0) {
    return <EmptyState title={t("budgets.noActivity")} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <BudgetProgressBar key={item.categoryId} item={item} />
      ))}
    </div>
  );
}
