import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import { usePaymentSources } from "@/hooks/usePaymentSources";
import { useTags } from "@/hooks/useTags";
import { useFocusOnError } from "@/hooks/useFocusOnError";
import { getDateOnlyInTimeZone, normalizeDateOnly } from "@/lib/date-only";
import { majorAmountToMinorUnits, minorUnitsToMajorAmount } from "@/lib/money";
import type { PaymentSource } from "@/types/payment-source";
import type { Transaction } from "@/types/transaction";

export type TransactionFormMode = "create" | "edit";

export interface UseTransactionFormOptions {
  mode: TransactionFormMode;
  workspaceId: string;
  transaction?: Transaction | null;
  defaultCurrency: string;
  defaultPaymentSourceId: string | null;
  defaultTimezone: string;
  onClose: () => void;
  onSaved: (result: { paymentSourceId: string | null }) => void;
}

export interface TransactionFormErrors {
  amount?: string;
  description?: string;
  date?: string;
  categoryId?: string;
  paymentSourceId?: string;
}

export function useTransactionForm({
  mode,
  workspaceId,
  transaction,
  defaultCurrency,
  defaultPaymentSourceId,
  defaultTimezone,
  onClose,
  onSaved,
}: UseTransactionFormOptions) {
  const { t } = useTranslation();
  const isEdit = mode === "edit";
  const { tags: workspaceTags } = useTags(workspaceId);
  const {
    paymentSources,
    isLoading: paymentSourcesLoading,
    error: paymentSourcesError,
  } = usePaymentSources(workspaceId, isEdit);
  const [amountMinorUnits, setAmountMinorUnits] = useState<number | null>(() =>
    isEdit && transaction ? majorAmountToMinorUnits(transaction.amount) : null,
  );
  const [currency, setCurrency] = useState(
    () => transaction?.currency ?? defaultCurrency,
  );
  const [date, setDate] = useState(() =>
    isEdit && transaction
      ? (normalizeDateOnly(transaction.date) ?? "")
      : getDateOnlyInTimeZone(new Date(), defaultTimezone),
  );
  const [description, setDescription] = useState(() =>
    isEdit && transaction ? transaction.description : "",
  );
  const [categoryId, setCategoryId] = useState<string | null>(() =>
    isEdit && transaction ? transaction.categoryId : null,
  );
  const [notes, setNotes] = useState(() =>
    isEdit && transaction ? (transaction.notes ?? "") : "",
  );
  const [selectedTags, setSelectedTags] = useState<string[]>(() =>
    transaction?.tags ? [...transaction.tags] : [],
  );
  const [paymentSourceId, setPaymentSourceId] = useState(() =>
    isEdit && transaction
      ? (transaction.paymentSourceId ?? "")
      : (defaultPaymentSourceId ?? ""),
  );
  const [advancedOpen, setAdvancedOpen] = useState(
    Boolean(
      isEdit &&
      transaction &&
      (transaction.notes ||
        transaction.tags.length > 0 ||
        transaction.currency !== defaultCurrency),
    ),
  );
  const [errors, setErrors] = useState<TransactionFormErrors>({});
  const formRef = useFocusOnError(
    errors.amount ??
      errors.description ??
      errors.date ??
      errors.paymentSourceId ??
      errors.categoryId,
  );
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [paymentSourceDialogOpen, setPaymentSourceDialogOpen] = useState(false);
  const [createdPaymentSource, setCreatedPaymentSource] =
    useState<PaymentSource | null>(null);

  const availablePaymentSources = createdPaymentSource
    ? [
        ...paymentSources.filter(
          (source) => source.id !== createdPaymentSource.id,
        ),
        createdPaymentSource,
      ]
    : paymentSources;
  const cashPaymentSource = availablePaymentSources.find(
    (source) => source.systemKey === "cash" && !source.isArchived,
  );
  const preferredPaymentSourceId =
    paymentSourceId || defaultPaymentSourceId || cashPaymentSource?.id || "";
  const selectedPaymentSourceId = availablePaymentSources.some(
    (source) => source.id === preferredPaymentSourceId && !source.isArchived,
  )
    ? preferredPaymentSourceId
    : isEdit &&
        transaction?.paymentSourceId === preferredPaymentSourceId &&
        availablePaymentSources.some(
          (source) => source.id === preferredPaymentSourceId,
        )
      ? preferredPaymentSourceId
      : (cashPaymentSource?.id ?? "");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: TransactionFormErrors = {};
    if (amountMinorUnits === null || amountMinorUnits <= 0) {
      nextErrors.amount = t("budgets.positiveAmount");
    }
    if (!date) nextErrors.date = t("transactions.dateRequired");
    if (!description.trim()) {
      nextErrors.description = t("transactions.descriptionRequired");
    } else if (description.trim().length > 200) {
      nextErrors.description = t("transactions.descriptionTooLong");
    }
    if (!categoryId) {
      nextErrors.categoryId = t("transactions.categoryRequired");
    }
    if (!selectedPaymentSourceId) {
      nextErrors.paymentSourceId = t("paymentSources.required");
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setIsSaving(true);
    const payload = {
      amount: minorUnitsToMajorAmount(amountMinorUnits!),
      currency,
      date,
      description: description.trim(),
      category_id: categoryId,
      notes: notes.trim() || null,
      tags: selectedTags,
      payment_source_id: selectedPaymentSourceId,
    };

    try {
      if (isEdit && transaction) {
        await api.put(
          `/workspaces/${workspaceId}/transactions/${transaction.id}`,
          payload,
        );
      } else {
        await api.post(`/workspaces/${workspaceId}/transactions`, payload);
      }
      onSaved({ paymentSourceId: selectedPaymentSourceId });
      onClose();
    } catch {
      setSubmitError(t("transactions.saveError"));
    } finally {
      setIsSaving(false);
    }
  }

  return {
    isEdit,
    formRef,
    handleSubmit,
    errors,
    submitError,
    isSaving,
    fields: {
      amountMinorUnits,
      setAmountMinorUnits,
      currency,
      setCurrency,
      date,
      setDate,
      description,
      setDescription,
      categoryId,
      setCategoryId,
      notes,
      setNotes,
      selectedTags,
      setSelectedTags,
    },
    advanced: {
      open: advancedOpen,
      setOpen: setAdvancedOpen,
      workspaceTags,
    },
    sources: {
      available: availablePaymentSources,
      selectedId: selectedPaymentSourceId,
      setSelectedId: setPaymentSourceId,
      isLoading: paymentSourcesLoading,
      error: paymentSourcesError,
      dialogOpen: paymentSourceDialogOpen,
      setDialogOpen: setPaymentSourceDialogOpen,
      selectCreated(source: PaymentSource) {
        setCreatedPaymentSource(source);
        setPaymentSourceId(source.id);
      },
    },
  };
}
