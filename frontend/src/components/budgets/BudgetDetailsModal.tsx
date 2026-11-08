import { useRef } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Pencil, Trash2, X } from "lucide-react";
import { ActionMenu, Button, Modal, ProgressBar } from "@monqom/ui";
import { useTransactions } from "@/hooks/useTransactions";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import {
  formatMonth,
  formatShortDateWithWeekday,
  parseYearMonth,
} from "@/lib/date-only";
import { formatCurrency } from "@/lib/money";
import {
  DEFAULT_TRANSACTION_FILTERS,
  buildTransactionListParams,
} from "@/lib/transaction-list-state";
import type { Budget, BudgetProgressItem } from "@/types/budget";

interface BudgetDetailsModalProps {
  workspaceId: string;
  month: string;
  currency: string;
  item: BudgetProgressItem;
  budget: Budget;
  icon?: string | null;
  isDeleting: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function BudgetDetailsModal({
  workspaceId,
  month,
  currency,
  item,
  budget,
  icon,
  isDeleting,
  onClose,
  onEdit,
  onDelete,
}: BudgetDetailsModalProps) {
  const { t } = useTranslation();
  const modalRef = useRef<HTMLDivElement>(null);
  const [year, monthNumber] = parseYearMonth(month)!;
  const dateTo = `${month}-${String(new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()).padStart(2, "0")}`;
  const filters = {
    ...DEFAULT_TRANSACTION_FILTERS,
    type: "expense" as const,
    categoryIds: [item.categoryId],
    dateFrom: `${month}-01`,
    dateTo,
  };
  const { data, isLoading, error, retry } = useTransactions(
    workspaceId,
    filters,
    4,
    0,
  );
  const transactionParams = buildTransactionListParams(
    new URLSearchParams(),
    filters,
  );
  const transactionLink = `/transactions?${transactionParams.toString()}`;
  const categoryName = translateSystemLabel(
    t,
    item.categorySystemKey,
    item.categoryName,
  );
  const percentage = item.percentage ?? 0;
  const remaining = item.remaining ?? 0;
  const over = remaining < 0;

  return (
    <Modal
      open
      onClose={onClose}
      preventClose={isDeleting}
      ariaLabel={t("budgets.details")}
      contentRef={modalRef}
      contentClassName="flex max-w-lg flex-col overflow-hidden p-0"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-5 py-3">
        <h2 className="text-lg font-semibold">{t("budgets.details")}</h2>
        <div className="flex items-center gap-1">
          <ActionMenu
            ariaLabel={t("budgets.actions")}
            portalContainer={modalRef}
            disabled={isDeleting}
            items={[
              {
                id: "delete",
                label: t("common.delete"),
                icon: Trash2,
                tone: "destructive",
                onSelect: onDelete,
              },
            ]}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("common.close")}
            disabled={isDeleting}
            onClick={onClose}
          >
            <X size={19} aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 space-y-6 overflow-y-auto px-5 py-5">
        <div>
          <h3 className="break-words text-lg font-semibold">
            {icon && (
              <span aria-hidden="true" className="mr-2">
                {icon}
              </span>
            )}
            {categoryName}
          </h3>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {formatMonth(month)}
          </p>
        </div>
        <div>
          <p
            className={`text-2xl font-semibold tabular-nums ${over ? "text-destructive" : ""}`}
          >
            {over
              ? t("budgets.overBy", {
                  amount: formatCurrency(-remaining, currency),
                })
              : t("budgets.remaining", {
                  amount: formatCurrency(remaining, currency),
                })}
          </p>
          <div className="mt-4 flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              {t("budgets.spentOf", {
                spent: formatCurrency(item.spent, currency),
                limit: formatCurrency(item.budgetAmount!, currency),
              })}
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {Math.round(percentage)}%
            </span>
          </div>
          <ProgressBar
            className="mt-2"
            value={percentage}
            indicatorClassName={
              percentage > 100
                ? "bg-red-500"
                : percentage >= 80
                  ? "bg-yellow-500"
                  : "bg-green-500"
            }
            ariaLabel={t("budgets.progress", { category: categoryName })}
          />
          {budget.currency !== currency && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("budgets.originalLimit", {
                amount: formatCurrency(budget.amount, budget.currency),
              })}
            </p>
          )}
        </div>
        <section aria-label={t("budgets.recentExpenses")}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">
              {t("budgets.recentExpenses")}
            </h3>
            {data && data.total > 0 && (
              <Link
                to={transactionLink}
                className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {t("budgets.viewExpenses")}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>
          {isLoading ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : error ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-destructive">
                {t("budgets.expensesError")}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void retry()}
              >
                {t("common.retry")}
              </Button>
            </div>
          ) : data?.data.length ? (
            <ul className="mt-2 divide-y divide-border">
              {data.data.map((transaction) => (
                <li
                  key={transaction.id}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p
                      className="truncate text-sm font-medium"
                      title={transaction.description}
                    >
                      {transaction.description}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatShortDateWithWeekday(transaction.date)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {formatCurrency(transaction.amount, transaction.currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("budgets.noExpenses")}
            </p>
          )}
        </section>
      </div>
      <div className="flex shrink-0 justify-end border-t border-border bg-card px-5 py-3">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={isDeleting}
          onClick={onEdit}
        >
          <Pencil aria-hidden="true" />
          {t("common.edit")}
        </Button>
      </div>
    </Modal>
  );
}
