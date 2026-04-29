import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { Category } from "@/types/category";
import type { TransactionItem } from "@/types/dashboard";

interface RecentTransactionsProps {
  transactions: TransactionItem[];
  categories: Category[];
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
}: RecentTransactionsProps) {
  const [selectedTransaction, setSelectedTransaction] =
    useState<TransactionItem | null>(null);

  const categoryNames = useMemo(() => {
    const allCategories = flattenCategories(categories);
    return new Map(
      allCategories.map((category) => [category.id, category.name]),
    );
  }, [categories]);

  const selectedCategory = selectedTransaction
    ? (categoryNames.get(selectedTransaction.category_id) ?? "Uncategorized")
    : "";

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
                onClick={() => setSelectedTransaction(transaction)}
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

      {selectedTransaction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit transaction"
        >
          <div className="w-full max-w-md rounded-xl bg-background p-5 shadow-lg">
            <h3 className="text-lg font-semibold">Edit transaction</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {formatDate(selectedTransaction.date)}
            </p>
            <div className="mt-4 space-y-2 rounded-lg bg-muted/40 p-3 text-sm">
              <p>
                <span className="text-muted-foreground">Category:</span>{" "}
                {selectedCategory}
              </p>
              <p>
                <span className="text-muted-foreground">Amount:</span>{" "}
                {formatCurrency(
                  selectedTransaction.amount,
                  selectedTransaction.currency,
                )}
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
              >
                Close
              </button>
              <Link
                to="/transactions"
                className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground"
              >
                Open transactions
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
