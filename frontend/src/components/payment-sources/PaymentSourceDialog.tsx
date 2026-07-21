import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  PAYMENT_SOURCE_TYPES,
  paymentSourceTypeLabel,
} from "@/lib/payment-sources";
import type { PaymentSource, PaymentSourceType } from "@/types/payment-source";
import type { ApiPaymentSource } from "@/types/api-contracts";
import { mapPaymentSource } from "@/lib/api-mappers";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import { useFocusOnError } from "@/hooks/useFocusOnError";
import { queryKeys } from "@/lib/query-client";

interface PaymentSourceDialogProps {
  open: boolean;
  workspaceId: string;
  source?: PaymentSource | null;
  onClose: () => void;
  onSaved: (source: PaymentSource) => void;
}

export function PaymentSourceDialog({
  open,
  workspaceId,
  source = null,
  onClose,
  onSaved,
}: PaymentSourceDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [name, setName] = useState(source?.name ?? "");
  const [type, setType] = useState<PaymentSourceType>(source?.type ?? "other");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const formRef = useFocusOnError(error);

  if (!open) return null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = name.trim();
    if (!normalizedName) {
      setError(t("paymentSources.nameRequired"));
      return;
    }
    if (normalizedName.length > 100) {
      setError(t("paymentSources.nameTooLong"));
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const response = source
        ? await api.put<ApiPaymentSource>(
            `/workspaces/${workspaceId}/payment-sources/${source.id}`,
            { name: normalizedName, type },
          )
        : await api.post<ApiPaymentSource>(
            `/workspaces/${workspaceId}/payment-sources`,
            { name: normalizedName, type },
          );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.paymentSourcesRoot(workspaceId),
      });
      onSaved(mapPaymentSource(response.data));
      onClose();
    } catch {
      setError(t("paymentSources.saveError"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      preventClose={isSaving}
      ariaLabelledBy="payment-source-dialog-title"
      contentClassName="max-w-md"
      layer="nested"
    >
      <h2 id="payment-source-dialog-title" className="text-lg font-semibold">
        {t(source ? "paymentSources.edit" : "paymentSources.add")}
      </h2>
      <form ref={formRef} className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <FormField
          id="payment-source-name"
          label={t("paymentSources.name")}
          error={error}
          required
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            maxLength={100}
          />
        </FormField>
        <FormField
          id="payment-source-type"
          label={t("paymentSources.type")}
          required
        >
          <Select
            value={type}
            onChange={(event) =>
              setType(event.target.value as PaymentSourceType)
            }
          >
            {PAYMENT_SOURCE_TYPES.map((option) => (
              <option key={option} value={option}>
                {paymentSourceTypeLabel(option, t)}
              </option>
            ))}
          </Select>
        </FormField>
        {error && !name.trim() ? null : error ? (
          <Alert variant="error" compact>
            {error}
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
            {t("common.save")}
          </PendingButton>
        </div>
      </form>
    </Modal>
  );
}
