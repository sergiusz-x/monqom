import { useTranslation } from "react-i18next";
import type { Transaction } from "@/types/transaction";
import { TransactionMetadata } from "./TransactionMetadata";

export interface ListCategory {
  name: string;
  parentName?: string;
  icon: string | null;
}

export function TransactionListCategory({
  transaction,
  categories,
}: {
  transaction: Transaction;
  categories: Record<string, ListCategory>;
}) {
  const { t } = useTranslation();
  if (!transaction.categoryId)
    return <TransactionMetadata transaction={transaction} />;
  const category = categories[transaction.categoryId];
  if (!category)
    return (
      <span className="text-muted-foreground">
        {t("transactions.unavailableCategory")}
      </span>
    );
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {category.icon && (
        <span aria-hidden="true" className="shrink-0">
          {category.icon}
        </span>
      )}
      <span className="min-w-0">
        {category.parentName && (
          <span className="text-muted-foreground">
            {category.parentName} /{" "}
          </span>
        )}
        <span>{category.name}</span>
      </span>
    </span>
  );
}
