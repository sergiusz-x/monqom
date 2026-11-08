import type { Transaction } from "@/types/transaction";
import { SensitiveTransactionAmount } from "@/components/privacy/SensitiveTransactionAmount";
import { useTranslation } from "react-i18next";
import { formatShortDateWithWeekday } from "@/lib/date-only";
import {
  TransactionListCategory,
  type ListCategory,
} from "./TransactionListCategory";

interface TransactionCardsProps {
  transactions: Transaction[];
  categories: Record<string, ListCategory>;
  categorySystemKeys: Record<string, string | null | undefined>;
  paymentSourceMap: Record<string, string>;
  onOpen: (transactionId: string) => void;
}

export function TransactionCards({
  transactions,
  categories,
  categorySystemKeys,
  paymentSourceMap,
  onOpen,
}: TransactionCardsProps) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="transaction-cards"
      className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card md:hidden"
    >
      {transactions.map((transaction) => {
        const paymentSourceLabel = transaction.paymentSourceId
          ? (paymentSourceMap[transaction.paymentSourceId] ??
            transaction.paymentSourceId)
          : t("common.none");

        return (
          <button
            key={transaction.id}
            type="button"
            onClick={() => onOpen(transaction.id)}
            className="block w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 truncate font-medium">
                {transaction.description}
              </span>
              <SensitiveTransactionAmount
                transaction={transaction}
                categorySystemKeys={categorySystemKeys}
                className="shrink-0 font-semibold"
              />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>{formatShortDateWithWeekday(transaction.date)}</span>
              <span aria-hidden="true">·</span>
              <TransactionListCategory
                transaction={transaction}
                categories={categories}
              />
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {paymentSourceLabel}
            </div>
            {transaction.notes && (
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {transaction.notes}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
