import { useRef, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { invalidateFinancialData } from "@/lib/query-invalidation";
import { CategorySelector } from "@/components/CategorySelector";

import { SensitiveTransactionAmount } from "@/components/privacy/SensitiveTransactionAmount";
import type { Transaction } from "@/types/transaction";
import { formatLongDate } from "@/lib/date-only";
import { TransactionMetadata } from "./TransactionMetadata";
import {
  ActionMenu,
  Alert,
  Button,
  ConfirmationDialog,
  FormField,
  Modal,
} from "@monqom/ui";

interface TransactionDetailsModalProps {
  open: boolean;
  transaction: Transaction | null;
  categoryLabel: string;
  categoryIcon?: string | null;
  categorySystemKeys: Record<string, string | null | undefined>;
  paymentSourceLabel: string;
  isDeleting: boolean;
  deleteError: string | null;
  onClose: () => void;
  onEdit: () => void;
  onCategorySaved: (categoryId: string) => void;
  onDelete: () => void;
}

export function TransactionDetailsModal({
  open,
  transaction,
  categoryLabel,
  categoryIcon,
  categorySystemKeys,
  paymentSourceLabel,
  isDeleting,
  deleteError,
  onClose,
  onEdit,
  onCategorySaved,
  onDelete,
}: TransactionDetailsModalProps) {
  const { t } = useTranslation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [assigningCategory, setAssigningCategory] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState(false);
  const queryClient = useQueryClient();
  const modalContentRef = useRef<HTMLDivElement>(null);

  if (!open || !transaction) return null;

  async function saveCategory() {
    if (!transaction || !categoryId || isSavingCategory) return;
    setIsSavingCategory(true);
    setCategoryError(false);
    try {
      await api.patch(
        `/workspaces/${encodeURIComponent(transaction.workspaceId)}/transactions/${encodeURIComponent(transaction.id)}/category`,
        { category_id: categoryId },
      );
      onCategorySaved(categoryId);
      setAssigningCategory(false);
      void invalidateFinancialData(queryClient, transaction.workspaceId);
    } catch {
      setCategoryError(true);
    } finally {
      setIsSavingCategory(false);
    }
  }

  return (
    <>
      <Modal
        contentRef={modalContentRef}
        open={open}
        onClose={onClose}
        preventClose={isDeleting || isSavingCategory}
        ariaLabel={t("transactions.details")}
        contentClassName="max-w-lg p-0"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-card px-5 py-3">
          <h2 className="text-lg font-semibold">{t("transactions.details")}</h2>
          <div className="flex items-center gap-1">
            <ActionMenu
              ariaLabel={t("transactions.actions")}
              portalContainer={modalContentRef}
              disabled={isDeleting || isSavingCategory}
              items={[
                {
                  id: "delete",
                  label: t("common.delete"),
                  icon: Trash2,
                  tone: "destructive",
                  onSelect: () => setConfirmingDelete(true),
                },
              ]}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("common.close")}
              disabled={isDeleting || isSavingCategory}
              onClick={onClose}
            >
              <X size={19} aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="space-y-5 px-5 py-4">
          <div>
            <p className="break-words text-lg font-semibold [overflow-wrap:anywhere]">
              {transaction.description}
            </p>
            {transaction.categoryId !== null && (
              <p className="mt-1 text-sm text-muted-foreground">
                {categoryIcon && (
                  <span aria-hidden="true" className="mr-1.5">
                    {categoryIcon}
                  </span>
                )}
                {categoryLabel}
              </p>
            )}
            <SensitiveTransactionAmount
              transaction={transaction}
              categorySystemKeys={categorySystemKeys}
              className="mt-1 text-3xl font-semibold tabular-nums"
            />
            {transaction.categoryId === null && (
              <div className="mt-3">
                <TransactionMetadata transaction={transaction} />
              </div>
            )}
          </div>

          {transaction.categoryId === null && assigningCategory && (
            <div className="space-y-2">
              <FormField
                id="assign-transaction-category"
                label={t("common.category")}
              >
                <CategorySelector
                  defaultOpen
                  workspaceId={transaction.workspaceId}
                  type={transaction.type}
                  value={categoryId}
                  onChange={(value) => {
                    setCategoryId(value);
                    setCategoryError(false);
                  }}
                  disabled={isSavingCategory}
                />
              </FormField>
              {categoryError && (
                <Alert variant="error">
                  {t("transactions.assignCategoryError")}
                </Alert>
              )}
            </div>
          )}

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("common.date")}
              </dt>
              <dd className="mt-1 text-sm font-medium">
                {formatLongDate(transaction.date)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {t("transactions.accountOrWallet")}
              </dt>
              <dd className="mt-1 break-words text-sm font-medium [overflow-wrap:anywhere]">
                {paymentSourceLabel}
              </dd>
            </div>
          </dl>

          {transaction.notes && (
            <div>
              <h3 className="text-sm font-medium">{t("common.notes")}</h3>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                {transaction.notes}
              </p>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 z-10 flex justify-end border-t border-border bg-card px-5 py-3">
          {assigningCategory ? (
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                disabled={isSavingCategory}
                onClick={() => {
                  setAssigningCategory(false);
                  setCategoryId(null);
                  setCategoryError(false);
                }}
                className="flex-1 sm:flex-none"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                disabled={!categoryId || isSavingCategory}
                onClick={() => void saveCategory()}
                className="flex-1 sm:flex-none"
              >
                {isSavingCategory
                  ? t("transactions.assignCategorySaving")
                  : t("common.save")}
              </Button>
            </div>
          ) : (
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={onEdit}
                disabled={isDeleting}
                className="flex-1 sm:flex-none"
              >
                <Pencil aria-hidden="true" />
                {t("common.edit")}
              </Button>
              {transaction.categoryId === null && (
                <Button
                  type="button"
                  onClick={() => setAssigningCategory(true)}
                  disabled={isDeleting}
                  className="flex-1 sm:flex-none"
                >
                  {t("transactions.assignCategory")}
                </Button>
              )}
            </div>
          )}
        </div>
      </Modal>
      <ConfirmationDialog
        open={confirmingDelete}
        title={t("transactions.deleteConfirm")}
        description={t("transactions.deleteDescription")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        pendingLabel={t("transactions.deleting")}
        isPending={isDeleting}
        error={deleteError}
        layer="nested"
        onClose={() => setConfirmingDelete(false)}
        onConfirm={onDelete}
      />
    </>
  );
}
