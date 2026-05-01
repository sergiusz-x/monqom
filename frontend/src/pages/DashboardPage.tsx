import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCategories } from "@/hooks/useCategories";
import { useDashboardData } from "@/hooks/useDashboardData";
import { MonthlySpendingSummary } from "@/components/dashboard/MonthlySpendingSummary";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { SpendingByCategoryChart } from "@/components/dashboard/SpendingByCategoryChart";
import { SpendingTrendChart } from "@/components/dashboard/SpendingTrendChart";
import { TRANSACTION_SAVED_EVENT } from "@/lib/transaction-refresh";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shiftMonth(value: string, delta: number): string {
  const [yearPart, monthPart] = value.split("-");
  const date = new Date(Number(yearPart), Number(monthPart) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string): string {
  const [yearPart, monthPart] = value.split("-");
  const date = new Date(Number(yearPart), Number(monthPart) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Loading dashboard">
      <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      <div className="h-64 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}

export default function DashboardPage() {
  const {
    workspaceId,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace();
  const [month, setMonth] = useState(getCurrentMonth);
  const [refreshKey, setRefreshKey] = useState(0);
  const { categories } = useCategories(workspaceId ?? "");
  const {
    summary,
    categoryBreakdown,
    spendingTrend,
    transactions,
    isLoading,
    error,
  } = useDashboardData(workspaceId ?? "", month, refreshKey);

  const selectedMonthLabel = useMemo(() => monthLabel(month), [month]);

  useEffect(() => {
    function handleTransactionSaved() {
      setRefreshKey((value) => value + 1);
    }

    window.addEventListener(TRANSACTION_SAVED_EVENT, handleTransactionSaved);
    return () =>
      window.removeEventListener(
        TRANSACTION_SAVED_EVENT,
        handleTransactionSaved,
      );
  }, []);

  if (workspaceLoading) {
    return (
      <div className="p-6">
        <h1 className="sr-only">Dashboard</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  if (workspaceError || !workspaceId) {
    return (
      <div className="p-6">
        <h1 className="sr-only">Dashboard</h1>
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
          role="alert"
        >
          {workspaceError ?? "No workspace found."}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="sr-only">Dashboard</h1>
        <div
          className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
          role="alert"
        >
          {error}
        </div>
      </div>
    );
  }

  if (isLoading || !summary || !categoryBreakdown) {
    return (
      <div className="p-6">
        <h1 className="sr-only">Dashboard</h1>
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <h1 className="sr-only">Dashboard</h1>
        <MonthlySpendingSummary
          summary={summary}
          monthLabel={selectedMonthLabel}
          onPreviousMonth={() => setMonth((value) => shiftMonth(value, -1))}
          onNextMonth={() => setMonth((value) => shiftMonth(value, 1))}
        />
        <SpendingTrendChart
          trend={spendingTrend}
          currency={summary.currency}
          currentMonth={getCurrentMonth()}
        />
        <SpendingByCategoryChart breakdown={categoryBreakdown} month={month} />
        <RecentTransactions
          transactions={transactions}
          categories={categories}
          workspaceId={workspaceId}
          onTransactionSaved={() => setRefreshKey((value) => value + 1)}
        />
      </div>
    </div>
  );
}
