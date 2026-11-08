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
          <div
            key={transaction.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
          >
            <button
              type="button"
              onClick={() => onOpen(transaction.id)}
              className="block min-w-0 cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <span className="block min-w-0 truncate font-medium">
                {transaction.description}
              </span>
              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                <span>{formatShortDateWithWeekday(transaction.date)}</span>
                <span aria-hidden="true">·</span>
                <TransactionListCategory
                  transaction={transaction}
                  categories={categories}
                />
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {paymentSourceLabel}
              </span>
              {transaction.notes && (
                <span className="mt-1 block line-clamp-2 text-sm text-muted-foreground">
                  {transaction.notes}
                </span>
              )}
            </button>
            <SensitiveTransactionAmount
              transaction={transaction}
              categorySystemKeys={categorySystemKeys}
              className="shrink-0 font-semibold"
            />
          </div>
        );
      })}
    </div>
  );
}
