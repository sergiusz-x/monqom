import type { TransactionItem } from "@/types/transaction";

interface TransactionTableProps {
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

export function TransactionTable({
  transactions,
  categoryMap,
  paymentSourceMap,
  onOpen,
}: TransactionTableProps) {
  return (
    <div
      data-testid="transaction-table"
      className="hidden overflow-x-auto rounded-lg border border-border md:block"
    >
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left">
          <tr>
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 font-medium">Category</th>
            <th className="px-3 py-2 font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Notes</th>
            <th className="px-3 py-2 font-medium">Tags</th>
            <th className="px-3 py-2 font-medium">Payment source</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const paymentSourceLabel = transaction.payment_source_id
              ? (paymentSourceMap[transaction.payment_source_id] ??
                transaction.payment_source_id)
              : "None";

            return (
              <tr
                key={transaction.id}
                onClick={() => onOpen(transaction.id)}
                className="cursor-pointer border-t border-border transition-colors hover:bg-muted/30"
              >
                <td className="px-3 py-2">{formatDate(transaction.date)}</td>
                <td className="px-3 py-2">
                  {categoryMap[transaction.category_id] ??
                    transaction.category_id}
                </td>
                <td className="px-3 py-2 font-medium">
                  {formatAmount(transaction.amount, transaction.currency)}
                </td>
                <td className="max-w-52 truncate px-3 py-2 text-muted-foreground">
                  {transaction.notes || "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {transaction.tags.length ? transaction.tags.join(", ") : "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {paymentSourceLabel}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
