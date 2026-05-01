import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
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
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { TRANSACTION_SAVED_EVENT } from "@/lib/transaction-refresh";
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
  const [searchParams] = useSearchParams();
  const {
    workspaceId,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace();
  const [filters, setFilters] = useState<TransactionFilters>(() => ({
    categoryId: searchParams.get("category_id") ?? defaultFilters.categoryId,
    tag: searchParams.get("tag") ?? defaultFilters.tag,
    paymentSourceId:
      searchParams.get("payment_source_id") ?? defaultFilters.paymentSourceId,
    dateFrom: searchParams.get("date_from") ?? defaultFilters.dateFrom,
    dateTo: searchParams.get("date_to") ?? defaultFilters.dateTo,
  }));
  const [offset, setOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null);
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
    refreshKey,
  );

  const editingTransaction =
    data?.data.find((item) => item.id === editingTransactionId) ?? null;

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
    setEditingTransactionId(transactionId);
  }

  function handleSaved() {
    setRefreshKey((value) => value + 1);
    setToast("Transaction saved successfully.");
    window.setTimeout(() => setToast(null), 2500);
  }

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
      {workspaceId && (
        <TransactionFormModal
          key={editingTransaction?.id ?? "edit-modal"}
          open={Boolean(editingTransactionId && editingTransaction)}
          mode="edit"
          workspaceId={workspaceId}
          transaction={editingTransaction}
          onClose={() => setEditingTransactionId(null)}
          onSaved={handleSaved}
        />
      )}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
