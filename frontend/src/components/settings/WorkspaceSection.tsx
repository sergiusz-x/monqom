import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import type { WorkspaceInfo } from "@/hooks/useWorkspace";
import type { AppTranslationKey } from "@/i18n";
import { getApiErrorCode } from "@/lib/api-errors";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { AsyncState } from "@/components/ui/async-state";
import { SectionCard } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/pending-button";
import { Select } from "@/components/ui/select";
import { useFocusOnError } from "@/hooks/useFocusOnError";
const TIMEZONE_OPTIONS = [
  "UTC",
  "Europe/Warsaw",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;
interface WorkspaceSectionProps {
  workspace: WorkspaceInfo | null;
  workspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  onSaved: (workspace: Partial<WorkspaceInfo>, message: string) => void;
  onRetry: () => void;
}
function validateWorkspaceName(name: string): AppTranslationKey | null {
  const normalizedName = name.trim();
  if (normalizedName.length < 2) return "settings.workspaceNameShort";
  if (normalizedName.length > 100) return "settings.workspaceNameLong";
  return null;
}
export function WorkspaceSection({
  workspace,
  workspaceId,
  isLoading,
  error,
  onSaved,
  onRetry,
}: WorkspaceSectionProps) {
  const { t } = useTranslation();
  const [workspaceName, setWorkspaceName] = useState(workspace?.name ?? "");
  const [timezone, setTimezone] = useState(workspace?.timezone ?? "UTC");
  const [baseCurrency, setBaseCurrency] = useState(
    workspace?.baseCurrency ?? "USD",
  );
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const formRef = useFocusOnError(workspaceError);

  async function handleWorkspaceSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) {
      setWorkspaceError(t("settings.noWorkspace"));
      return;
    }
    const nameValidationError = validateWorkspaceName(workspaceName);
    if (nameValidationError) {
      setWorkspaceError(t(nameValidationError));
      return;
    }
    if (!timezone) {
      setWorkspaceError(t("settings.timezoneRequired"));
      return;
    }

    setIsSavingWorkspace(true);
    setWorkspaceError(null);

    try {
      const res = await api.put<Partial<WorkspaceInfo>>(
        `/workspaces/${workspaceId}`,
        {
          name: workspaceName.trim(),
          timezone,
          base_currency: baseCurrency,
        },
      );
      onSaved(res.data, t("settings.workspaceSaved"));
    } catch (error) {
      setWorkspaceError(
        getApiErrorCode(error) === "WORKSPACE_BASE_CURRENCY_LOCKED"
          ? t("settings.baseCurrencyLockedError")
          : t("settings.workspaceSaveError"),
      );
    } finally {
      setIsSavingWorkspace(false);
    }
  }

  return (
    <SectionCard>
      <h2 className="text-lg font-semibold">{t("settings.workspace")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("settings.workspaceDescription")}
      </p>
      {isLoading ? (
        <AsyncState
          status="loading"
          message={t("common.loading")}
          className="mt-5"
        />
      ) : error || !workspace ? (
        <AsyncState
          status="error"
          message={error ?? t("settings.noWorkspace")}
          onRetry={error ? onRetry : undefined}
          className="mt-5"
        />
      ) : (
        <form
          ref={formRef}
          className="mt-5 max-w-xl space-y-4"
          onSubmit={handleWorkspaceSave}
        >
          <FormField
            id="workspace-name"
            label={t("settings.workspaceName")}
            error={workspaceError}
            required
          >
            <Input
              type="text"
              value={workspaceName}
              maxLength={100}
              onChange={(event) => setWorkspaceName(event.target.value)}
            />
          </FormField>
          <FormField
            id="workspace-timezone"
            label={t("settings.timezone")}
            required
          >
            <Select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            >
              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            id="workspace-currency"
            label={t("settings.workspaceCurrency")}
            hint={
              workspace.baseCurrencyLocked
                ? t("settings.baseCurrencyLockedHint")
                : undefined
            }
            required
          >
            <Select
              value={baseCurrency}
              onChange={(event) => setBaseCurrency(event.target.value)}
              disabled={workspace.baseCurrencyLocked}
            >
              {SUPPORTED_CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
          </FormField>{" "}
          <PendingButton
            type="submit"
            isPending={isSavingWorkspace}
            pendingLabel={t("settings.saving")}
          >
            {t("settings.saveWorkspace")}
          </PendingButton>
        </form>
      )}
    </SectionCard>
  );
}
