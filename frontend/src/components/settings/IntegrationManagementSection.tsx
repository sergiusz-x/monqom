import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Eye, EyeOff } from "lucide-react";
import { getApiErrorMessage } from "@/lib/api-errors";
import { integrationsApi } from "@/api/contract";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import { useCategories } from "@/hooks/useCategories";
import { usePaymentSources } from "@/hooks/usePaymentSources";
import type { Category } from "@/types/category";
import type { User } from "@/contexts/AuthContext";
import {
  Alert,
  Button,
  Card,
  FormField,
  Input,
  Modal,
  PendingButton,
  ProgressBar,
} from "@monqom/ui";

type Scope =
  | "transactions:create"
  | "transactions:read-own"
  | "transactions:update-own"
  | "transactions:delete-own"
  | "categories:read"
  | "payment-sources:read";
type Credential = {
  id: string;
  token_prefix: string;
  status: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  scopes: Scope[];
  category_allowlist_enabled: boolean;
  category_ids: string[];
  payment_source_allowlist_enabled: boolean;
  payment_source_ids: string[];
  cidr_allowlist_enabled: boolean;
  allowed_cidrs: string[];
};
type Integration = {
  id: string;
  name: string;
  status: string;
  created_at: string;
  created_by: { id: string; name: string };
  credentials: Credential[];
};
type Secret = {
  token: string;
  tokenPrefix: string;
  expiresAt: string;
};
type Action = {
  kind: "rotate" | "revoke" | "delete";
  integration: Integration;
  credential: Credential;
};

const STEP_KEYS = [
  "basics",
  "permissions",
  "categories",
  "sources",
  "ip",
  "confirm",
] as const;
const STEP_COPY = {
  basics: {
    title: "integrations.stepBasicsTitle",
    description: "integrations.stepBasicsDescription",
    short: "integrations.stepBasicsShort",
  },
  permissions: {
    title: "integrations.stepPermissionsTitle",
    description: "integrations.stepPermissionsDescription",
    short: "integrations.stepPermissionsShort",
  },
  categories: {
    title: "integrations.stepCategoriesTitle",
    description: "integrations.stepCategoriesDescription",
    short: "integrations.stepCategoriesShort",
  },
  sources: {
    title: "integrations.stepSourcesTitle",
    description: "integrations.stepSourcesDescription",
    short: "integrations.stepSourcesShort",
  },
  ip: {
    title: "integrations.stepIpTitle",
    description: "integrations.stepIpDescription",
    short: "integrations.stepIpShort",
  },
  confirm: {
    title: "integrations.stepConfirmTitle",
    description: "integrations.stepConfirmDescription",
    short: "integrations.stepConfirmShort",
  },
} as const;
const SCOPE_COPY = {
  "transactions:create": {
    title: "integrations.scopeCreateTitle",
    description: "integrations.scopeCreateDescription",
  },
  "transactions:update-own": {
    title: "integrations.scopeUpdateTitle",
    description: "integrations.scopeUpdateDescription",
  },
  "transactions:delete-own": {
    title: "integrations.scopeDeleteTitle",
    description: "integrations.scopeDeleteDescription",
  },
  "transactions:read-own": {
    title: "integrations.scopeReadOwnTitle",
    description: "integrations.scopeReadOwnDescription",
  },
  "categories:read": {
    title: "integrations.scopeCategoriesTitle",
    description: "integrations.scopeCategoriesDescription",
  },
  "payment-sources:read": {
    title: "integrations.scopeSourcesTitle",
    description: "integrations.scopeSourcesDescription",
  },
} as const;

function flattenCategories(categories: Category[]): Category[] {
  return categories.flatMap((category) => [
    category,
    ...flattenCategories(category.children),
  ]);
}

function defaultExpiry() {
  const date = new Date();
  date.setDate(date.getDate() + 90);
  return date.toISOString().slice(0, 10);
}

function toIsoEndOfDay(value: string) {
  return new Date(`${value}T23:59:59.999`).toISOString();
}

