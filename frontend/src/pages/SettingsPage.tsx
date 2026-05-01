import { useEffect, useState, type FormEvent } from "react";
import api from "@/lib/api";
import { useAuth, type User } from "@/contexts/AuthContext";
import { useWorkspace, type WorkspaceInfo } from "@/hooks/useWorkspace";
import { Button } from "@/components/ui/button";

const TIMEZONE_OPTIONS = [
  "UTC",
  "Europe/Warsaw",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

type ActiveSection = "profile" | "workspace" | "security" | "data";

interface ProfileSectionProps {
  user: User | null;
  setUser: (user: User | null) => void;
  onSaved: (message: string) => void;
}

interface WorkspaceSectionProps {
  workspace: WorkspaceInfo | null;
  workspaceId: string | null;
  isLoading: boolean;
  error: string | null;
  onSaved: (workspace: WorkspaceInfo, message: string) => void;
}

interface SecuritySectionProps {
  user: User | null;
  setUser: (user: User | null) => void;
  onSaved: (message: string) => void;
}

interface DataSectionProps {
  workspaceId: string | null;
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

function validateDisplayName(name: string): string | null {
  const normalizedName = name.trim();
  if (normalizedName.length === 0) return "Display name is required";
  if (normalizedName.length < 2) {
    return "Display name must be at least 2 characters";
  }
  if (normalizedName.length > 100) {
    return "Display name must be 100 characters or fewer";
  }
  return null;
}

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const { workspace, workspaceId, isLoading, error } = useWorkspace();
  const [activeSection, setActiveSection] = useState<ActiveSection>("profile");
  const [savedWorkspace, setSavedWorkspace] = useState<WorkspaceInfo | null>(
    null,
  );
  const currentWorkspace = savedWorkspace ?? workspace;
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeoutId = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account and workspace settings.
        </p>
      </div>

      <div className="grid rounded-lg border border-border bg-muted/40 p-1 sm:w-fit sm:grid-cols-4">
        {[
          ["profile", "Profile"],
          ["workspace", "Workspace"],
          ["security", "Security"],
          ["data", "Data"],
        ].map(([section, label]) => (
          <button
            key={section}
            type="button"
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              activeSection === section
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveSection(section as ActiveSection)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeSection === "profile" ? (
        <ProfileSection
          key={user?.id ?? "anonymous"}
          user={user}
          setUser={setUser}
          onSaved={setToast}
        />
      ) : activeSection === "workspace" ? (
        <WorkspaceSection
          key={currentWorkspace?.id ?? "missing-workspace"}
          workspace={currentWorkspace}
          workspaceId={workspaceId}
          isLoading={isLoading}
          error={error}
          onSaved={(nextWorkspace, message) => {
            setSavedWorkspace(nextWorkspace);
            setToast(message);
          }}
        />
      ) : activeSection === "security" ? (
        <SecuritySection user={user} setUser={setUser} onSaved={setToast} />
      ) : (
        <DataSection
          workspaceId={workspaceId}
          setUser={setUser}
          onSaved={setToast}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-20 right-4 z-50 rounded-lg bg-foreground px-4 py-2 text-sm text-background shadow-lg md:bottom-4"
          role="status"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function SecuritySection({ user, setUser, onSaved }: SecuritySectionProps) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isUpdatingTwoFactor, setIsUpdatingTwoFactor] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(
    user?.totpEnabled ?? false,
  );
  const [disablePassword, setDisablePassword] = useState("");
  const [setupQrCode, setSetupQrCode] = useState<string | null>(null);
  const [setupToken, setSetupToken] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordError("Current and new password are required");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setIsChangingPassword(true);
    setPasswordError(null);
    try {
      await api.post("/auth/change-password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      onSaved("Password changed. Please sign in again on other devices.");
    } catch {
      setPasswordError("Failed to change password");
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
      setTwoFactorError("Failed to start 2FA setup");
    } finally {
      setIsUpdatingTwoFactor(false);
    }
  }

  async function handleVerifyTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setupToken.trim()) {
      setTwoFactorError("Enter the 2FA code from your authenticator app");
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
      onSaved("Two-factor authentication enabled");
    } catch {
      setTwoFactorError("Failed to verify 2FA code");
    } finally {
      setIsUpdatingTwoFactor(false);
    }
  }

  async function handleDisableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disablePassword) {
      setTwoFactorError("Current password is required to disable 2FA");
      return;
    }

    setIsUpdatingTwoFactor(true);
    setTwoFactorError(null);
    try {
      await api.post("/auth/2fa/disable", { currentPassword: disablePassword });
      setTwoFactorEnabled(false);
      setUser(user ? { ...user, totpEnabled: false } : user);
      setDisablePassword("");
      onSaved("Two-factor authentication disabled");
    } catch {
      setTwoFactorError("Failed to disable 2FA");
    } finally {
      setIsUpdatingTwoFactor(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Change your password and manage two-factor authentication.
        </p>

        <form
          className="mt-5 max-w-xl space-y-4"
          onSubmit={handlePasswordChange}
        >
          <div>
            <label
              htmlFor="current-password"
              className="mb-1 block text-sm font-medium"
            >
              Current password
            </label>
            <input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div>
            <label
              htmlFor="new-password"
              className="mb-1 block text-sm font-medium"
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1 block text-sm font-medium"
            >
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          {passwordError && (
            <p className="text-sm text-destructive" role="alert">
              {passwordError}
            </p>
          )}
          <Button type="submit" disabled={isChangingPassword}>
            {isChangingPassword ? "Changing..." : "Change password"}
          </Button>
        </form>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold">
              Two-factor authentication
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Status: {twoFactorEnabled ? "Enabled" : "Disabled"}
            </p>
          </div>
          {!twoFactorEnabled && (
            <Button
              type="button"
              onClick={handleEnableTwoFactor}
              disabled={isUpdatingTwoFactor}
            >
              {isUpdatingTwoFactor ? "Starting..." : "Enable 2FA"}
            </Button>
          )}
        </div>

        {twoFactorEnabled && (
          <form
            className="mt-5 max-w-xl space-y-4"
            onSubmit={handleDisableTwoFactor}
          >
            <div>
              <label
                htmlFor="disable-2fa-password"
                className="mb-1 block text-sm font-medium"
              >
                Current password
              </label>
              <input
                id="disable-2fa-password"
                type="password"
                value={disablePassword}
                onChange={(event) => setDisablePassword(event.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={isUpdatingTwoFactor}
            >
              {isUpdatingTwoFactor ? "Disabling..." : "Disable 2FA"}
            </Button>
          </form>
        )}

        {twoFactorError && (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {twoFactorError}
          </p>
        )}
        {recoveryCodes.length > 0 && (
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">Save these recovery codes now:</p>
            <ul className="mt-2 grid gap-1 sm:grid-cols-2">
              {recoveryCodes.map((code) => (
                <li key={code} className="font-mono">
                  {code}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {setupQrCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div
            className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="two-factor-title"
          >
            <h3 id="two-factor-title" className="text-lg font-semibold">
              Set up 2FA
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Scan the QR code, then enter the 6-digit code.
            </p>
            {setupQrCode.startsWith("data:image") ? (
              <img
                src={setupQrCode}
                alt="2FA setup QR code"
                className="mx-auto mt-4 h-48 w-48"
              />
            ) : (
              <p className="mt-4 break-all rounded-lg bg-muted p-3 text-xs">
                {setupQrCode}
              </p>
            )}
            <form className="mt-4 space-y-4" onSubmit={handleVerifyTwoFactor}>
              <div>
                <label
                  htmlFor="setup-2fa-token"
                  className="mb-1 block text-sm font-medium"
                >
                  Authenticator code
                </label>
                <input
                  id="setup-2fa-token"
                  value={setupToken}
                  onChange={(event) => setSetupToken(event.target.value)}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={isUpdatingTwoFactor}>
                  {isUpdatingTwoFactor ? "Verifying..." : "Verify and enable"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSetupQrCode(null)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function DataSection({ workspaceId, setUser, onSaved }: DataSectionProps) {
  const [dataError, setDataError] = useState<string | null>(null);
  const [exportingFormat, setExportingFormat] = useState<"csv" | "json" | null>(
    null,
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleExport(format: "csv" | "json") {
    if (!workspaceId) {
      setDataError("No workspace found");
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
      window.URL.revokeObjectURL(url);
      onSaved(`${format.toUpperCase()} export started`);
    } catch {
      setDataError(`Failed to export ${format.toUpperCase()} data`);
    } finally {
      setExportingFormat(null);
    }
  }

  async function handleDeleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleteConfirmation !== "DELETE") {
      setDataError("Type DELETE to confirm account deletion");
      return;
    }

    setIsDeleting(true);
    setDataError(null);
    try {
      await api.delete("/users/me");
      setUser(null);
      onSaved("Account deleted");
    } catch {
      setDataError("Failed to delete account");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Data</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Export your data or permanently delete your account.
      </p>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleExport("csv")}
          disabled={exportingFormat !== null}
        >
          {exportingFormat === "csv" ? "Exporting CSV..." : "Export CSV"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleExport("json")}
          disabled={exportingFormat !== null}
        >
          {exportingFormat === "json" ? "Exporting JSON..." : "Export JSON"}
        </Button>
      </div>

      <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <h3 className="font-semibold text-destructive">Delete account</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          This permanently deletes your sessions, workspaces, and financial
          data.
        </p>
        <Button
          type="button"
          variant="destructive"
          className="mt-4"
          onClick={() => setDeleteConfirmOpen(true)}
        >
          Delete account
        </Button>
      </div>

      {dataError && (
        <p className="mt-4 text-sm text-destructive" role="alert">
          {dataError}
        </p>
      )}

      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <div
            className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <h3
              id="delete-account-title"
              className="text-lg font-semibold text-destructive"
            >
              Confirm account deletion
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Type DELETE to permanently delete your account.
            </p>
            <form className="mt-4 space-y-4" onSubmit={handleDeleteAccount}>
              <input
                aria-label="Deletion confirmation"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Confirm delete"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

function ProfileSection({ user, setUser, onSaved }: ProfileSectionProps) {
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateDisplayName(displayName);
    if (validationError) {
      setProfileError(validationError);
      return;
    }

    setIsSavingProfile(true);
    setProfileError(null);

    try {
      const res = await api.put<User>("/users/me", {
        name: displayName.trim(),
      });
      setUser(res.data);
      onSaved("Profile saved");
    } catch {
      setProfileError("Failed to save profile");
    } finally {
      setIsSavingProfile(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Profile</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Update the display name shown in Monqom.
      </p>
      <form className="mt-5 max-w-xl space-y-4" onSubmit={handleProfileSave}>
        <div>
          <label
            htmlFor="display-name"
            className="mb-1 block text-sm font-medium"
          >
            Display name
          </label>
          <input
            id="display-name"
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-invalid={profileError ? true : undefined}
          />
        </div>
        {profileError && (
          <p className="text-sm text-destructive" role="alert">
            {profileError}
          </p>
        )}
        <Button type="submit" disabled={isSavingProfile}>
          {isSavingProfile ? "Saving..." : "Save profile"}
        </Button>
      </form>
    </section>
  );
}

function WorkspaceSection({
  workspace,
  workspaceId,
  isLoading,
  error,
  onSaved,
}: WorkspaceSectionProps) {
  const [timezone, setTimezone] = useState(workspace?.timezone ?? "UTC");
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);

  async function handleWorkspaceSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workspaceId) {
      setWorkspaceError("No workspace found");
      return;
    }
    if (!timezone) {
      setWorkspaceError("Timezone is required");
      return;
    }

    setIsSavingWorkspace(true);
    setWorkspaceError(null);

    try {
      const res = await api.put<WorkspaceInfo>(`/workspaces/${workspaceId}`, {
        timezone,
      });
      onSaved(res.data, "Workspace saved");
    } catch {
      setWorkspaceError("Failed to save workspace");
    } finally {
      setIsSavingWorkspace(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 sm:p-6">
      <h2 className="text-lg font-semibold">Workspace</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure timezone behavior for dates and reports.
      </p>
      {isLoading ? (
        <div className="mt-5 text-sm text-muted-foreground" role="status">
          Loading workspace...
        </div>
      ) : error || !workspace ? (
        <div className="mt-5 text-sm text-destructive" role="alert">
          {error ?? "No workspace found"}
        </div>
      ) : (
        <form
          className="mt-5 max-w-xl space-y-4"
          onSubmit={handleWorkspaceSave}
        >
          <div>
            <p className="mb-1 text-sm font-medium">Workspace name</p>
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              {workspace.name}
            </p>
          </div>
          <div>
            <label
              htmlFor="workspace-timezone"
              className="mb-1 block text-sm font-medium"
            >
              Timezone
            </label>
            <select
              id="workspace-timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {TIMEZONE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          {workspaceError && (
            <p className="text-sm text-destructive" role="alert">
              {workspaceError}
            </p>
          )}
          <Button type="submit" disabled={isSavingWorkspace}>
            {isSavingWorkspace ? "Saving..." : "Save workspace"}
          </Button>
        </form>
      )}
    </section>
  );
}
