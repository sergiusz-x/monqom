import { useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useCategories";
import { useDashboardData } from "@/hooks/useDashboardData";
import { MonthlySpendingSummary } from "@/components/dashboard/MonthlySpendingSummary";
import { FinancialTrend } from "@/components/dashboard/FinancialTrend";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { SpendingByCategoryChart } from "@/components/dashboard/SpendingByCategoryChart";
import { useBudgetOverview } from "@/hooks/useBudgetOverview";
import { Link } from "react-router";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import { useTranslation } from "react-i18next";
import { WorkspaceErrorState } from "@/components/WorkspaceErrorState";

import { PageContainer, PageHeader } from "@/components/layout/PageLayout";

import { getMonthInTimeZone, shiftMonth } from "@/lib/date-only";
import { RetryAlert, Skeleton } from "@monqom/ui";

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
  const {
    workspaceId,
    workspace,
    isLoading: workspaceLoading,
    error: workspaceError,
    refetch: retryWorkspace,
  } = useWorkspace();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const user = useOptionalAuth()?.user;
  const privacyKey = `${user?.id ?? "anonymous"}:${user?.hideSalaryAmounts ? user.updatedAt : "disabled"}:${workspaceId ?? ""}`;
  const [trendPrivacy, setTrendPrivacy] = useState({
    key: privacyKey,
    revealed: false,
  });
  if (trendPrivacy.key !== privacyKey)
    setTrendPrivacy({ key: privacyKey, revealed: false });
  const [trendRange, setTrendRange] = useState<6 | 12>(6);
  const categoryCardRef = useRef<HTMLDivElement>(null);
  const [categoryHeight, setCategoryHeight] = useState(0);
  const currentMonth = getMonthInTimeZone(
    new Date(),
    workspace?.timezone ?? "UTC",
  );
  const month = selectedMonth ?? currentMonth;
  const { categories: expenseCategories } = useCategories(
    workspaceId ?? "",
    true,
    "expense",
  );
  const { categories: incomeCategories } = useCategories(
    workspaceId ?? "",
    true,
    "income",
  );
  const categories = useMemo(
    () => [...expenseCategories, ...incomeCategories],
    [expenseCategories, incomeCategories],
  );
  const {
    summary,
    spendingPace,
    categoryBreakdown,
    transactions,
    financialTrend,
    isLoading,
    error,
    retry,
  } = useDashboardData(workspaceId ?? "", month);

  const {
    progressItems,
    error: budgetError,
    retry: retryBudgets,
  } = useBudgetOverview(workspaceId ?? "", month);
  useEffect(() => {
    const card = categoryCardRef.current;
    if (!card || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCategoryHeight(entry.contentRect.height);
    });
    observer.observe(card);
    return () => observer.disconnect();
  }, [workspaceLoading, workspaceError, workspaceId, isLoading, error]);
  const exceededBudgets = progressItems.filter(
    (item) => item.limit !== null && item.spent > item.limit,
  );
  const nearLimitBudgets = progressItems.filter(
    (item) =>
      item.percentage !== null &&
      item.percentage >= 80 &&
      item.percentage <= 100,
  );

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
      <MonthlySpendingSummary
        key={month}
        summary={summary}
        spendingPace={spendingPace}
        month={month}
        currentMonth={currentMonth}
        onSelectMonth={setSelectedMonth}
        onPreviousMonth={() => setSelectedMonth(shiftMonth(month, -1))}
        onNextMonth={() => setSelectedMonth(shiftMonth(month, 1))}
      />
      <FinancialTrend
        trend={financialTrend ?? []}
        currency={summary.currency}
        selectedMonth={month}
        currentMonth={currentMonth}
        revealed={trendPrivacy.key === privacyKey && trendPrivacy.revealed}
        onReveal={() => setTrendPrivacy({ key: privacyKey, revealed: true })}
        onSelectMonth={setSelectedMonth}
        range={trendRange}
        onRangeChange={setTrendRange}
      />
      {!budgetError &&
      exceededBudgets.length === 0 &&
      nearLimitBudgets.length > 0 ? (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm">
          <p className="font-medium">
            {t("dashboard.nearLimitBudgets", {
              count: nearLimitBudgets.length,
            })}
          </p>
          <p className="mt-1 text-muted-foreground">
            {nearLimitBudgets
              .map((item) =>
                translateSystemLabel(
                  t,
                  item.categorySystemKey,
                  item.categoryName,
                ),
              )
              .join(", ")}
          </p>
          {month === currentMonth && (
            <Link
              to="/budgets"
              className="mt-2 inline-block font-medium text-primary hover:underline"
            >
              {t("dashboard.viewBudgets")}
            </Link>
          )}
        </div>
      ) : null}
      {budgetError ? (
        <RetryAlert message={budgetError} onRetry={() => void retryBudgets()} />
      ) : exceededBudgets.length > 0 ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium">
            {t("dashboard.exceededBudgets", { count: exceededBudgets.length })}
          </p>
          <p className="mt-1 text-muted-foreground">
            {exceededBudgets
              .map((item) =>
                translateSystemLabel(
                  t,
                  item.categorySystemKey,
                  item.categoryName,
                ),
              )
              .join(", ")}
          </p>
          {month === currentMonth && (
            <Link
              to="/budgets"
              className="mt-2 inline-block font-medium text-primary hover:underline"
            >
              {t("dashboard.viewBudgets")}
            </Link>
          )}
        </div>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div ref={categoryCardRef}>
          <SpendingByCategoryChart
            breakdown={categoryBreakdown}
            month={month}
            categories={expenseCategories}
          />
        </div>
        <RecentTransactions
          workspaceId={workspaceId}
          transactions={transactions}
          categories={categories}
          categoryHeight={categoryHeight}
        />
      </div>
    </PageContainer>
  );
}
