import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type {
  Transaction,
  TransactionSortDirection,
  TransactionSortField,
} from "@/types/transaction";
import { formatCurrency } from "@/lib/money";
import { useTranslation } from "react-i18next";
import { formatShortDate } from "@/lib/date-only";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface TransactionTableProps {
  transactions: Transaction[];
  categoryMap: Record<string, string>;
  paymentSourceMap: Record<string, string>;
  sortBy: TransactionSortField;
  sortDirection: TransactionSortDirection;
  onSort: (field: TransactionSortField) => void;
  onOpen: (transactionId: string) => void;
}

interface SortableHeaderProps {
  field: TransactionSortField;
  label: string;
  activeField: TransactionSortField;
  direction: TransactionSortDirection;
  onSort: (field: TransactionSortField) => void;
}

function SortableHeader({
  field,
  label,
  activeField,
  direction,
  onSort,
}: SortableHeaderProps) {
  const active = activeField === field;
  const Icon = active
    ? direction === "asc"
      ? ArrowUp
      : ArrowDown
    : ArrowUpDown;

  return (
    <th
      className="px-3 py-2 font-medium"
      aria-sort={
        active ? (direction === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="-mx-2"
        onClick={() => onSort(field)}
      >
        {label}
        <Icon
          size={14}
          className={active ? "text-foreground" : "text-muted-foreground/60"}
          aria-hidden="true"
        />
      </Button>
    </th>
  );
}

export function TransactionTable({
  transactions,
  categoryMap,
  paymentSourceMap,
  sortBy,
  sortDirection,
  onSort,
  onOpen,
}: TransactionTableProps) {
  const { t } = useTranslation();
  const headers: Array<{
    field: TransactionSortField;
    label: string;
  }> = [
    { field: "date", label: t("common.date") },
    { field: "category", label: t("common.category") },
    { field: "amount", label: t("common.amount") },
    { field: "description", label: t("transactions.description") },
    { field: "tags", label: t("common.tags") },
    { field: "payment_source", label: t("common.paymentSource") },
  ];

  return (
    <Card
      padding="none"
      data-testid="transaction-table"
      className="hidden overflow-x-auto md:block"
    >
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left">
          <tr>
            {headers.map((header) => (
              <SortableHeader
                key={header.field}
                field={header.field}
                label={header.label}
                activeField={sortBy}
                direction={sortDirection}
                onSort={onSort}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {transactions.map((transaction) => {
            const paymentSourceLabel = transaction.paymentSourceId
              ? (paymentSourceMap[transaction.paymentSourceId] ??
                transaction.paymentSourceId)
              : t("common.none");

            return (
              <tr
                key={transaction.id}
                onClick={() => onOpen(transaction.id)}
                className="cursor-pointer border-t border-border transition-colors hover:bg-muted/30"
              >
                <td className="px-3 py-2">
                  {formatShortDate(transaction.date)}
                </td>
                <td className="px-3 py-2">
                  {categoryMap[transaction.categoryId] ??
                    transaction.categoryId}
                </td>
                <td className="px-3 py-2 font-medium">
                  {formatCurrency(transaction.amount, transaction.currency)}
                </td>
                <td className="max-w-52 truncate px-3 py-2 text-muted-foreground">
                  {transaction.description}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {transaction.tags.length ? transaction.tags.join(", ") : "-"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {paymentSourceLabel}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
