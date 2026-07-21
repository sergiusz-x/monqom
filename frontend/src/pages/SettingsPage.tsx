import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/useToast";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/layout/PageLayout";
import { ProfileSection } from "@/components/settings/ProfileSection";
import { WorkspaceSection } from "@/components/settings/WorkspaceSection";
import { SecuritySection } from "@/components/settings/SecuritySection";
import { DataSection } from "@/components/settings/DataSection";

type ActiveSection = "profile" | "workspace" | "security" | "data";

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
    { id: "security", label: t("settings.security") },
    { id: "data", label: t("settings.data") },
  ];

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <div className="grid rounded-lg border border-border bg-muted/40 p-1 sm:w-fit sm:grid-cols-4">
        {tabs.map(({ id, label }) => (
          <Button
            key={id}
            type="button"
            variant="ghost"
            className={`px-4 py-2 ${
              activeSection === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveSection(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {activeSection === "profile" ? (
        <ProfileSection
          key={user?.id ?? "anonymous"}
          user={user}
          setUser={setUser}
          onSaved={showToast}
        />
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
      ) : activeSection === "security" ? (
        <SecuritySection user={user} setUser={setUser} onSaved={showToast} />
      ) : (
        <DataSection
          workspaceId={workspaceId}
          setUser={setUser}
          onSaved={showToast}
        />
      )}
    </PageContainer>
  );
}
