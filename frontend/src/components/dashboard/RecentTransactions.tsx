<<<<<<< HEAD
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { TransactionDetailsModal } from "@/components/transactions/TransactionDetailsModal";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { usePaymentSources } from "@/hooks/usePaymentSources";
import { useToast } from "@/hooks/useToast";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import api from "@/lib/api";
import { formatShortDate } from "@/lib/date-only";
import { formatCurrency } from "@/lib/money";
import { paymentSourceName } from "@/lib/payment-sources";
import { invalidateFinancialData } from "@/lib/query-invalidation";
import type { Category } from "@/types/category";
import type { Transaction } from "@/types/transaction";
=======
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Category } from "@/types/category";
import type { Transaction } from "@/types/transaction";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { formatCurrency } from "@/lib/money";
import { useTranslation } from "react-i18next";
import { formatShortDate } from "@/lib/date-only";

import { useNavigate } from "react-router-dom";

import { translateSystemLabel } from "@/i18n/translate-system-label";
>>>>>>> origin/feature/monqom-api-client
import { Button, EmptyState, SectionCard } from "@monqom/ui";

interface RecentTransactionsProps {
  workspaceId: string;
  transactions: Transaction[];
  categories: Category[];
}

function flattenCategories(categories: Category[]): Category[] {
  return categories.flatMap((category) => [
    category,
    ...flattenCategories(category.children),
  ]);
}

export function RecentTransactions({
  workspaceId,
  transactions,
  categories,
}: RecentTransactionsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { paymentSources } = usePaymentSources(workspaceId, true);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const editWasSavedRef = useRef(false);

  const categoryNames = useMemo(() => {
    const allCategories = flattenCategories(categories);
    return new Map(
      allCategories.map((category) => [
        category.id,
        translateSystemLabel(t, category.systemKey, category.name),
      ]),
    );
  }, [categories, t]);

  const paymentSourceNames = useMemo(
    () =>
      new Map(
        paymentSources.map((source) => [
          source.id,
          paymentSourceName(source, t),
        ]),
      ),
    [paymentSources, t],
  );

  function handleSaved() {
    editWasSavedRef.current = true;
    setEditingTransaction(null);
    void invalidateFinancialData(queryClient, workspaceId);
    showToast(t("transactions.saved"));
  }

  async function handleDelete() {
    if (!selectedTransaction) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(
        `/workspaces/${workspaceId}/transactions/${selectedTransaction.id}`,
      );
      setSelectedTransaction(null);
      await invalidateFinancialData(queryClient, workspaceId);
      showToast(t("transactions.deleted"));
    } catch {
      setDeleteError(t("transactions.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <SectionCard
        padding="spacious"
        elevation="raised"
        aria-label={t("dashboard.recent")}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("dashboard.recent")}</h2>
          <Link
            to="/transactions"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("dashboard.viewAll")}
          </Link>
        </div>

        {transactions.length === 0 ? (
          <EmptyState
            title={t("dashboard.noTransactions")}
            description={t("dashboard.noTransactionsDescription")}
            actionLabel={t("dashboard.viewAll")}
            onAction={() => navigate("/transactions")}
          />
        ) : (
          <ul className="space-y-2">
            {transactions.slice(0, 5).map((transaction) => (
              <li key={transaction.id}>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-between px-3 py-2 text-left hover:border-border hover:bg-muted/50"
                  onClick={() => {
                    setDeleteError(null);
                    setSelectedTransaction(transaction);
                  }}
                >
                  <div>
                    <p className="text-sm font-medium">
                      {transaction.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatShortDate(transaction.date)} &middot;{" "}
                      {categoryNames.get(transaction.categoryId) ??
                        t("dashboard.uncategorized")}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </p>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <TransactionDetailsModal
        key={selectedTransaction?.id ?? "dashboard-details-modal"}
        open={Boolean(selectedTransaction)}
        transaction={selectedTransaction}
        categoryLabel={
          selectedTransaction
            ? (categoryNames.get(selectedTransaction.categoryId) ??
              selectedTransaction.categoryId)
            : ""
        }
        paymentSourceLabel={
          selectedTransaction?.paymentSourceId
            ? (paymentSourceNames.get(selectedTransaction.paymentSourceId) ??
              selectedTransaction.paymentSourceId)
            : t("common.none")
        }
        isDeleting={isDeleting}
        deleteError={deleteError}
        onClose={() => {
          setSelectedTransaction(null);
          setDeleteError(null);
        }}
        onEdit={() => {
          if (!selectedTransaction) return;
          editWasSavedRef.current = false;
          setEditingTransaction(selectedTransaction);
          setSelectedTransaction(null);
        }}
        onDelete={() => void handleDelete()}
      />

      <TransactionFormModal
        key={editingTransaction?.id ?? "dashboard-edit-modal"}
        open={Boolean(editingTransaction)}
        mode="edit"
        workspaceId={workspaceId}
        transaction={editingTransaction}
        onClose={() => {
          const cancelledTransaction = editingTransaction;
          setEditingTransaction(null);
          if (!editWasSavedRef.current && cancelledTransaction) {
            setSelectedTransaction(cancelledTransaction);
          }
          editWasSavedRef.current = false;
        }}
        onSaved={handleSaved}
      />
    </>
  );
}
