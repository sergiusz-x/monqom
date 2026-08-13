import type { Transaction } from "@/types/transaction";
import { SensitiveTransactionAmount } from "@/components/privacy/SensitiveTransactionAmount";
import { useTranslation } from "react-i18next";
import { formatShortDate } from "@/lib/date-only";
import { Button, cardVariants } from "@monqom/ui";

interface TransactionCardsProps {
  transactions: Transaction[];
  categoryMap: Record<string, string>;
  categorySystemKeys: Record<string, string | null | undefined>;
  paymentSourceMap: Record<string, string>;
  onOpen: (transactionId: string) => void;
}

export function TransactionCards({
  transactions,
  categoryMap,
  categorySystemKeys,
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
          <div
            key={transaction.id}
            className={cardVariants({
              className: "h-auto w-full flex-col items-stretch text-left",
            })}
          >
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-auto min-w-0 flex-1 justify-start p-0 text-left hover:bg-transparent"
                onClick={() => onOpen(transaction.id)}
              >
                <span className="truncate font-medium">
                  {transaction.description}
                </span>
              </Button>
              <SensitiveTransactionAmount
                transaction={transaction}
                categorySystemKeys={categorySystemKeys}
                className="font-semibold"
              />
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
          </div>
        );
      })}
    </div>
  );
}
