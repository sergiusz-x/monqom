import { useTranslation } from "react-i18next";
import { CategorySelector } from "@/components/CategorySelector";
import { PaymentSourceDialog } from "@/components/payment-sources/PaymentSourceDialog";
import { TransactionTagSelector } from "@/components/transactions/TransactionTagSelector";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { MoneyInput } from "@/components/ui/money-input";
import { PendingButton } from "@/components/ui/pending-button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useTransactionForm } from "@/hooks/useTransactionForm";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { paymentSourceName } from "@/lib/payment-sources";
import type { Transaction } from "@/types/transaction";
import type { TransactionFormMode } from "@/hooks/useTransactionForm";

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
  const {
    isEdit,
    formRef,
    handleSubmit,
    errors,
    submitError,
    isSaving,
    fields,
    sources,
    advanced,
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

  return (
    <Modal
      open
      onClose={onClose}
      preventClose={isSaving}
      ariaLabel={isEdit ? t("transactions.edit") : t("transactions.add")}
      contentClassName="max-w-lg"
    >
      <h2 className="text-lg font-semibold">
        {isEdit ? t("transactions.edit") : t("transactions.add")}
      </h2>
      <form ref={formRef} className="mt-4 space-y-4" onSubmit={handleSubmit}>
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
            label={t("common.paymentSource")}
            error={errors.paymentSourceId}
            required
          >
            <Select
              value={sources.selectedId}
              onChange={(event) => sources.setSelectedId(event.target.value)}
              disabled={sources.isLoading}
            >
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
            </Select>
            <Button
              type="button"
              onClick={() => sources.setDialogOpen(true)}
              variant="link"
              size="xs"
              className="h-auto px-0"
            >
              {t("paymentSources.quickAdd")}
            </Button>
          </FormField>
        </div>

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
          />
        </FormField>

        <Button
          type="button"
          aria-expanded={advanced.open}
          onClick={() => advanced.setOpen((current) => !current)}
          variant="outline"
          className="flex w-full items-center justify-between"
        >
          <span>{t("transactions.advanced")}</span>
          <span aria-hidden="true">{advanced.open ? "-" : "+"}</span>
        </Button>

        {advanced.open ? (
          <Card tone="muted" className="space-y-4">
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

            <FormField id="transaction-notes" label={t("common.notes")}>
              <Textarea
                value={fields.notes}
                onChange={(event) => fields.setNotes(event.target.value)}
                rows={3}
              />
            </FormField>

            <div className="space-y-1 text-sm">
              <span className="block">{t("common.tags")}</span>
              <TransactionTagSelector
                availableTags={advanced.workspaceTags}
                value={fields.selectedTags}
                onChange={fields.setSelectedTags}
              />
            </div>
          </Card>
        ) : null}

        <FieldError message={sources.error} />
        {submitError ? (
          <Alert variant="error" compact>
            {submitError}
          </Alert>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose} variant="outline">
            {t("common.cancel")}
          </Button>
          <PendingButton
            type="submit"
            isPending={isSaving}
            pendingLabel={t("settings.saving")}
          >
            {t("transactions.save")}
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
