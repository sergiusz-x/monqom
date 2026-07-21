import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCategories } from "@/hooks/useCategories";
import { useDashboardData } from "@/hooks/useDashboardData";
import { MonthlySpendingSummary } from "@/components/dashboard/MonthlySpendingSummary";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { SpendingByCategoryChart } from "@/components/dashboard/SpendingByCategoryChart";
import { SpendingTrendChart } from "@/components/dashboard/SpendingTrendChart";
import { useTranslation } from "react-i18next";
import { WorkspaceErrorState } from "@/components/WorkspaceErrorState";
import { RetryAlert } from "@/components/ui/retry-alert";
import { PageContainer, PageHeader } from "@/components/layout/PageLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { invalidateFinancialData } from "@/lib/query-invalidation";
import { formatMonth, getMonthInTimeZone, shiftMonth } from "@/lib/date-only";

function LoadingSkeleton() {
  const { t } = useTranslation();
  return (
    <div
      className="space-y-4"
      role="status"
      aria-label={t("dashboard.loading")}
    >
      <Skeleton className="h-48 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    workspaceId,
    workspace,
    isLoading: workspaceLoading,
    error: workspaceError,
    refetch: retryWorkspace,
  } = useWorkspace();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const currentMonth = getMonthInTimeZone(
    new Date(),
    workspace?.timezone ?? "UTC",
  );
  const month = selectedMonth ?? currentMonth;
  const { categories } = useCategories(workspaceId ?? "");
  const {
    summary,
    categoryBreakdown,
    spendingTrend,
    transactions,
    isLoading,
    error,
    retry,
  } = useDashboardData(workspaceId ?? "", month);

  const selectedMonthLabel = useMemo(() => formatMonth(month), [month]);

  if (workspaceLoading) {
    return (
      <PageContainer>
        <PageHeader title={t("dashboard.title")} visuallyHidden />
        <LoadingSkeleton />
      </PageContainer>
    );
  }

  if (workspaceError || !workspaceId) {
    return (
      <PageContainer>
        <PageHeader title={t("dashboard.title")} visuallyHidden />
        <WorkspaceErrorState
          message={workspaceError ?? t("common.noWorkspace")}
          onRetry={workspaceError ? () => void retryWorkspace() : undefined}
        />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <PageHeader title={t("dashboard.title")} visuallyHidden />
        <RetryAlert message={error} onRetry={() => void retry()} />
      </PageContainer>
    );
  }

  if (isLoading || !summary || !categoryBreakdown) {
    return (
      <PageContainer>
        <PageHeader title={t("dashboard.title")} visuallyHidden />
        <LoadingSkeleton />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader title={t("dashboard.title")} visuallyHidden />
      <MonthlySpendingSummary
        summary={summary}
        monthLabel={selectedMonthLabel}
        onPreviousMonth={() => setSelectedMonth(shiftMonth(month, -1))}
        onNextMonth={() => setSelectedMonth(shiftMonth(month, 1))}
      />
      <SpendingTrendChart
        trend={spendingTrend}
        currency={summary.currency}
        currentMonth={currentMonth}
      />
      <SpendingByCategoryChart breakdown={categoryBreakdown} month={month} />
      <RecentTransactions
        transactions={transactions}
        categories={categories}
        workspaceId={workspaceId}
        onTransactionSaved={() => {
          void invalidateFinancialData(queryClient, workspaceId);
        }}
      />
    </PageContainer>
  );
}
