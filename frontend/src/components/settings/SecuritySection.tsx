import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import api from "@/lib/api";
import type { User } from "@/contexts/AuthContext";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { PendingButton } from "@/components/ui/pending-button";
import { useFocusOnError } from "@/hooks/useFocusOnError";
interface SecuritySectionProps {
  user: User | null;
  setUser: (user: User | null) => void;
  onSaved: (message: string) => void;
}
interface TwoFactorSetupResponse {
  qrCodeDataUrl: string;
  otpauthUri: string;
}
interface TwoFactorVerifySetupResponse {
  message: string;
  recoveryCodes: string[];
}
export function SecuritySection({
  user,
  setUser,
  onSaved,
}: SecuritySectionProps) {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUpdatingTwoFactor, setIsUpdatingTwoFactor] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    user?.totpEnabled ?? false,
  );
  const [disablePassword, setDisablePassword] = useState("");
  const [setupQrCode, setSetupQrCode] = useState<string | null>(null);
  const [setupToken, setSetupToken] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const passwordFormRef = useFocusOnError(passwordError);
  const disableTwoFactorFormRef = useFocusOnError(twoFactorError);
  const setupTwoFactorFormRef = useFocusOnError(twoFactorError);

  function closePasswordForm() {
    setIsPasswordFormOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
  }
  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordError(t("settings.passwordsRequired"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t("settings.passwordsMismatch"));
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsPasswordFormOpen(false);
      onSaved(t("settings.passwordChanged"));
      window.setTimeout(() => setUser(null), 1500);
    } catch {
      setPasswordError(t("settings.passwordChangeError"));
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleEnableTwoFactor() {
    setIsUpdatingTwoFactor(true);
    setTwoFactorError(null);
    setRecoveryCodes([]);
    try {
      const res = await api.post<TwoFactorSetupResponse>("/auth/2fa/setup");
      setSetupQrCode(res.data.qrCodeDataUrl || res.data.otpauthUri);
    } catch {
      setTwoFactorError(t("settings.twoFactorStartError"));
    } finally {
      setIsUpdatingTwoFactor(false);
    }
  }

  async function handleVerifyTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setupToken.trim()) {
      setTwoFactorError(t("settings.twoFactorCodeRequired"));
      return;
    }

    setIsUpdatingTwoFactor(true);
    setTwoFactorError(null);
    try {
      const res = await api.post<TwoFactorVerifySetupResponse>(
        "/auth/2fa/verify-setup",
        { token: setupToken.trim() },
      );
      setTwoFactorEnabled(true);
      setUser(user ? { ...user, totpEnabled: true } : user);
      setRecoveryCodes(res.data.recoveryCodes);
      setSetupQrCode(null);
      setSetupToken("");
      onSaved(t("settings.twoFactorEnabled"));
    } catch {
      setTwoFactorError(t("settings.twoFactorVerifyError"));
    } finally {
      setIsUpdatingTwoFactor(false);
    }
  }

  async function handleDisableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disablePassword) {
      setTwoFactorError(t("settings.currentPasswordRequired"));
      return;
    }

    setIsUpdatingTwoFactor(true);
    setTwoFactorError(null);
    try {
      await api.post("/auth/2fa/disable", { currentPassword: disablePassword });
      setTwoFactorEnabled(false);
      setUser(user ? { ...user, totpEnabled: false } : user);
      setDisablePassword("");
      onSaved(t("settings.twoFactorDisabled"));
    } catch {
      setTwoFactorError(t("settings.twoFactorDisableError"));
    } finally {
      setIsUpdatingTwoFactor(false);
    }
  }

  return (
    <section className="space-y-6">
      <Card padding="responsive">
        <h2 className="text-lg font-semibold">{t("settings.security")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settings.securityDescription")}
        </p>

        {!isPasswordFormOpen ? (
          <Button
            type="button"
            className="mt-5"
            aria-expanded="false"
            aria-controls="change-password-form"
            onClick={() => setIsPasswordFormOpen(true)}
          >
            {t("settings.changePassword")}
          </Button>
        ) : (
          <form
            ref={passwordFormRef}
            id="change-password-form"
            className="mt-5 max-w-xl space-y-4"
            onSubmit={handlePasswordChange}
          >
            <FormField
              id="current-password"
              label={t("settings.currentPassword")}
              error={
                passwordError === t("settings.passwordsRequired") ||
                passwordError === t("settings.passwordChangeError")
                  ? passwordError
                  : undefined
              }
              required
            >
              <Input
                type="password"
                autoComplete="current-password"
                autoFocus
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </FormField>
            <FormField
              id="new-password"
              label={t("settings.newPassword")}
              error={
                !newPassword &&
                passwordError === t("settings.passwordsRequired")
                  ? passwordError
                  : undefined
              }
              required
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </FormField>
            <FormField
              id="confirm-password"
              label={t("settings.confirmNewPassword")}
              error={
                passwordError === t("settings.passwordsMismatch")
                  ? passwordError
                  : undefined
              }
              required
            >
              <Input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </FormField>
            <div className="flex gap-2">
              <PendingButton
                type="submit"
                isPending={isChangingPassword}
                pendingLabel={t("settings.changing")}
              >
                {t("settings.changePassword")}
              </PendingButton>
              <Button
                type="button"
                variant="outline"
                disabled={isChangingPassword}
                onClick={closePasswordForm}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card padding="responsive">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">
              {t("settings.twoFactor")}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("settings.status", {
                status: t(
                  twoFactorEnabled ? "settings.enabled" : "settings.disabled",
                ),
              })}
            </p>
          </div>
          {!twoFactorEnabled && (
            <PendingButton
              type="button"
              onClick={handleEnableTwoFactor}
              isPending={isUpdatingTwoFactor}
              pendingLabel={t("common.loading")}
            >
              {t("settings.enable2fa")}
            </PendingButton>
          )}
        </div>

        {twoFactorEnabled && (
          <form
            ref={disableTwoFactorFormRef}
            className="mt-5 max-w-xl space-y-4"
            onSubmit={handleDisableTwoFactor}
          >
            <FormField
              id="disable-2fa-password"
              label={t("settings.currentPassword")}
              error={twoFactorError}
              required
            >
              <Input
                type="password"
                value={disablePassword}
                onChange={(event) => setDisablePassword(event.target.value)}
              />
            </FormField>
            <PendingButton
              type="submit"
              variant="outline"
              isPending={isUpdatingTwoFactor}
              pendingLabel={t("settings.saving")}
            >
              {t("settings.disable2fa")}
            </PendingButton>
          </form>
        )}

        {twoFactorError && (
          <Alert variant="error" compact className="mt-4">
            {twoFactorError}
          </Alert>
        )}
        {recoveryCodes.length > 0 && (
          <Card tone="muted" padding="compact" className="mt-4 text-sm">
            <p className="font-medium">{t("settings.recoveryCodes")}</p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {recoveryCodes.map((code) => (
                <li key={code} className="font-mono">
                  {code}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Card>

      {setupQrCode && (
        <Modal
          open
          onClose={() => setSetupQrCode(null)}
          preventClose={isUpdatingTwoFactor}
          ariaLabelledBy="two-factor-title"
          contentClassName="max-w-md"
        >
          <h3 id="two-factor-title" className="text-lg font-semibold">
            {t("settings.setup2fa")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("settings.setupDescription")}
          </p>
          {setupQrCode.startsWith("data:image") ? (
            <img
              src={setupQrCode}
              alt={t("settings.twoFactorQrAlt")}
              className="mx-auto mt-4 h-48 w-48"
            />
          ) : (
            <p className="mt-4 break-all rounded-lg bg-muted p-3 text-xs">
              {setupQrCode}
            </p>
          )}
          <form
            ref={setupTwoFactorFormRef}
            className="mt-4 space-y-4"
            onSubmit={handleVerifyTwoFactor}
          >
            <FormField
              id="setup-2fa-token"
              label={t("settings.authenticatorCode")}
              error={twoFactorError}
              required
            >
              <Input
                value={setupToken}
                onChange={(event) => setSetupToken(event.target.value)}
              />
            </FormField>
            <div className="flex gap-2">
              <PendingButton
                type="submit"
                isPending={isUpdatingTwoFactor}
                pendingLabel={t("auth.verifyingAction")}
              >
                {t("settings.verifyEnable")}
              </PendingButton>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSetupQrCode(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
