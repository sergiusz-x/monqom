import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Category } from "@/types/category";
import type { Transaction } from "@/types/transaction";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { formatCurrency } from "@/lib/money";
import { useTranslation } from "react-i18next";
import { formatShortDate } from "@/lib/date-only";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useNavigate } from "react-router-dom";
import { SectionCard } from "@/components/ui/card";
import { translateSystemLabel } from "@/i18n/translate-system-label";

interface RecentTransactionsProps {
  transactions: Transaction[];
  categories: Category[];
  workspaceId: string;
  onTransactionSaved: () => void;
}

function flattenCategories(categories: Category[]): Category[] {
  return categories.flatMap((category) => [
    category,
    ...flattenCategories(category.children),
  ]);
}

export function RecentTransactions({
  transactions,
  categories,
  workspaceId,
  onTransactionSaved,
}: RecentTransactionsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);

  const categoryNames = useMemo(() => {
    const allCategories = flattenCategories(categories);
    return new Map(
      allCategories.map((category) => [
        category.id,
        translateSystemLabel(t, category.systemKey, category.name),
      ]),
    );
  }, [categories, t]);

  return (
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
                onClick={() => setEditingTransaction(transaction)}
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

      {editingTransaction && (
        <TransactionFormModal
          key={editingTransaction.id}
          open
          mode="edit"
          workspaceId={workspaceId}
          transaction={editingTransaction}
          onClose={() => setEditingTransaction(null)}
          onSaved={onTransactionSaved}
        />
      )}
    </SectionCard>
  );
}
