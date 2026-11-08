import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ChevronRight,
  UserRound,
  ShieldCheck,
  EyeOff,
  Wallet,
  Tags,
  Download,
  Plug,
  type LucideIcon,
} from "lucide-react";
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
import { PrivacySection } from "@/components/settings/PrivacySection";
import { IntegrationManagementSection } from "@/components/settings/IntegrationManagementSection";
import { ReleaseVersion } from "@/components/ReleaseVersion";
import { Button } from "@monqom/ui";

type ActiveSection =
  | "profile"
  | "workspace"
  | "categories"
  | "integrations"
  | "privacy"
  | "security"
  | "data";
type Item = {
  id: ActiveSection;
  label: string;
  description: string;
  icon: LucideIcon;
};

export default function SettingsPage() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const { workspace, workspaceId, isLoading, error, patchWorkspace, refetch } =
    useWorkspace();
  const [activeSection, setActiveSection] = useState<ActiveSection>("profile");
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const { showToast } = useToast(3000);
  const canConfigure = !!workspace && workspace.role !== "member";
  const canManageIntegrations =
    Boolean(user && !isLoading && workspace?.id === workspaceId) &&
    (workspace?.role === "admin" || workspace?.role === "owner");
  const groups: { title: string; items: Item[] }[] = [
    {
      title: t("settings.personalGroup"),
      items: [
        {
          id: "profile",
          label: t("settings.account"),
          description: t("settings.accountMenuDescription"),
          icon: UserRound,
        },
        {
          id: "privacy",
          label: t("privacy.tab"),
          description: t("settings.privacyMenuDescription"),
          icon: EyeOff,
        },
        {
          id: "security",
          label: t("settings.security"),
          description: t("settings.securityMenuDescription"),
          icon: ShieldCheck,
        },
      ],
    },
    {
      title: t("settings.financesGroup"),
      items: [
        {
          id: "workspace",
          label: t("settings.workspace"),
          description: t("settings.workspaceMenuDescription"),
          icon: Wallet,
        },
        ...(canConfigure
          ? [
              {
                id: "categories" as const,
                label: t("categoryManagement.tab"),
                description: t("settings.categoriesMenuDescription"),
                icon: Tags,
              },
            ]
          : []),
        {
          id: "data",
          label: t("settings.exportTitle"),
          description: t("settings.exportMenuDescription"),
          icon: Download,
        },
      ],
    },
    ...(canManageIntegrations
      ? [
          {
            title: t("settings.advancedGroup"),
            items: [
              {
                id: "integrations" as const,
                label: t("integrations.tab"),
                description: t("settings.integrationsMenuDescription"),
                icon: Plug,
              },
            ],
          },
        ]
      : []),
  ];
  const selected = groups
    .flatMap((group) => group.items)
    .find((item) => item.id === activeSection);

  return (
    <PageContainer>
      <div className="space-y-6">
        <PageHeader
          title={t("settings.title")}
          description={t("settings.description")}
        />
        <div className="flex flex-col gap-6 md:flex-row md:items-start">
          {!mobileDetailOpen && (
            <nav
              aria-label={t("settings.title")}
              className="space-y-6 md:hidden"
            >
              {groups.map((group) => (
                <section key={group.title}>
                  <h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
                    {group.title}
                  </h2>
                  <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                    {group.items.map(
                      ({ id, label, description, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          aria-label={t("settings.openSection", {
                            section: label,
                          })}
                          onClick={() => {
                            setActiveSection(id);
                            setMobileDetailOpen(true);
                          }}
                          className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <Icon size={19} aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium">{label}</span>
                            <span className="block text-sm text-muted-foreground">
                              {description}
                            </span>
                          </span>
                          <ChevronRight
                            size={18}
                            className="shrink-0 text-muted-foreground"
                            aria-hidden="true"
                          />
                        </button>
                      ),
                    )}
                  </div>
                </section>
              ))}
            </nav>
          )}
          <nav
            aria-label={t("settings.title")}
            className="hidden w-64 shrink-0 flex-col gap-5 md:flex"
          >
            {groups.map((group) => (
              <section
                key={group.title}
                className="flex shrink-0 gap-1 md:block"
              >
                <h2 className="hidden px-3 pb-2 text-xs font-medium text-muted-foreground md:block">
                  {group.title}
                </h2>
                <div className="flex gap-1 md:flex-col">
                  {group.items.map(({ id, label, description, icon: Icon }) => (
                    <button
                      key={id}
                      type="button"
                      aria-label={label}
                      aria-current={activeSection === id ? "page" : undefined}
                      onClick={() => setActiveSection(id)}
                      className={`flex min-h-11 shrink-0 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring md:w-full ${activeSection === id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
                    >
                      <Icon size={18} className="shrink-0" aria-hidden="true" />
                      <span className="whitespace-nowrap text-sm font-medium md:whitespace-normal">
                        {label}
                        <span className="hidden pt-0.5 text-xs font-normal text-muted-foreground md:block">
                          {description}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </nav>
          <div
            className={`min-w-0 flex-1 space-y-6 ${mobileDetailOpen ? "block" : "hidden md:block"}`}
          >
            {mobileDetailOpen && (
              <Button
                type="button"
                variant="ghost"
                className="-ml-2 gap-2 md:hidden"
                onClick={() => {
                  setMobileDetailOpen(false);
                  setActiveSection("profile");
                }}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                {t("settings.backToSettings")}
              </Button>
            )}
            {/* Keep editable preferences mounted so returning to the list does not discard drafts. */}
            <div hidden={activeSection !== "profile"}>
              <div className="space-y-6">
                <ProfileSection
                  key={user?.id ?? "anonymous"}
                  user={user}
                  setUser={setUser}
                  onSaved={showToast}
                />
                <AccountPreferencesSection />
                {activeSection === "profile" && (
                  <DataSection
                    mode="delete"
                    workspaceId={workspaceId}
                    setUser={setUser}
                    onSaved={showToast}
                  />
                )}
              </div>
            </div>
            <div hidden={activeSection !== "workspace"}>
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
            </div>
            {activeSection === "categories" && canConfigure && (
              <CategoryManagementSection
                workspaceId={workspaceId}
                onSaved={showToast}
              />
            )}
            {activeSection === "integrations" && canManageIntegrations && (
              <IntegrationManagementSection
                workspaceId={workspaceId}
                role={workspace?.role}
                user={user}
                onSaved={showToast}
              />
            )}
            {activeSection === "privacy" && (
              <PrivacySection
                user={user}
                setUser={setUser}
                onSaved={showToast}
              />
            )}
            {activeSection === "security" && (
              <SecuritySection
                user={user}
                setUser={setUser}
                onSaved={showToast}
              />
            )}
            {activeSection === "data" && (
              <DataSection
                mode="export"
                workspaceId={workspaceId}
                setUser={setUser}
                onSaved={showToast}
              />
            )}
            {activeSection && !selected && (
              <p className="text-sm text-muted-foreground">
                {t("settings.sectionUnavailable")}
              </p>
            )}
          </div>
        </div>
        <div className="pt-4 text-center text-sm text-muted-foreground">
          <ReleaseVersion />
        </div>
      </div>
    </PageContainer>
  );
}
