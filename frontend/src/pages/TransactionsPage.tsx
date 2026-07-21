import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { TransactionDetailsModal } from "@/components/transactions/TransactionDetailsModal";
import { paymentSourceName } from "@/lib/payment-sources";
import api from "@/lib/api";
import type {
  TransactionFilters,
  TransactionSortField,
} from "@/types/transaction";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/useToast";
import { WorkspaceErrorState } from "@/components/WorkspaceErrorState";
import { Alert } from "@/components/ui/alert";
import { RetryAlert } from "@/components/ui/retry-alert";
import { PageContainer, PageHeader } from "@/components/layout/PageLayout";
import type { TFunction } from "i18next";
import { invalidateFinancialData } from "@/lib/query-invalidation";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import {
  buildTransactionListParams,
  DEFAULT_TRANSACTION_FILTERS,
  hasTransactionListState,
  loadTransactionPreferences,
  parseTransactionFilters,
  parseTransactionPage,
  saveTransactionPreferences,
} from "@/lib/transaction-list-state";

const PAGE_SIZE = 20;

function buildCategoryMap(
  categories: Array<{
    id: string;
    name: string;
    systemKey?: string | null;
    children: Array<{ id: string; name: string; systemKey?: string | null }>;
  }>,
  t: TFunction,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const category of categories) {
    const parentName = translateSystemLabel(
      t,
      category.systemKey,
      category.name,
    );
    map[category.id] = parentName;
    for (const child of category.children) {
      const childName = translateSystemLabel(t, child.systemKey, child.name);
      map[child.id] = `${parentName} / ${childName}`;
    }
  }
  return map;
}

