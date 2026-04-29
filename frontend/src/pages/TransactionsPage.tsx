import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useCategories } from "@/hooks/useCategories";
import { usePaymentSources } from "@/hooks/usePaymentSources";
import { useTags } from "@/hooks/useTags";
import { useTransactions } from "@/hooks/useTransactions";
import { TransactionFilterBar } from "@/components/transactions/TransactionFilterBar";
import { TransactionTable } from "@/components/transactions/TransactionTable";
import { TransactionCards } from "@/components/transactions/TransactionCards";
import { TransactionEmptyState } from "@/components/transactions/TransactionEmptyState";
import { TransactionListSkeleton } from "@/components/transactions/TransactionListSkeleton";
import { TransactionPagination } from "@/components/transactions/TransactionPagination";
import type { TransactionFilters } from "@/types/transaction";

const PAGE_SIZE = 20;
const defaultFilters: TransactionFilters = {
  categoryId: "",
  tag: "",
  paymentSourceId: "",
  dateFrom: "",
  dateTo: "",
};

function buildCategoryMap(
  categories: Array<{
    id: string;
    name: string;
    children: Array<{ id: string; name: string }>;
  }>,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const category of categories) {
    map[category.id] = category.name;
    for (const child of category.children) {
      map[child.id] = `${category.name} / ${child.name}`;
    }
  }
  return map;
}

export default function TransactionsPage() {
  const navigate = useNavigate();
  const {
    workspaceId,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace();
  const [filters, setFilters] = useState(defaultFilters);
  const [offset, setOffset] = useState(0);
  const hasInvalidDateRange = Boolean(
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo,
  );
  const requestWorkspaceId = hasInvalidDateRange ? "" : (workspaceId ?? "");

  const { categories } = useCategories(workspaceId ?? "");
  const { paymentSources } = usePaymentSources(workspaceId ?? "");
  const { tags } = useTags(workspaceId ?? "");
  const { data, isLoading, error } = useTransactions(
    requestWorkspaceId,
    filters,
    PAGE_SIZE,
    offset,
  );

  const categoryMap = useMemo(() => buildCategoryMap(categories), [categories]);
  const paymentSourceMap = useMemo(
    () =>
      Object.fromEntries(
        paymentSources.map((source) => [source.id, source.name]),
      ),
    [paymentSources],
  );

  function handleFilterChange(next: TransactionFilters) {
    setFilters(next);
    setOffset(0);
  }

  function openTransaction(transactionId: string) {
    navigate(`/transactions/${transactionId}`);
  }

  function renderBody() {
    if (workspaceLoading || isLoading) return <TransactionListSkeleton />;
    if (workspaceError || !workspaceId)
      return (
        <div className="rounded-md bg-destructive/10 p-3 text-destructive">
          Failed to load workspace
        </div>
      );
    if (hasInvalidDateRange) {
      return (
        <div className="rounded-md bg-destructive/10 p-3 text-destructive">
          Date from must be earlier than or equal to date to.
        </div>
      );
    }
    if (error)
      return (
        <div className="rounded-md bg-destructive/10 p-3 text-destructive">
          {error}
        </div>
      );

    const transactions = data?.data ?? [];

    if (transactions.length === 0) return <TransactionEmptyState />;

    return (
      <>
        <TransactionTable
          transactions={transactions}
          categoryMap={categoryMap}
          paymentSourceMap={paymentSourceMap}
          onOpen={openTransaction}
        />
        <TransactionCards
          transactions={transactions}
          categoryMap={categoryMap}
          paymentSourceMap={paymentSourceMap}
          onOpen={openTransaction}
        />
        <TransactionPagination
          total={data?.total ?? 0}
          limit={data?.limit ?? PAGE_SIZE}
          offset={data?.offset ?? offset}
          onPrev={() =>
            setOffset((current) => Math.max(0, current - PAGE_SIZE))
          }
          onNext={() => setOffset((current) => current + PAGE_SIZE)}
        />
      </>
    );
  }

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-semibold">Transactions</h1>
      <div className="space-y-4">
        <TransactionFilterBar
          filters={filters}
          categories={categories}
          tags={tags}
          paymentSources={paymentSources}
          onChange={handleFilterChange}
        />
        {renderBody()}
      </div>
    </div>
  );
}
