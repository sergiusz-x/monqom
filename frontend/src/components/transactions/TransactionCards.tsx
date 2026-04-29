import type { TransactionItem } from "@/types/transaction";

interface TransactionCardsProps {
  transactions: TransactionItem[];
  categoryMap: Record<string, string>;
  paymentSourceMap: Record<string, string>;
  onOpen: (transactionId: string) => void;
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function TransactionCards({
  transactions,
  categoryMap,
  paymentSourceMap,
  onOpen,
}: TransactionCardsProps) {
  return (
    <div data-testid="transaction-cards" className="space-y-3 md:hidden">
      {transactions.map((transaction) => (
        <button
          key={transaction.id}
          type="button"
          onClick={() => onOpen(transaction.id)}
          className="w-full rounded-lg border border-border bg-card p-4 text-left"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">
              {categoryMap[transaction.category_id] ?? transaction.category_id}
            </p>
            <p className="font-semibold">
              {formatAmount(transaction.amount, transaction.currency)}
            </p>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(transaction.date)}
          </p>
          {transaction.notes && (
            <p className="mt-2 text-sm text-muted-foreground">
              {transaction.notes}
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {paymentSourceMap[transaction.payment_source_id] ??
              transaction.payment_source_id}
          </p>
        </button>
      ))}
    </div>
  );
}
