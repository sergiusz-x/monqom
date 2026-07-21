import { useRef, useState } from "react";
import { MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { formatCurrency } from "@/lib/money";
import type { Transaction } from "@/types/transaction";
import { formatLongDate } from "@/lib/date-only";
import { Menu } from "@base-ui/react/menu";
import { buttonVariants } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";

interface TransactionDetailsModalProps {
  open: boolean;
  transaction: Transaction | null;
  categoryLabel: string;
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
            <Menu.Root modal={false}>
              <Menu.Trigger
                aria-label={t("transactions.actions")}
                className={buttonVariants({ variant: "ghost", size: "icon" })}
              >
                <MoreHorizontal size={19} aria-hidden="true" />
              </Menu.Trigger>
              <Menu.Portal container={modalContentRef}>
                <Menu.Positioner
                  sideOffset={4}
                  align="end"
                  className="z-[100] outline-none"
                >
                  <Menu.Popup className="min-w-36 rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
                    <Menu.Item
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                      onClick={onEdit}
                    >
                      <Pencil size={15} aria-hidden="true" />
                      {t("common.edit")}
                    </Menu.Item>
                    <Menu.Item
                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive outline-none data-[highlighted]:bg-destructive/10"
                      onClick={() => setConfirmingDelete(true)}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      {t("common.delete")}
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
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
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {formatCurrency(transaction.amount, transaction.currency)}
            </p>
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
