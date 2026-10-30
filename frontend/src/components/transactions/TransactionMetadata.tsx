import { CircleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Transaction } from "@/types/transaction";

export function TransactionMetadata({
  transaction,
}: {
  transaction: Transaction;
}) {
  const { t } = useTranslation();
  if (transaction.categoryId !== null) return null;

  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      {transaction.categoryId === null && (
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-1 font-medium text-amber-700 dark:text-amber-300">
          <CircleAlert size={13} aria-hidden="true" />
          {t("transactions.needsCategory")}
        </span>
      )}
    </span>
  );
}