export function IntegrationManagementSection({
  workspaceId,
  user,
  onSaved,
}: {
  workspaceId: string | null;
  user: User | null;
  onSaved: (message: string) => void;
}) {
  const { t } = useTranslation();
  const { categories: expenseCategories } = useCategories(
    workspaceId ?? "",
    false,
    "expense",
  );
  const { categories: incomeCategories } = useCategories(
    workspaceId ?? "",
    false,
    "income",
  );
  const { paymentSources } = usePaymentSources(workspaceId ?? "", false);
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState(defaultExpiry);
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [categoryRestricted, setCategoryRestricted] = useState(false);
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [sourceRestricted, setSourceRestricted] = useState(false);
  const [sourceIds, setSourceIds] = useState<string[]>([]);
  const [cidrEnabled, setCidrEnabled] = useState(false);
  const [cidrs, setCidrs] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState("");
  const [saving, setSaving] = useState(false);
  const [secret, setSecret] = useState<Secret | null>(null);
  const [secretVisible, setSecretVisible] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [action, setAction] = useState<Action | null>(null);
  const [actionExpiry, setActionExpiry] = useState(defaultExpiry);
  const [actionPassword, setActionPassword] = useState("");
  const [actionTwoFactor, setActionTwoFactor] = useState("");

  const maxDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 365);
    return d.toISOString().slice(0, 10);
  }, []);
  const selectableCategories = useMemo(
    () =>
      flattenCategories([...expenseCategories, ...incomeCategories]).map(
        (category) => ({
          id: category.id,
          label: translateSystemLabel(t, category.systemKey, category.name),
          icon: category.icon,
          depth: category.parentId ? 1 : 0,
        }),
      ),
    [expenseCategories, incomeCategories, t],
  );
  const selectablePaymentSources = useMemo(
    () =>
      paymentSources.map((source) => ({
        id: source.id,
        label: translateSystemLabel(t, source.systemKey, source.name),
        detail: source.type,
      })),
    [paymentSources, t],
  );

  async function load() {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      setItems(
        (await integrationsApi.integrationManagementControllerList(workspaceId))
          .data as Integration[],
      );
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    queueMicrotask(() => void load());
    // load deliberately follows the active workspace only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);
  useEffect(() => () => setSecret(null), []);
  useEffect(() => {
    queueMicrotask(() => {
      setSecret(null);
      setWizardOpen(false);
      setAction(null);
    });
  }, [workspaceId]);

  function resetWizard() {
    setStep(1);
    setName("");
    setExpiry(defaultExpiry());
    setScopes([]);
    setCategoryRestricted(false);
    setCategoryIds([]);
    setSourceRestricted(false);
    setSourceIds([]);
    setCidrEnabled(false);
    setCidrs("");
    setPassword("");
    setTwoFactor("");
    setSecretVisible(false);
    setError(null);
  }
  function closeWizard() {
    setWizardOpen(false);
    resetWizard();
  }
  function validCidr(value: string) {
    return /^([0-9a-fA-F:.]+)\/(?:[0-9]|[1-9][0-9]|1[01][0-9]|12[0-8])$/.test(
      value,
    );
  }
  function advance() {
    if (step === 1 && (!name.trim() || !expiry || expiry > maxDate)) {
      setError(t("integrations.invalidSetup"));
      return;
    }
    if (
      step === 5 &&
      cidrEnabled &&
      cidrs
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean)
        .some((item) => !validCidr(item))
    ) {
      setError(t("integrations.invalidCidr"));
      return;
    }
    setError(null);
    setStep((current) => current + 1);
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (!workspaceId || !password) {
      setError(t("integrations.passwordRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response =
        await integrationsApi.integrationManagementControllerCreate(
          workspaceId,
          {
            name: name.trim(),
            expires_at: toIsoEndOfDay(expiry),
            scopes,
            category_allowlist_enabled: categoryRestricted,
            category_ids: categoryRestricted ? categoryIds : [],
            payment_source_allowlist_enabled: sourceRestricted,
            payment_source_ids: sourceRestricted ? sourceIds : [],
            cidr_allowlist_enabled: cidrEnabled,
            allowed_cidrs: cidrEnabled
              ? cidrs
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean)
              : [],
            current_password: password,
            two_factor_token: twoFactor || undefined,
          },
        );
      setSecret({
        token: response.data.token,
        tokenPrefix: response.data.token_prefix,
        expiresAt: response.data.expires_at,
      });
      closeWizard();
      await load();
      onSaved(t("integrations.created"));
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  async function runAction(event: FormEvent) {
    event.preventDefault();
    if (!workspaceId || !action) return;
    if (action.kind !== "delete" && !actionPassword) {
      setError(t("integrations.passwordRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (action.kind === "rotate") {
        const response =
          await integrationsApi.integrationManagementControllerRotate(
            action.integration.id,
            action.credential.id,
            workspaceId,
            {
              expires_at: toIsoEndOfDay(actionExpiry),
              current_password: actionPassword,
              two_factor_token: actionTwoFactor || undefined,
            },
          );
        setSecret({
          token: response.data.token,
          tokenPrefix: response.data.token_prefix,
          expiresAt: response.data.expires_at,
        });
      } else if (action.kind === "revoke")
        await integrationsApi.integrationManagementControllerRevoke(
          action.integration.id,
          action.credential.id,
          workspaceId,
          {
            current_password: actionPassword,
            two_factor_token: actionTwoFactor || undefined,
          },
        );
      else
        await integrationsApi.integrationManagementControllerRemove(
          action.integration.id,
          action.credential.id,
          workspaceId,
        );
      const successMessage = {
        rotate: "integrations.rotated",
        revoke: "integrations.revoked",
        delete: "integrations.deleted",
      } as const;
      setAction(null);
      setActionPassword("");
      setActionTwoFactor("");
      await load();
      onSaved(t(successMessage[action.kind]));
    } catch (cause) {
      setError(getApiErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }
  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    onSaved(t("integrations.copied"));
  }
  const actionText = action
    ? {
        rotate: {
          title: t("integrations.rotate"),
          warning: t("integrations.rotateWarning"),
          confirm: t("integrations.confirmRotate"),
        },
        revoke: {
          title: t("integrations.revoke"),
          warning: t("integrations.revokeWarning"),
          confirm: t("integrations.confirmRevoke"),
        },
        delete: {
          title: t("integrations.delete"),
          warning: t("integrations.deleteWarning"),
          confirm: t("integrations.confirmDelete"),
        },
      }[action.kind]
    : null;
  return (
    <section className="space-y-6">
      <Card padding="responsive">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">{t("integrations.title")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("integrations.description")}
            </p>
          </div>
          <Button
            type="button"
            onClick={() => {
              resetWizard();
              setWizardOpen(true);
            }}
          >
            {t("integrations.create")}
          </Button>
        </div>
      </Card>
      {error && !wizardOpen && !action && (
        <Alert variant="error" compact>
          {error}
        </Alert>
      )}
      {loading ? (
        <Card padding="responsive">{t("common.loading")}</Card>
      ) : items.length === 0 ? (
        <Card padding="responsive">
          <p className="text-sm text-muted-foreground">
            {t("integrations.empty")}
          </p>
        </Card>
      ) : (
        items.map((integration) => (
          <Card key={integration.id} padding="responsive">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{integration.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("integrations.createdBy", {
                    name: integration.created_by.name,
                  })}
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {[...integration.credentials]
                .sort(
                  (a, b) =>
                    Number(b.status === "active") -
                    Number(a.status === "active"),
                )
                .map((credential) => (
                  <div
                    key={credential.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <code>{credential.token_prefix}</code>
                      <span>
                        {credential.status === "active" &&
                        new Date(credential.expires_at) > new Date()
                          ? t("integrations.active")
                          : credential.revoked_at
                            ? t("integrations.statusRevoked")
                            : t("integrations.expired")}
                      </span>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      {t("integrations.expires", {
                        date: new Date(
                          credential.expires_at,
                        ).toLocaleDateString(),
                      })}
                    </p>
                    <p className="mt-1 break-words text-muted-foreground">
                      {credential.scopes.length
                        ? credential.scopes
                            .map((scope) => t(SCOPE_COPY[scope].title))
                            .join(", ")
                        : t("integrations.noScopes")}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {t("integrations.restrictions", {
                        categories: credential.category_allowlist_enabled
                          ? credential.category_ids.length
                          : t("integrations.unrestricted"),
                        sources: credential.payment_source_allowlist_enabled
                          ? credential.payment_source_ids.length
                          : t("integrations.unrestricted"),
                        cidrs: credential.cidr_allowlist_enabled
                          ? credential.allowed_cidrs.length
                          : t("integrations.unrestricted"),
                      })}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {credential.status === "active" && (
                        <>
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setAction({
                                kind: "rotate",
                                integration,
                                credential,
                              });
                              setActionExpiry(defaultExpiry());
                            }}
                          >
                            {t("integrations.rotate")}
                          </Button>
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            onClick={() =>
                              setAction({
                                kind: "revoke",
                                integration,
                                credential,
                              })
                            }
                          >
                            {t("integrations.revoke")}
                          </Button>
                        </>
                      )}
                      {credential.status === "revoked" && (
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() =>
                            setAction({
                              kind: "delete",
                              integration,
                              credential,
                            })
                          }
                        >
                          {t("integrations.delete")}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        ))
      )}
      {wizardOpen && (
        <Modal
          open
          onClose={closeWizard}
          preventClose={saving}
          ariaLabelledBy="integration-wizard-title"
          contentClassName="max-w-2xl"
        >
          <WizardHeader step={step} />
          {error && (
            <Alert className="mt-4" variant="error" compact>
              {error}
            </Alert>
          )}
          <form className="mt-5 space-y-4" onSubmit={create}>
            {step === 1 && (
              <>
                <FormField
                  id="integration-name"
                  label={t("integrations.name")}
                  required
                >
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoFocus
                  />
                </FormField>
                <FormField
                  id="integration-expiry"
                  label={t("integrations.expiry")}
                  required
                >
                  <Input
                    type="date"
                    value={expiry}
                    min={new Date().toISOString().slice(0, 10)}
                    max={maxDate}
                    onChange={(event) => setExpiry(event.target.value)}
                  />
                </FormField>
              </>
            )}
            {step === 2 && (
              <ScopePicker scopes={scopes} setScopes={setScopes} />
            )}
            {step === 3 && (
              <PolicyPicker
                label={t("integrations.categoryPolicy")}
                restricted={categoryRestricted}
                setRestricted={setCategoryRestricted}
                items={selectableCategories}
                selected={categoryIds}
                setSelected={setCategoryIds}
              />
            )}
            {step === 4 && (
              <PolicyPicker
                label={t("integrations.sourcePolicy")}
                restricted={sourceRestricted}
                setRestricted={setSourceRestricted}
                items={selectablePaymentSources}
                selected={sourceIds}
                setSelected={setSourceIds}
              />
            )}
            {step === 5 && (
              <IpAccessPicker
                enabled={cidrEnabled}
                setEnabled={setCidrEnabled}
                cidrs={cidrs}
                setCidrs={setCidrs}
              />
            )}
            {step === 6 && (
              <>
                <IntegrationSummary
                  name={name}
                  expiry={expiry}
                  scopes={scopes}
                  categoryRestricted={categoryRestricted}
                  categoryIds={categoryIds}
                  categories={selectableCategories}
                  sourceRestricted={sourceRestricted}
                  sourceIds={sourceIds}
                  paymentSources={selectablePaymentSources}
                  cidrEnabled={cidrEnabled}
                  cidrs={cidrs}
                />
                <FormField
                  id="integration-password"
                  label={t("settings.currentPassword")}
                  required
                >
                  <Input
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </FormField>
                {user?.totpEnabled && (
                  <FormField
                    id="integration-2fa"
                    label={t("integrations.twoFactor")}
                    required
                  >
                    <Input
                      value={twoFactor}
                      onChange={(event) => setTwoFactor(event.target.value)}
                    />
                  </FormField>
                )}
              </>
            )}
            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={
                  step === 1 ? closeWizard : () => setStep((value) => value - 1)
                }
              >
                {step === 1 ? t("common.cancel") : t("common.previous")}
              </Button>
              {step < STEP_KEYS.length ? (
                <Button type="button" onClick={advance}>
                  {t("common.next")}
                </Button>
              ) : (
                <PendingButton
                  type="submit"
                  isPending={saving}
                  pendingLabel={t("settings.saving")}
                >
                  {t("integrations.issue")}
                </PendingButton>
              )}
            </div>
          </form>
        </Modal>
      )}
      {action && actionText && (
        <Modal
          open
          onClose={() => setAction(null)}
          preventClose={saving}
          ariaLabelledBy="integration-action-title"
          contentClassName="max-w-md"
        >
          <h3 id="integration-action-title" className="text-lg font-semibold">
            {actionText.title}
          </h3>
          {error && (
            <Alert className="mt-4" variant="error" compact>
              {error}
            </Alert>
          )}
          <form className="mt-4 space-y-4" onSubmit={runAction}>
            {action.kind === "rotate" ? (
              <>
                <Alert variant="warning" compact>
                  {actionText.warning}
                </Alert>
                <FormField
                  id="rotate-expiry"
                  label={t("integrations.expiry")}
                  required
                >
                  <Input
                    type="date"
                    value={actionExpiry}
                    max={maxDate}
                    onChange={(event) => setActionExpiry(event.target.value)}
                  />
                </FormField>
              </>
            ) : (
              <Alert variant="warning" compact>
                {actionText.warning}
              </Alert>
            )}
            {action.kind !== "delete" && (
              <>
                <FormField
                  id="action-password"
                  label={t("settings.currentPassword")}
                  required
                >
                  <Input
                    type="password"
                    value={actionPassword}
                    onChange={(event) => setActionPassword(event.target.value)}
                  />
                </FormField>
                {user?.totpEnabled && (
                  <FormField
                    id="action-2fa"
                    label={t("integrations.twoFactor")}
                    required
                  >
                    <Input
                      value={actionTwoFactor}
                      onChange={(event) =>
                        setActionTwoFactor(event.target.value)
                      }
                    />
                  </FormField>
                )}
              </>
            )}
            <div className="flex gap-2">
              <PendingButton
                type="submit"
                isPending={saving}
                pendingLabel={t("settings.saving")}
              >
                {actionText.confirm}
              </PendingButton>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAction(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {secret && (
        <Modal
          open
          onClose={() => {
            if (acknowledged) setSecret(null);
          }}
          preventClose={!acknowledged}
          ariaLabelledBy="integration-secret-title"
          contentClassName="max-w-2xl"
        >
          <h3 id="integration-secret-title" className="text-lg font-semibold">
            {t("integrations.secretTitle")}
          </h3>
          <Alert variant="warning" compact className="mt-3">
            {t("integrations.secretWarning")}
          </Alert>
          <div className="mt-4 rounded-md border border-border bg-muted p-3">
            {secretVisible ? (
              <code className="block break-all text-xs">{secret.token}</code>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <EyeOff size={16} aria-hidden="true" />
                {t("integrations.secretHidden")}
              </div>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              onClick={() => void copy(secret.token)}
            >
              <Copy size={16} aria-hidden="true" />
              {t("integrations.copyToken")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSecretVisible((visible) => !visible)}
            >
              {secretVisible ? (
                <EyeOff size={16} aria-hidden="true" />
              ) : (
                <Eye size={16} aria-hidden="true" />
              )}
              {secretVisible
                ? t("integrations.hideToken")
                : t("integrations.revealToken")}
            </Button>
          </div>
          <a
            className="mt-5 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
            href="https://github.com/sergiusz-x/monqom/blob/main/docs/external-transactions-api.md"
            target="_blank"
            rel="noreferrer"
          >
            {t("integrations.documentation")}
          </a>
          <label className="mt-5 flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            {t("integrations.secretAcknowledgement")}
          </label>
          <Button
            className="mt-4"
            type="button"
            disabled={!acknowledged}
            onClick={() => {
              setSecret(null);
              setAcknowledged(false);
            }}
          >
            {t("integrations.closeSecret")}
          </Button>
        </Modal>
      )}
    </section>
  );
}

function WizardHeader({ step }: { step: number }) {
  const { t } = useTranslation();
  const stepKey =
    STEP_KEYS[Math.min(Math.max(step - 1, 0), STEP_KEYS.length - 1)]!;
  return (
    <header>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-primary">
            {t("integrations.step", { current: step, total: STEP_KEYS.length })}
          </p>
          <h3
            id="integration-wizard-title"
            className="mt-1 text-lg font-semibold"
          >
            {t(STEP_COPY[stepKey].title)}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t(STEP_COPY[stepKey].description)}
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {step}/{STEP_KEYS.length}
        </span>
      </div>
      <ProgressBar
        className="mt-4"
        value={(step / STEP_KEYS.length) * 100}
        ariaLabel={t("integrations.step", {
          current: step,
          total: STEP_KEYS.length,
        })}
      />
      <ol
        className="mt-4 flex gap-2 overflow-x-auto pb-1"
        aria-label={t("integrations.step", {
          current: step,
          total: STEP_KEYS.length,
        })}
      >
        {STEP_KEYS.map((key, index) => (
          <li key={key} className="min-w-20 shrink-0">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`flex size-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                  index + 1 === step
                    ? "bg-primary text-primary-foreground"
                    : index + 1 < step
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {index + 1}
              </span>
              <span
                aria-current={index + 1 === step ? "step" : undefined}
                className={`truncate text-xs ${
                  index + 1 === step
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {t(STEP_COPY[key].short)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </header>
  );
}

function IntegrationSummary({
  name,
  expiry,
  scopes,
  categoryRestricted,
  categoryIds,
  categories,
  sourceRestricted,
  sourceIds,
  paymentSources,
  cidrEnabled,
  cidrs,
}: {
  name: string;
  expiry: string;
  scopes: Scope[];
  categoryRestricted: boolean;
  categoryIds: string[];
  categories: { id: string; label: string; icon?: string | null }[];
  sourceRestricted: boolean;
  sourceIds: string[];
  paymentSources: { id: string; label: string }[];
  cidrEnabled: boolean;
  cidrs: string;
}) {
  const { t } = useTranslation();
  const selectedNames = (
    ids: string[],
    items: { id: string; label: string; icon?: string | null }[],
  ) =>
    ids
      .map((id) => items.find((item) => item.id === id))
      .filter(
        (item): item is { id: string; label: string; icon?: string | null } =>
          Boolean(item),
      )
      .map((item) => `${item.icon ?? ""} ${item.label}`.trim());
  const categoryNames = selectedNames(categoryIds, categories);
  const sourceNames = selectedNames(sourceIds, paymentSources);
  const ipRanges = cidrs
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
  const rows = [
    [t("integrations.summaryName"), name],
    [
      t("integrations.summaryExpiry"),
      new Date(`${expiry}T12:00:00`).toLocaleDateString(),
    ],
    [
      t("integrations.summaryPermissions"),
      scopes.length
        ? scopes.map((scope) => t(SCOPE_COPY[scope].title)).join(", ")
        : t("integrations.noScopes"),
    ],
    [
      t("integrations.categoryPolicy"),
      categoryRestricted
        ? categoryNames.length
          ? categoryNames.join(", ")
          : t("integrations.noneSelected")
        : t("integrations.unrestricted"),
    ],
    [
      t("integrations.sourcePolicy"),
      sourceRestricted
        ? sourceNames.length
          ? sourceNames.join(", ")
          : t("integrations.noneSelected")
        : t("integrations.unrestricted"),
    ],
    [
      t("integrations.ipAccess"),
      cidrEnabled
        ? ipRanges.length
          ? ipRanges.join(", ")
          : t("integrations.noneSelected")
        : t("integrations.unrestricted"),
    ],
  ] as const;
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <h4 className="font-semibold">{t("integrations.reviewTitle")}</h4>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("integrations.reviewDescription")}
      </p>
      <dl className="mt-4 space-y-3 text-sm">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="border-b border-border/70 pb-3 last:border-0 last:pb-0"
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </dt>
            <dd className="mt-1 break-words">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ScopePicker({
  scopes,
  setScopes,
}: {
  scopes: Scope[];
  setScopes: (value: Scope[]) => void;
}) {
  const { t } = useTranslation();
  const groups = [
    {
      label: "integrations.scopeWrite" as const,
      values: [
        "transactions:create",
        "transactions:update-own",
        "transactions:delete-own",
      ] as Scope[],
    },
    {
      label: "integrations.scopeRead" as const,
      values: ["transactions:read-own"] as Scope[],
    },
    {
      label: "integrations.scopeMetadata" as const,
      values: ["categories:read", "payment-sources:read"] as Scope[],
    },
  ];
  return (
    <div className="space-y-3">
      {groups.map(({ label, values }) => (
        <fieldset key={label} className="rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-semibold">{t(label)}</legend>
          {values.map((scope) => (
            <label
              key={scope}
              className="mt-3 flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted"
            >
              <input
                className="mt-0.5 size-4"
                type="checkbox"
                checked={scopes.includes(scope)}
                onChange={() =>
                  setScopes(
                    scopes.includes(scope)
                      ? scopes.filter((item) => item !== scope)
                      : [...scopes, scope],
                  )
                }
              />
              <span>
                <span className="block text-sm font-medium">
                  {t(SCOPE_COPY[scope].title)}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t(SCOPE_COPY[scope].description)}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      ))}
    </div>
  );
}
function PolicyPicker({
  label,
  restricted,
  setRestricted,
  items,
  selected,
  setSelected,
}: {
  label: string;
  restricted: boolean;
  setRestricted: (value: boolean) => void;
  items: {
    id: string;
    label: string;
    icon?: string | null;
    detail?: string;
    depth?: number;
  }[];
  selected: string[];
  setSelected: (value: string[]) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-4">
      <legend className="sr-only">{label}</legend>
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
        <input
          className="mt-0.5 size-4"
          type="radio"
          checked={!restricted}
          onChange={() => setRestricted(false)}
        />
        <span>
          <span className="block font-medium">
            {t("integrations.unrestricted")}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {t("integrations.unrestrictedHint")}
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm">
        <input
          className="mt-0.5 size-4"
          type="radio"
          checked={restricted}
          onChange={() => setRestricted(true)}
        />
        <span>
          <span className="block font-medium">
            {t("integrations.restricted")}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {t("integrations.restrictedHint")}
          </span>
        </span>
      </label>
      {restricted && (
        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md bg-muted/50 p-2">
          {items.map((item) => (
            <label
              key={item.id}
              className="flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm hover:bg-background"
            >
              <input
                className="size-4"
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() =>
                  setSelected(
                    selected.includes(item.id)
                      ? selected.filter((id) => id !== item.id)
                      : [...selected, item.id],
                  )
                }
              />
              {item.icon && <span aria-hidden="true">{item.icon}</span>}
              <span
                className="min-w-0"
                style={{ paddingLeft: `${(item.depth ?? 0) * 12}px` }}
              >
                <span className="block truncate">{item.label}</span>
                {item.detail && (
                  <span className="block text-xs text-muted-foreground">
                    {item.detail}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function IpAccessPicker({
  enabled,
  setEnabled,
  cidrs,
  setCidrs,
}: {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  cidrs: string;
  setCidrs: (value: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-4">
      <legend className="sr-only">{t("integrations.ipAccess")}</legend>
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
        <input
          className="mt-0.5 size-4"
          type="radio"
          checked={!enabled}
          onChange={() => setEnabled(false)}
        />
        <span>
          <span className="block font-medium">
            {t("integrations.unrestricted")}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {t("integrations.ipUnrestrictedHint")}
          </span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 text-sm">
        <input
          className="mt-0.5 size-4"
          type="radio"
          checked={enabled}
          onChange={() => setEnabled(true)}
        />
        <span>
          <span className="block font-medium">
            {t("integrations.enableCidr")}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {t("integrations.ipRestrictedHint")}
          </span>
        </span>
      </label>
      {enabled && (
        <FormField id="integration-cidrs" label={t("integrations.cidrs")}>
          <textarea
            className="min-h-24 w-full rounded-md border border-input bg-background p-2 font-mono text-sm"
            value={cidrs}
            onChange={(event) => setCidrs(event.target.value)}
            placeholder="203.0.113.0/24"
          />
        </FormField>
      )}
    </fieldset>
  );
}
