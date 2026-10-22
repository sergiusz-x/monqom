import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  PendingButton,
} from "@monqom/ui";
import type { User } from "@/contexts/AuthContext";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-errors";
import {
  deleteIntegrationCredential,
  revokeIntegrationCredential,
} from "@/lib/integration-credentials";
import type { Integration, IntegrationCredential } from "@/types/integration";
import { useCredentialRequest } from "./useCredentialRequest";

export function IntegrationActionDialog({
  kind,
  workspaceId,
  integration,
  credential,
  user,
  onClose,
  returnFocus,
  onCompleted,
}: {
  kind: "revoke" | "delete";
  workspaceId: string;
  integration: Integration;
  credential: IntegrationCredential;
  user: User;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null;
  onCompleted: () => void;
}) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const request = useCredentialRequest();
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (
      kind === "revoke" &&
      (!password || (user.totpEnabled && !twoFactor.trim()))
    ) {
      setError(
        t(
          user.totpEnabled
            ? "integrations.stepUpRequired"
            : "integrations.passwordRequired",
        ),
      );
      return;
    }
    const controller = request.begin();
    if (!controller) return;
    setSaving(true);
    setError(null);
    const stepUp = {
      currentPassword: password,
      twoFactorToken: twoFactor.trim() || undefined,
    };
    setPassword("");
    setTwoFactor("");
    try {
      if (kind === "revoke")
        await revokeIntegrationCredential(
          workspaceId,
          integration.id,
          credential.id,
          stepUp,
          controller.signal,
        );
      else
        await deleteIntegrationCredential(
          workspaceId,
          integration.id,
          credential.id,
          controller.signal,
        );
      if (request.isCurrent(controller)) onCompleted();
    } catch (cause) {
      if (request.isCurrent(controller))
        setError(
          getApiErrorStatus(cause) === 401
            ? t("integrations.stepUpFailed")
            : getApiErrorMessage(cause),
        );
    } finally {
      if (request.isCurrent(controller)) setSaving(false);
      request.finish(controller);
    }
  }
  return (
    <Modal
      open
      finalFocus={returnFocus}
      onClose={onClose}
      preventClose={saving}
      ariaLabelledBy="integration-action-title"
      contentClassName="flex max-w-md flex-col overflow-hidden"
    >
      <h3
        id="integration-action-title"
        className="shrink-0 text-lg font-semibold"
      >
        {t(
          kind === "revoke"
            ? "integrations.confirmRevoke"
            : "integrations.confirmDelete",
        )}
      </h3>
      <form
        onSubmit={submit}
        className="mt-4 flex min-h-0 flex-col"
        aria-busy={saving}
      >
        <div className="min-h-0 overflow-y-auto overscroll-contain pr-2">
          <p className="mt-2 break-words text-sm">
            {integration.name}
            <code className="mt-1 block text-muted-foreground">
              {credential.tokenPrefix}
            </code>
          </p>
          <Alert variant="warning" compact className="mt-4">
            {t(
              kind === "revoke"
                ? "integrations.revokeWarning"
                : "integrations.deleteWarning",
            )}
          </Alert>
          {error && (
            <div ref={errorRef} tabIndex={-1} className="mt-4 outline-none">
              <Alert variant="error" compact>
                {error}
              </Alert>
            </div>
          )}
          {kind === "revoke" && (
            <fieldset disabled={saving} className="mt-4 space-y-4">
              <FormField
                id="integration-action-password"
                label={t("settings.currentPassword")}
                required
              >
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  maxLength={1024}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </FormField>
              {user.totpEnabled && (
                <FormField
                  id="integration-action-2fa"
                  label={t("integrations.twoFactor")}
                  required
                >
                  <Input
                    required
                    autoComplete="one-time-code"
                    spellCheck={false}
                    autoCapitalize="none"
                    maxLength={128}
                    value={twoFactor}
                    onChange={(event) => setTwoFactor(event.target.value)}
                  />
                </FormField>
              )}
            </fieldset>
          )}
        </div>
        <div className="mt-4 flex shrink-0 flex-wrap gap-2 border-t border-border pt-4">
          <PendingButton
            type="submit"
            isPending={saving}
            pendingLabel={t("settings.saving")}
          >
            {t(
              kind === "revoke"
                ? "integrations.confirmRevoke"
                : "integrations.confirmDelete",
            )}
          </PendingButton>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
