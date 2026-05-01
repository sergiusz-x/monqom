import { useState } from "react";
import api from "@/lib/api";
import { CategorySelector } from "@/components/CategorySelector";
import { usePaymentSources } from "@/hooks/usePaymentSources";

type Mode = "create" | "edit";

interface EditableTransaction {
  id: string;
  amount: number;
  date: string;
  category_id: string;
  notes: string | null;
  tags: string[];
  payment_source_id: string | null;
}

interface TransactionFormModalProps {
  open: boolean;
  mode: Mode;
  workspaceId: string;
  transaction?: EditableTransaction | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormErrors {
  amount?: string;
  date?: string;
  categoryId?: string;
}

function toIsoDateString(value: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function parseAmountToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
  return Number.isFinite(cents) ? cents : null;
}

function formatAmountInput(value: string): string {
  const cents = parseAmountToCents(value);
  if (cents === null) return value;
  return (cents / 100).toFixed(2);
}

function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  );
}

export function TransactionFormModal({
  open,
  mode,
  workspaceId,
  transaction,
  onClose,
  onSaved,
}: TransactionFormModalProps) {
  const isEdit = mode === "edit";
  const { paymentSources, error: paymentSourcesError } =
    usePaymentSources(workspaceId);
  const [amountInput, setAmountInput] = useState(() => {
    if (isEdit && transaction) return transaction.amount.toFixed(2);
    return "";
  });
  const [date, setDate] = useState(() => {
    if (isEdit && transaction) return toIsoDateString(transaction.date);
    return new Date().toISOString().slice(0, 10);
  });
  const [categoryId, setCategoryId] = useState<string | null>(() => {
    if (isEdit && transaction) return transaction.category_id;
    return null;
  });
  const [notes, setNotes] = useState(() => {
    if (isEdit && transaction) return transaction.notes ?? "";
    return "";
  });
  const [tagsInput, setTagsInput] = useState(() => {
    if (isEdit && transaction) return transaction.tags.join(", ");
    return "";
  });
  const [paymentSourceId, setPaymentSourceId] = useState(() => {
    if (isEdit && transaction) return transaction.payment_source_id ?? "";
    return "";
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const nextErrors: FormErrors = {};
    const amountCents = parseAmountToCents(amountInput);

    if (amountCents === null || amountCents <= 0) {
      nextErrors.amount = "Enter a valid amount greater than 0.";
    }
    if (!date) {
      nextErrors.date = "Date is required.";
    }
    if (!categoryId) {
      nextErrors.categoryId = "Category is required.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSubmitError(null);
    setIsSaving(true);

    const payload = {
      amount: amountCents! / 100,
      date,
      category_id: categoryId,
      notes: notes.trim() || null,
      tags: parseTags(tagsInput),
      payment_source_id: paymentSourceId || null,
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
      onSaved();
      onClose();
    } catch {
      setSubmitError("Failed to save transaction. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? "Edit transaction" : "Add transaction"}
    >
      <div className="w-full max-w-xl rounded-xl bg-background p-5 shadow-lg">
        <h2 className="text-lg font-semibold">
          {isEdit ? "Edit transaction" : "Add transaction"}
        </h2>
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1 text-sm" htmlFor="transaction-amount">
              <span>Amount</span>
              <input
                id="transaction-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                onBlur={() =>
                  setAmountInput((value) => formatAmountInput(value))
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
              {errors.amount && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.amount}
                </p>
              )}
            </label>

            <label className="space-y-1 text-sm" htmlFor="transaction-date">
              <span>Date</span>
              <input
                id="transaction-date"
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              />
              {errors.date && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.date}
                </p>
              )}
            </label>
          </div>

          <div className="space-y-1 text-sm">
            <span className="block">Category</span>
            <CategorySelector
              workspaceId={workspaceId}
              value={categoryId}
              onChange={setCategoryId}
            />
            {errors.categoryId && (
              <p className="text-xs text-destructive" role="alert">
                {errors.categoryId}
              </p>
            )}
          </div>

          <label
            className="space-y-1 text-sm"
            htmlFor="transaction-payment-source"
          >
            <span>Payment source</span>
            <select
              id="transaction-payment-source"
              value={paymentSourceId}
              onChange={(event) => setPaymentSourceId(event.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            >
              <option value="">None</option>
              {paymentSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
            {paymentSourcesError && (
              <p className="text-xs text-destructive" role="alert">
                {paymentSourcesError}
              </p>
            )}
          </label>

          <label className="space-y-1 text-sm" htmlFor="transaction-tags">
            <span>Tags</span>
            <input
              id="transaction-tags"
              value={tagsInput}
              onChange={(event) => setTagsInput(event.target.value)}
              placeholder="Food, Groceries"
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>

          <label className="space-y-1 text-sm" htmlFor="transaction-notes">
            <span>Notes</span>
            <textarea
              id="transaction-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2"
            />
          </label>

          {submitError && (
            <div
              className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save transaction"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