export default function TransactionsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    workspaceId,
    workspace,
    isLoading: workspaceLoading,
    error: workspaceError,
    patchWorkspace,
    refetch: retryWorkspace,
  } = useWorkspace();
  const filters = useMemo(
    () => parseTransactionFilters(searchParams),
    [searchParams],
  );
  const page = parseTransactionPage(searchParams);
  const offset = (page - 1) * PAGE_SIZE;
  const [hydratedStorageWorkspaceId, setHydratedStorageWorkspaceId] =
    useState("");
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [selectedTransactionId, setSelectedTransactionId] = useState<
    string | null
  >(null);
  const [isCreatingTransaction, setIsCreatingTransaction] = useState(false);
  const [editingTransactionId, setEditingTransactionId] = useState<
    string | null
  >(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const editWasSavedRef = useRef(false);
  const hasInvalidDateRange = Boolean(
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo,
  );
  const requestWorkspaceId = hasInvalidDateRange ? "" : (workspaceId ?? "");

  useEffect(() => {
    if (!workspaceId || hydratedStorageWorkspaceId === workspaceId) return;

    const hasUrlState = hasTransactionListState(searchParams);
    const restoredFilters = hasUrlState
      ? filters
      : (loadTransactionPreferences(window.localStorage, workspaceId) ??
        DEFAULT_TRANSACTION_FILTERS);
    const canonicalParams = buildTransactionListParams(
      searchParams,
      restoredFilters,
      hasUrlState ? page : 1,
    );

    const hydrationTimer = window.setTimeout(() => {
      if (canonicalParams.toString() !== searchParams.toString()) {
        setSearchParams(canonicalParams, { replace: true });
      }
      setHydratedStorageWorkspaceId(workspaceId);
    }, 0);

    return () => window.clearTimeout(hydrationTimer);
  }, [
    filters,
    hydratedStorageWorkspaceId,
    page,
    searchParams,
    setSearchParams,
    workspaceId,
  ]);

  useEffect(() => {
    if (!workspaceId || hydratedStorageWorkspaceId !== workspaceId) return;

    saveTransactionPreferences(window.localStorage, workspaceId, filters);
  }, [filters, workspaceId, hydratedStorageWorkspaceId]);

  const { categories } = useCategories(workspaceId ?? "");
  const { paymentSources } = usePaymentSources(workspaceId ?? "", true);
  const { tags } = useTags(workspaceId ?? "");
  const { data, isLoading, error, retry } = useTransactions(
    requestWorkspaceId,
    filters,
    PAGE_SIZE,
    offset,
  );

  const selectedTransaction =
    data?.data.find((item) => item.id === selectedTransactionId) ?? null;
  const editingTransaction =
    data?.data.find((item) => item.id === editingTransactionId) ?? null;

  const categoryMap = useMemo(
    () => buildCategoryMap(categories, t),
    [categories, t],
  );
  const paymentSourceMap = useMemo(
    () =>
      Object.fromEntries(
        paymentSources.map((source) => [
          source.id,
          paymentSourceName(source, t),
        ]),
      ),
    [paymentSources, t],
  );

  function handleFilterChange(next: TransactionFilters) {
    setSearchParams((current) => buildTransactionListParams(current, next, 1));
  }

  function handleSort(sortBy: TransactionSortField) {
    const nextFilters: TransactionFilters = {
      ...filters,
      sortBy,
      sortDirection:
        filters.sortBy === sortBy
          ? filters.sortDirection === "asc"
            ? "desc"
            : "asc"
          : sortBy === "date"
            ? "desc"
            : "asc",
    };
    setSearchParams((current) =>
      buildTransactionListParams(current, nextFilters, 1),
    );
  }
  function openTransaction(transactionId: string) {
    setDeleteError(null);
    setSelectedTransactionId(transactionId);
  }

  function handleSaved(result: { paymentSourceId: string | null }) {
    editWasSavedRef.current = true;
    patchWorkspace({ lastPaymentSourceId: result.paymentSourceId });
    setEditingTransactionId(null);
    setIsCreatingTransaction(false);
    if (workspaceId) {
      void invalidateFinancialData(queryClient, workspaceId);
    }
    showToast(t("transactions.saved"));
  }

  async function handleDelete() {
    if (!workspaceId || !selectedTransaction) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(
        `/workspaces/${workspaceId}/transactions/${selectedTransaction.id}`,
      );
      setSelectedTransactionId(null);
      await invalidateFinancialData(queryClient, workspaceId);
      showToast(t("transactions.deleted"));
    } catch {
      setDeleteError(t("transactions.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  }

  function renderBody() {
    if (workspaceLoading || isLoading) return <TransactionListSkeleton />;
    if (workspaceError || !workspaceId)
      return (
        <WorkspaceErrorState
          message={workspaceError ?? t("common.noWorkspace")}
          onRetry={workspaceError ? () => void retryWorkspace() : undefined}
        />
      );
    if (hasInvalidDateRange) {
      return <Alert variant="error">{t("transactions.invalidRange")}</Alert>;
    }
    if (error)
      return <RetryAlert message={error} onRetry={() => void retry()} />;

    const transactions = data?.data ?? [];

    if (transactions.length === 0)
      return (
        <TransactionEmptyState onAdd={() => setIsCreatingTransaction(true)} />
      );

    return (
      <>
        <TransactionTable
          transactions={transactions}
          categoryMap={categoryMap}
          paymentSourceMap={paymentSourceMap}
          sortBy={filters.sortBy}
          sortDirection={filters.sortDirection}
          onSort={handleSort}
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
            setSearchParams((current) =>
              buildTransactionListParams(
                current,
                filters,
                Math.max(1, page - 1),
              ),
            )
          }
          onNext={() =>
            setSearchParams((current) =>
              buildTransactionListParams(current, filters, page + 1),
            )
          }
        />
      </>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={t("transactions.title")} className="mb-4" />
      <div className="space-y-4">
        <TransactionFilterBar
          filters={filters}
          categories={categories}
          tags={tags}
          paymentSources={paymentSources}
          timeZone={workspace?.timezone ?? "UTC"}
          onChange={handleFilterChange}
        />
        {renderBody()}
      </div>
      <TransactionDetailsModal
        key={selectedTransaction?.id ?? "details-modal"}
        open={Boolean(selectedTransactionId && selectedTransaction)}
        transaction={selectedTransaction}
        categoryLabel={
          selectedTransaction
            ? (categoryMap[selectedTransaction.categoryId] ??
              selectedTransaction.categoryId)
            : ""
        }
        paymentSourceLabel={
          selectedTransaction?.paymentSourceId
            ? (paymentSourceMap[selectedTransaction.paymentSourceId] ??
              selectedTransaction.paymentSourceId)
            : t("common.none")
        }
        isDeleting={isDeleting}
        deleteError={deleteError}
        onClose={() => {
          setSelectedTransactionId(null);
          setDeleteError(null);
        }}
        onEdit={() => {
          if (!selectedTransaction) return;
          editWasSavedRef.current = false;
          setEditingTransactionId(selectedTransaction.id);
          setSelectedTransactionId(null);
        }}
        onDelete={() => void handleDelete()}
      />
      {workspaceId && (
        <>
          <TransactionFormModal
            key={editingTransaction?.id ?? "edit-modal"}
            open={Boolean(editingTransactionId && editingTransaction)}
            mode="edit"
            workspaceId={workspaceId}
            transaction={editingTransaction}
            onClose={() => {
              const cancelledTransactionId = editingTransactionId;
              setEditingTransactionId(null);
              if (!editWasSavedRef.current && cancelledTransactionId) {
                setSelectedTransactionId(cancelledTransactionId);
              }
              editWasSavedRef.current = false;
            }}
            onSaved={handleSaved}
          />
          <TransactionFormModal
            key={isCreatingTransaction ? "create-open" : "create-closed"}
            open={isCreatingTransaction}
            mode="create"
            workspaceId={workspaceId}
            defaultCurrency={workspace?.baseCurrency ?? "USD"}
            defaultPaymentSourceId={workspace?.lastPaymentSourceId ?? null}
            defaultTimezone={workspace?.timezone ?? "UTC"}
            onClose={() => setIsCreatingTransaction(false)}
            onSaved={handleSaved}
          />
        </>
      )}
    </PageContainer>
  );
}
