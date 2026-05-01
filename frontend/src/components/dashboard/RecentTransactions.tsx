import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Category } from "@/types/category";
import type { TransactionItem } from "@/types/dashboard";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";

interface RecentTransactionsProps {
  transactions: TransactionItem[];
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

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
}

export function RecentTransactions({
  transactions,
  categories,
  workspaceId,
  onTransactionSaved,
}: RecentTransactionsProps) {
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionItem | null>(null);

  const categoryNames = useMemo(() => {
    const allCategories = flattenCategories(categories);
    return new Map(
      allCategories.map((category) => [category.id, category.name]),
    );
  }, [categories]);

  return (
    <section
      className="rounded-2xl border border-border bg-card p-6 shadow-sm"
      aria-label="Recent transactions"
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent transactions</h2>
        <Link
          to="/transactions"
          className="text-sm font-medium text-primary hover:underline"
        >
          View All
        </Link>
      </div>

      {transactions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="mb-2 font-medium">No transactions yet</p>
          <p className="text-sm text-muted-foreground">
            Add your first transaction to start tracking monthly spending.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {transactions.slice(0, 5).map((transaction) => (
            <li key={transaction.id}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-transparent px-3 py-2 text-left hover:border-border hover:bg-muted/50"
                onClick={() => setEditingTransaction(transaction)}
              >
                <div>
                  <p className="text-sm font-medium">
                    {categoryNames.get(transaction.category_id) ??
                      "Uncategorized"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(transaction.date)}
                  </p>
                </div>
                <p className="text-sm font-semibold">
                  {formatCurrency(transaction.amount, transaction.currency)}
                </p>
              </button>
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
    </section>
  );
}
