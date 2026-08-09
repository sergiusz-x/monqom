import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/useToast";

import { PageContainer, PageHeader } from "@/components/layout/PageLayout";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { AccountPreferencesSection } from "@/components/settings/AccountPreferencesSection";
import { WorkspaceSection } from "@/components/settings/WorkspaceSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { DataSection } from "@/components/settings/DataSection";
import { CategoryManagementSection } from "@/components/settings/CategoryManagementSection";
import { ReleaseVersion } from "@/components/ReleaseVersion";
import { Button } from "@monqom/ui";

type ActiveSection =
  "profile" | "workspace" | "categories" | "security" | "data";

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const { workspace, workspaceId, isLoading, error, patchWorkspace, refetch } =
    useWorkspace();
  const [activeSection, setActiveSection] = useState<ActiveSection>("profile");
  const { showToast } = useToast(3000);
  const tabs: Array<{ id: ActiveSection; label: string }> = [
    { id: "profile", label: t("settings.profile") },
    { id: "workspace", label: t("settings.workspace") },
    { id: "categories", label: t("categoryManagement.tab") },
    { id: "security", label: t("settings.security") },
    { id: "data", label: t("settings.data") },
  ];

  return (
    <PageContainer>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title={t("settings.title")}
          description={t("settings.description")}
        />
        <nav
          aria-label={t("settings.title")}
          className="flex w-full flex-col rounded-lg border border-border bg-muted/40 p-1 sm:flex-row"
        >
          {tabs.map(({ id, label }) => (
            <Button
              key={id}
              type="button"
              variant="ghost"
              aria-pressed={activeSection === id}
              className={`w-full px-4 py-2 sm:flex-1 ${
                activeSection === id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveSection(id)}
            >
              {label}
            </Button>
          ))}
        </nav>

        {activeSection === "profile" ? (
          <div className="space-y-6">
            <ProfileSection
              key={user?.id ?? "anonymous"}
              user={user}
              setUser={setUser}
              onSaved={showToast}
            />
            <AccountPreferencesSection />
          </div>
        ) : activeSection === "workspace" ? (
          <WorkspaceSection
            key={workspace?.id ?? "missing-workspace"}
            workspace={workspace}
            workspaceId={workspaceId}
            isLoading={isLoading}
            error={error}
            onSaved={(nextWorkspace, message) => {
              patchWorkspace(nextWorkspace);
              showToast(message);
            }}
            onRetry={() => void refetch()}
          />
        ) : activeSection === "categories" ? (
          <CategoryManagementSection
            workspaceId={workspaceId}
            onSaved={showToast}
          />
        ) : activeSection === "security" ? (
          <SecuritySection user={user} setUser={setUser} onSaved={showToast} />
        ) : (
          <DataSection
            workspaceId={workspaceId}
            setUser={setUser}
            onSaved={showToast}
          />
        )}

        <div className="pt-4 text-center text-sm text-muted-foreground">
          <ReleaseVersion />
        </div>
      </div>
    </PageContainer>
  );
}
