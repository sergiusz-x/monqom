import { useRef, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SensitiveTransactionAmount } from "@/components/privacy/SensitiveTransactionAmount";
import type { Transaction } from "@/types/transaction";
import { formatLongDate } from "@/lib/date-only";
import {
  ActionMenu,
  Button,
  ConfirmationDialog,
  Modal,
  cardVariants,
} from "@monqom/ui";

interface TransactionDetailsModalProps {
  open: boolean;
  transaction: Transaction | null;
  categoryLabel: string;
  categorySystemKeys: Record<string, string | null | undefined>;
  paymentSourceLabel: string;
  isDeleting: boolean;
  deleteError: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TransactionDetailsModal({
  open,
  transaction,
  categoryLabel,
  categorySystemKeys,
  paymentSourceLabel,
  isDeleting,
  deleteError,
  onClose,
  onEdit,
  onDelete,
}: TransactionDetailsModalProps) {
  const { t } = useTranslation();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const modalContentRef = useRef<HTMLDivElement>(null);

  if (!open || !transaction) return null;

  return (
    <>
      <Modal
        contentRef={modalContentRef}
        open={open}
        onClose={onClose}
        preventClose={isDeleting}
        ariaLabel={t("transactions.details")}
        contentClassName="max-w-lg p-0"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{t("transactions.details")}</h2>
          <div className="flex items-center gap-1">
            <ActionMenu
              ariaLabel={t("transactions.actions")}
              portalContainer={modalContentRef}
              disabled={isDeleting}
              items={[
                {
                  id: "edit",
                  label: t("common.edit"),
                  icon: Pencil,
                  onSelect: onEdit,
                },
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
              disabled={isDeleting}
              onClick={onClose}
            >
              <X size={19} aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div>
            <p className="text-lg font-semibold">{transaction.description}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {categoryLabel}
            </p>
            <SensitiveTransactionAmount
              transaction={transaction}
              categorySystemKeys={categorySystemKeys}
              className="mt-1 text-3xl font-semibold tabular-nums"
            />
          </div>

          <dl
            className={cardVariants({
              tone: "muted",
              className: "grid gap-4 sm:grid-cols-2",
            })}
          >
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
                {t("common.paymentSource")}
              </dt>
              <dd className="mt-1 text-sm font-medium">{paymentSourceLabel}</dd>
            </div>
          </dl>

          <div>
            <h3 className="text-sm font-medium">{t("common.notes")}</h3>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
              {transaction.notes || t("transactions.noNotes")}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-medium">{t("common.tags")}</h3>
            {transaction.tags.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {transaction.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("transactions.noTags")}
              </p>
            )}
          </div>
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
