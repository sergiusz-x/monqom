import type { Transaction } from "@/types/transaction";
import { formatCurrency } from "@/lib/money";
import { useTranslation } from "react-i18next";
import { formatShortDate } from "@/lib/date-only";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";

interface TransactionCardsProps {
  transactions: Transaction[];
  categoryMap: Record<string, string>;
  paymentSourceMap: Record<string, string>;
  onOpen: (transactionId: string) => void;
}

export function TransactionCards({
  transactions,
  categoryMap,
  paymentSourceMap,
  onOpen,
}: TransactionCardsProps) {
  const { t } = useTranslation();
  return (
    <div data-testid="transaction-cards" className="space-y-3 md:hidden">
      {transactions.map((transaction) => {
        const paymentSourceLabel = transaction.paymentSourceId
          ? (paymentSourceMap[transaction.paymentSourceId] ??
            transaction.paymentSourceId)
          : t("common.none");

        return (
          <Button
            key={transaction.id}
            type="button"
            onClick={() => onOpen(transaction.id)}
            variant="ghost"
            className={cardVariants({
              className:
                "h-auto w-full flex-col items-stretch text-left hover:bg-muted/30",
            })}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{transaction.description}</p>
              <p className="font-semibold">
                {formatCurrency(transaction.amount, transaction.currency)}
              </p>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatShortDate(transaction.date)} &middot;{" "}
              {categoryMap[transaction.categoryId] ?? transaction.categoryId}
            </p>
            {transaction.notes && (
              <p className="mt-2 text-sm text-muted-foreground">
                {transaction.notes}
              </p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {paymentSourceLabel}
            </p>
          </Button>
        );
      })}
    </div>
  );
}
