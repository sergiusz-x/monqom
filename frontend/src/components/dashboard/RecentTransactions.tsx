import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

import { TransactionDetailsModal } from "@/components/transactions/TransactionDetailsModal";
import {
  TransactionListCategory,
  type ListCategory,
} from "@/components/transactions/TransactionListCategory";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { usePaymentSources } from "@/hooks/usePaymentSources";
import { useToast } from "@/hooks/useToast";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import { transactionsApi } from "@/api/contract";
import { formatShortDateWithWeekday } from "@/lib/date-only";
import { categorySystemKeys } from "@/lib/category-system-keys";
import { SensitiveTransactionAmount } from "@/components/privacy/SensitiveTransactionAmount";
import { paymentSourceName } from "@/lib/payment-sources";
import { flattenCategories } from "@/lib/category-tree";
import { invalidateFinancialData } from "@/lib/query-invalidation";
import type { Category } from "@/types/category";
import type { Transaction } from "@/types/transaction";

import { Button, EmptyState, SectionCard } from "@monqom/ui";

interface RecentTransactionsProps {
  workspaceId: string;
  transactions: Transaction[];
  categories: Category[];
  categoryHeight: number;
}

export function RecentTransactions({
  workspaceId,
  transactions,
  categories,
  categoryHeight,
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
  const listRef = useRef<HTMLUListElement>(null);
  const [visibleCount, setVisibleCount] = useState(5);
  const [desktopHeight, setDesktopHeight] = useState<number | undefined>();
  useEffect(() => {
    const update = () => {
      const list = listRef.current;
      const section = list?.closest("section");
      const row = list?.firstElementChild as HTMLElement | null;
      if (
        !categoryHeight ||
        !window.matchMedia("(min-width: 1024px)").matches
      ) {
        setVisibleCount(5);
        setDesktopHeight(undefined);
        return;
      }
      setDesktopHeight(categoryHeight);
      if (!section || !list || !row) return;
      const overhead =
        list.getBoundingClientRect().top -
        section.getBoundingClientRect().top +
        parseFloat(getComputedStyle(section).paddingBottom) +
        1;
      const count = Math.max(
        1,
        Math.floor((categoryHeight - overhead + 8) / (row.offsetHeight + 8)),
      );
      setVisibleCount(Math.min(transactions.length, count));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [categoryHeight, transactions.length]);

  const categoryNames = useMemo(() => {
    const allCategories = flattenCategories(categories);
    return new Map(
      allCategories.map((category) => [
        category.id,
        translateSystemLabel(t, category.systemKey, category.name),
      ]),
    );
  }, [categories, t]);

  const listCategories = useMemo(() => {
    const result: Record<string, ListCategory> = {};
    function visit(items: Category[], parentName?: string) {
      for (const category of items) {
        const name = translateSystemLabel(t, category.systemKey, category.name);
        result[category.id] = { name, parentName, icon: category.icon };
        visit(category.children, name);
      }
    }
    visit(categories);
    return result;
  }, [categories, t]);

  const categorySystemKeyMap = useMemo(
    () => categorySystemKeys(categories),
    [categories],
  );

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
  }

  async function handleDelete() {
    if (!selectedTransaction) return;

    setIsDeleting(true);
    setDeleteError(null);
    try {
      await transactionsApi.transactionsControllerDeleteTransaction(
        selectedTransaction.id,
        workspaceId,
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
        style={desktopHeight ? { height: desktopHeight } : undefined}
        padding="spacious"
        elevation="raised"
        className="min-w-0"
        aria-label={t("dashboard.recent")}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("dashboard.recent")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("dashboard.recentDescription")}
            </p>
          </div>
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
          <ul ref={listRef} className="space-y-2">
            {transactions.slice(0, visibleCount).map((transaction) => (
              <li key={transaction.id}>
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2 hover:bg-muted/50">
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-auto w-full min-w-0 justify-start p-0 text-left hover:bg-transparent"
                    onClick={() => {
                      setDeleteError(null);
                      setSelectedTransaction(transaction);
                    }}
                  >
                    <span className="block w-full min-w-0">
                      <span
                        className="block truncate text-sm font-medium"
                        title={transaction.description}
                      >
                        {transaction.description}
                      </span>

                      <span className="block truncate text-xs text-muted-foreground">
                        {formatShortDateWithWeekday(transaction.date)} &middot;{" "}
                        <TransactionListCategory
                          transaction={transaction}
                          categories={listCategories}
                        />
                      </span>
                    </span>
                  </Button>
                  <SensitiveTransactionAmount
                    transaction={transaction}
                    categorySystemKeys={categorySystemKeyMap}
                    className="text-sm font-semibold tabular-nums"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <TransactionDetailsModal
        key={selectedTransaction?.id ?? "dashboard-details-modal"}
        open={Boolean(selectedTransaction)}
        transaction={selectedTransaction}
        categorySystemKeys={categorySystemKeyMap}
        categoryIcon={
          flattenCategories(categories).find(
            (category) => category.id === selectedTransaction?.categoryId,
          )?.icon
        }
        categoryLabel={
          selectedTransaction
            ? (categoryNames.get(selectedTransaction.categoryId ?? "") ??
              (selectedTransaction.categoryId
                ? t("transactions.unavailableCategory")
                : t("dashboard.uncategorized")))
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
        onCategorySaved={(categoryId) => {
          setSelectedTransaction((current) =>
            current ? { ...current, categoryId } : null,
          );
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
