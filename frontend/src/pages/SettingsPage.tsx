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

type ActiveSection = "profile" | "workspace";

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

      <div className="flex rounded-lg border border-border bg-muted/40 p-1 sm:w-fit">
        <button
          type="button"
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition sm:flex-none ${
            activeSection === "profile"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveSection("profile")}
        >
          Profile
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition sm:flex-none ${
            activeSection === "workspace"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={() => setActiveSection("workspace")}
        >
          Workspace
        </button>
      </div>

      {activeSection === "profile" ? (
        <ProfileSection
          key={user?.id ?? "anonymous"}
          user={user}
          setUser={setUser}
          onSaved={setToast}
        />
      ) : (
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
