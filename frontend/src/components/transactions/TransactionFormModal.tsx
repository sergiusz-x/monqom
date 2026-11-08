import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { formatDateOnly, getDateOnlyInTimeZone } from "@/lib/date-only";
import { useTranslation } from "react-i18next";
import { CategorySelector } from "@/components/CategorySelector";
import { PaymentSourceDialog } from "@/components/payment-sources/PaymentSourceDialog";

import { useTransactionForm } from "@/hooks/useTransactionForm";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { paymentSourceName } from "@/lib/payment-sources";
import type { Transaction } from "@/types/transaction";
import type { TransactionFormMode } from "@/hooks/useTransactionForm";
import {
  Alert,
  Button,
  FieldError,
  FormField,
  Input,
  Modal,
  MoneyInput,
  PendingButton,
  SegmentedControl,
  Select,
  Textarea,
} from "@monqom/ui";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

interface TransactionFormModalProps {
  open: boolean;
  mode: TransactionFormMode;
  workspaceId: string;
  transaction?: Transaction | null;
  defaultCurrency?: string;
  defaultPaymentSourceId?: string | null;
  defaultTimezone?: string;
  onClose: () => void;
  onSaved: (result: { paymentSourceId: string | null }) => void;
}

export function TransactionFormModal({
  open,
  mode,
  workspaceId,
  transaction,
  defaultCurrency = "USD",
  defaultPaymentSourceId = null,
  defaultTimezone = "UTC",
  onClose,
  onSaved,
}: TransactionFormModalProps) {
  const { t } = useTranslation();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const {
    isEdit,
    formRef,
    handleSubmit,
    errors,
    submitError,
    isSaving,
    fields,
    transactionType,
    setTransactionType,
    sources,
  } = useTransactionForm({
    mode,
    workspaceId,
    transaction,
    defaultCurrency,
    defaultPaymentSourceId,
    defaultTimezone,
    onClose,
    onSaved,
  });
  if (!open) return null;

  const selectedSource = sources.available.find(
    (source) => source.id === sources.selectedId,
  );
  const dateLabel =
    fields.date === getDateOnlyInTimeZone(new Date(), defaultTimezone)
      ? t("transactions.today")
      : fields.date
        ? formatDateOnly(fields.date)
        : t("common.date");
  const sourceLabel = selectedSource
    ? paymentSourceName(selectedSource, t)
    : t("transactions.selectPaymentSource");

  return (
    <Modal
      open
      onClose={onClose}
      preventClose={isSaving}
      ariaLabel={isEdit ? t("transactions.edit") : t("transactions.add")}
      contentClassName="flex max-w-lg flex-col overflow-hidden p-0"
    >
      <h2 className="shrink-0 px-5 pt-5 text-lg font-semibold">
        {isEdit ? t("transactions.edit") : t("transactions.add")}
      </h2>
      <form
        ref={formRef}
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(event) => {
          if (!fields.date || !sources.selectedId) setDetailsOpen(true);
          void handleSubmit(event);
        }}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
            event.preventDefault();
            if (!isSaving) {
              formRef.current?.requestSubmit();
            }
          }
        }}
      >
        <div className="min-h-0 space-y-4 overflow-y-auto px-5 pb-4 pt-4">
          {!isEdit ? (
            <SegmentedControl
              value={transactionType}
              ariaLabel={t("transactions.type")}
              options={(["expense", "income"] as const).map((type) => ({
                value: type,
                label: t(`transactions.${type}`),
              }))}
              onChange={setTransactionType}
            />
          ) : null}
          <FormField
            id="transaction-amount"
            label={t("common.amount")}
            error={errors.amount}
            required
          >
            <MoneyInput
              currency={fields.currency}
              minorUnits={fields.amountMinorUnits}
              onMinorUnitsChange={fields.setAmountMinorUnits}
              autoFocus={!isEdit}
              onFocus={(event) => event.currentTarget.select()}
              className="h-14 px-4 pr-16 text-right text-2xl font-semibold"
            />
          </FormField>

          <FormField
            id="transaction-description"
            label={t("transactions.description")}
            error={errors.description}
            required
          >
            <Input
              type="text"
              maxLength={200}
              value={fields.description}
              onChange={(event) => fields.setDescription(event.target.value)}
              placeholder={t("transactions.descriptionPlaceholder")}
            />
          </FormField>
          <FormField
            id="transaction-category"
            label={t("common.category")}
            error={errors.categoryId}
            required
          >
            <CategorySelector
              workspaceId={workspaceId}
              value={fields.categoryId}
              onChange={fields.setCategoryId}
              type={transactionType}
            />
          </FormField>

          <Button
            type="button"
            variant="outline"
            className="flex h-auto min-h-10 w-full items-center justify-between gap-3 px-3 py-2 text-left font-normal"
            aria-expanded={detailsOpen}
            aria-controls="transaction-default-details"
            onClick={() => setDetailsOpen((current) => !current)}
          >
            <span className="min-w-0">
              <span className="block font-medium">
                {t("transactions.extraDetails")}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {dateLabel} · {sourceLabel}
              </span>
            </span>
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={detailsOpen ? "shrink-0 rotate-180" : "shrink-0"}
            />
          </Button>
          <div
            id="transaction-default-details"
            className={detailsOpen ? "space-y-4" : "hidden"}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="transaction-date"
                label={t("common.date")}
                error={errors.date}
                required
              >
                <Input
                  type="date"
                  value={fields.date}
                  onChange={(event) => fields.setDate(event.target.value)}
                />
              </FormField>

              <FormField
                id="transaction-payment-source"
                label={t("transactions.accountOrWallet")}
                error={errors.paymentSourceId}
              >
                <Select
                  value={sources.selectedId}
                  aria-required="true"
                  onChange={(event) => {
                    if (event.target.value === "__create_payment_source__") {
                      sources.setDialogOpen(true);
                    } else {
                      sources.setSelectedId(event.target.value);
                    }
                  }}
                  disabled={sources.isLoading}
                >
                  {!sources.selectedId && (
                    <option value="" disabled>
                      {t("transactions.selectPaymentSource")}
                    </option>
                  )}
                  {sources.available.map((source) => (
                    <option
                      key={source.id}
                      value={source.id}
                      disabled={
                        source.isArchived && source.id !== sources.selectedId
                      }
                    >
                      {paymentSourceName(source, t)}
                      {source.isArchived
                        ? ` (${t("paymentSources.archived")})`
                        : ""}
                    </option>
                  ))}
                  <option value="__create_payment_source__">
                    + {t("paymentSources.quickAdd")}
                  </option>
                </Select>
              </FormField>

              <FormField
                id="transaction-currency"
                label={t("common.currency")}
                required
              >
                <Select
                  value={fields.currency}
                  onChange={(event) => fields.setCurrency(event.target.value)}
                >
                  {SUPPORTED_CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField id="transaction-notes" label={t("common.notes")}>
              <Textarea
                value={fields.notes}
                onChange={(event) => fields.setNotes(event.target.value)}
                rows={3}
              />
            </FormField>
          </div>

          <FieldError message={sources.error} />
          {submitError ? (
            <Alert variant="error" compact>
              {submitError}
            </Alert>
          ) : null}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-card px-5 py-2 md:border-0 md:pb-5 md:pt-0">
          <Button type="button" onClick={onClose} variant="outline">
            {t("common.cancel")}
          </Button>
          <PendingButton
            type="submit"
            isPending={isSaving}
            pendingLabel={t("settings.saving")}
          >
            <span>{t("transactions.save")}</span>
            <kbd
              aria-hidden="true"
              className="ml-1.5 hidden rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-medium tracking-wide sm:inline-block"
            >
              {isMac ? "⌘↵" : "Ctrl+↵"}
            </kbd>
          </PendingButton>
        </div>
      </form>

      <PaymentSourceDialog
        key={
          sources.dialogOpen ? "payment-source-open" : "payment-source-closed"
        }
        open={sources.dialogOpen}
        workspaceId={workspaceId}
        onClose={() => sources.setDialogOpen(false)}
        onSaved={sources.selectCreated}
      />
    </Modal>
  );
}
