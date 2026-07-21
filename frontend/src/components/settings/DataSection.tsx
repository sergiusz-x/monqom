import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import type { User } from "@/contexts/AuthContext";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PendingButton } from "@/components/ui/pending-button";
import { useFocusOnError } from "@/hooks/useFocusOnError";
interface DataSectionProps {
  workspaceId: string | null;
  setUser: (user: User | null) => void;
  onSaved: (message: string) => void;
}
export function DataSection({
  workspaceId,
  setUser,
  onSaved,
}: DataSectionProps) {
  const { t } = useTranslation();
  const [dataError, setDataError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"csv" | "json" | null>(
    null,
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteFormRef = useFocusOnError(dataError);

  async function handleExport(format: "csv" | "json") {
    if (!workspaceId) {
      setDataError(t("settings.noWorkspace"));
      return;
    }

    setExportingFormat(format);
    setDataError(null);
    try {
      const res = await api.get<Blob>(`/workspaces/${workspaceId}/export`, {
        params: { format },
        responseType: "blob",
      });
      const blob = res.data instanceof Blob ? res.data : new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `monqom-export.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 100);
      onSaved(t("settings.exportStarted", { format: format.toUpperCase() }));
    } catch {
      setDataError(t("settings.exportError", { format: format.toUpperCase() }));
    } finally {
      setExportingFormat(null);
    }
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleteConfirmation !== "DELETE") {
      setDataError(t("settings.deleteTypeError"));
      return;
    }

    setIsDeleting(true);
    setDataError(null);
    try {
      await api.delete("/users/me");
      setUser(null);
      onSaved(t("settings.accountDeleted"));
    } catch {
      setDataError(t("settings.accountDeleteError"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <SectionCard>
      <h2 className="text-lg font-semibold">{t("settings.data")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("settings.dataDescription")}
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <PendingButton
          type="button"
          variant="outline"
          onClick={() => handleExport("csv")}
          disabled={exportingFormat !== null}
          isPending={exportingFormat === "csv"}
          pendingLabel={t("settings.exporting", { format: "CSV" })}
        >
          {t("settings.export", { format: "CSV" })}
        </PendingButton>
        <PendingButton
          type="button"
          variant="outline"
          onClick={() => handleExport("json")}
          disabled={exportingFormat !== null}
          isPending={exportingFormat === "json"}
          pendingLabel={t("settings.exporting", { format: "JSON" })}
        >
          {t("settings.export", { format: "JSON" })}
        </PendingButton>
      </div>

      <Card tone="danger" className="mt-6">
        <h3 className="font-semibold text-destructive">
          {t("settings.deleteAccount")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.deleteDescription")}
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-4"
          onClick={() => setDeleteConfirmOpen(true)}
        >
          {t("settings.deleteAccount")}
        </Button>
      </Card>

      {dataError && !deleteConfirmOpen && (
        <Alert variant="error" compact className="mt-4">
          {dataError}
        </Alert>
      )}

      {deleteConfirmOpen && (
        <Modal
          open
          onClose={() => setDeleteConfirmOpen(false)}
          preventClose={isDeleting}
          ariaLabelledBy="delete-account-title"
          contentClassName="max-w-md"
        >
          <h3
            id="delete-account-title"
            className="text-lg font-semibold text-destructive"
          >
            {t("settings.confirmDeletion")}
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("settings.typeDelete")}
          </p>
          <form
            ref={deleteFormRef}
            className="mt-4 space-y-4"
            onSubmit={handleDeleteAccount}
          >
            <FormField
              id="delete-account-confirmation"
              label={t("settings.deletionConfirmation")}
              error={dataError}
              required
            >
              <Input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
              />
            </FormField>
            <div className="flex gap-2">
              <PendingButton
                type="submit"
                variant="destructive"
                isPending={isDeleting}
                pendingLabel={t("settings.deleting")}
              >
                {t("settings.confirmDelete")}
              </PendingButton>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteConfirmOpen(false)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </SectionCard>
  );
}
