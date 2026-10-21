import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  PendingButton,
  ProgressBar,
} from "@monqom/ui";
import type { User } from "@/contexts/AuthContext";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-errors";
import {
  createIntegrationCredential,
  rotateIntegrationCredential,
} from "@/lib/integration-credentials";
import type {
  CredentialDraft,
  Integration,
  IntegrationCredential,
  IntegrationScope,
  IssuedIntegrationSecret,
} from "@/types/integration";
import {
  cidrLines,
  defaultExpiry,
  expiryEndOfDay,
  knownScope,
  localDateTime,
  maxExpiry,
  SCOPE_COPY,
  validCidr,
  validExpiry,
  type PolicyOption,
} from "./credential-policy";
import { useCredentialRequest } from "./useCredentialRequest";

const STEPS = [
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

type Fields = "name" | "expiresAt" | "policy" | "cidrs" | "password";
export interface ResourceOptions {
  categories: PolicyOption[];
  paymentSources: PolicyOption[];
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function IntegrationCredentialForm({
  workspaceId,
  user,
  resources,
  replacement,
  onClose,
  returnFocus,
  onIssued,
}: {
  workspaceId: string;
  user: User;
  resources: ResourceOptions;
  replacement?: { integration: Integration; credential: IntegrationCredential };
  onClose: () => void;
  returnFocus?: () => HTMLElement | null;
  onIssued: (secret: IssuedIntegrationSecret) => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<CredentialDraft>(() => ({
    name: replacement?.integration.name ?? "",
    expiresAt: defaultExpiry(),
    scopes: [...(replacement?.credential.scopes ?? [])],
    categoryAllowlistEnabled:
      replacement?.credential.categoryAllowlistEnabled ?? false,
    categoryIds: [...(replacement?.credential.categoryIds ?? [])],
    paymentSourceAllowlistEnabled:
      replacement?.credential.paymentSourceAllowlistEnabled ?? false,
    paymentSourceIds: [...(replacement?.credential.paymentSourceIds ?? [])],
    cidrAllowlistEnabled: replacement?.credential.cidrAllowlistEnabled ?? false,
    allowedCidrs: [...(replacement?.credential.allowedCidrs ?? [])],
  }));
  const [cidrs, setCidrs] = useState(() => draft.allowedCidrs.join("\n"));
  const [password, setPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<Fields | null>(null);
  const request = useCredentialRequest();
  const heading = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stepKey = STEPS[step]!;
  const [expiryBounds] = useState(() => ({
    max: maxExpiry(),
    min: localDateTime(new Date()).slice(0, 10),
  }));
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    heading.current?.focus();
  }, [step]);
  useEffect(() => {
    if (!error) return;
    if (invalidField === "name") nameRef.current?.focus();
    else if (invalidField === "expiresAt") expiryRef.current?.focus();
    else errorRef.current?.focus();
  }, [error, invalidField]);

  function change<K extends keyof CredentialDraft>(
    field: K,
    value: CredentialDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (invalidField === field) {
      setInvalidField(null);
      setError(null);
    }
  }
  function fail(field: Fields, message: string, targetStep: number) {
    setPassword("");
    setTwoFactor("");
    setInvalidField(field);
    setError(message);
    setStep(targetStep);
    return false;
  }
  function validate(currentStep: number) {
    if (currentStep === 0) {
      if (!draft.name.trim())
        return fail("name", t("integrations.nameRequired"), 0);
      if (draft.name.trim().length > 100)
        return fail("name", t("integrations.nameTooLong"), 0);
      if (!validExpiry(draft.expiresAt))
        return fail("expiresAt", t("integrations.invalidExpiry"), 0);
    }
    if (currentStep === 2 || currentStep === 3) {
      if (resources.loading || resources.error)
        return fail(
          "policy",
          t("integrations.resourcesUnavailable"),
          currentStep,
        );
      const ids =
        currentStep === 2 ? draft.categoryIds : draft.paymentSourceIds;
      const options =
        currentStep === 2 ? resources.categories : resources.paymentSources;
      const enabled =
        currentStep === 2
          ? draft.categoryAllowlistEnabled
          : draft.paymentSourceAllowlistEnabled;
      if (
        enabled &&
        (ids.length > 200 ||
          ids.some((id) => !options.some((item) => item.id === id)))
      )
        return fail("policy", t("integrations.invalidResources"), currentStep);
    }
    if (currentStep === 4 && draft.cidrAllowlistEnabled) {
      const lines = cidrLines(cidrs);
      if (lines.length > 64 || lines.some((line) => !validCidr(line)))
        return fail("cidrs", t("integrations.invalidCidr"), 4);
    }
    return true;
  }
  function advance() {
    if (saving || !validate(step)) return;
    setError(null);
    setInvalidField(null);
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step !== STEPS.length - 1) {
      advance();
      return;
    }
    if (saving) return;
    for (const requiredStep of [0, 2, 3, 4])
      if (!validate(requiredStep)) return;
    if (!password || (user.totpEnabled && !twoFactor.trim())) {
      fail(
        "password",
        t(
          user.totpEnabled
            ? "integrations.stepUpRequired"
            : "integrations.passwordRequired",
        ),
        5,
      );
      return;
    }
    const controller = request.begin();
    if (!controller) return;
    setSaving(true);
    setError(null);
    setInvalidField(null);
    const payload = {
      ...draft,
      name: draft.name.trim(),
      expiresAt: expiryEndOfDay(draft.expiresAt).toISOString(),
      allowedCidrs: cidrLines(cidrs),
    };
    const stepUp = {
      currentPassword: password,
      twoFactorToken: twoFactor.trim() || undefined,
    };
    // Drop step-up input as soon as it has been handed to the request.
    setPassword("");
    setTwoFactor("");
    try {
      const secret = replacement
        ? await rotateIntegrationCredential(
            workspaceId,
            replacement.integration.id,
            replacement.credential.id,
            payload,
            stepUp,
            controller.signal,
          )
        : await createIntegrationCredential(
            workspaceId,
            payload,
            stepUp,
            controller.signal,
          );
      if (request.isCurrent(controller)) onIssued(secret);
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
      ariaLabelledBy="integration-form-title"
      contentClassName="flex max-w-2xl flex-col overflow-hidden"
    >
      <header className="shrink-0">
        <p className="text-sm font-medium text-primary" role="status">
          {t("integrations.step", { current: step + 1, total: STEPS.length })}
        </p>
        <h3
          id="integration-form-title"
          ref={heading}
          tabIndex={-1}
          className="mt-1 text-lg font-semibold outline-none"
        >
          {replacement ? t("integrations.rotate") : t(STEP_COPY[stepKey].title)}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(STEP_COPY[stepKey].description)}
        </p>
        <ProgressBar
          className="mt-4"
          value={((step + 1) / STEPS.length) * 100}
          ariaLabel={t("integrations.step", {
            current: step + 1,
            total: STEPS.length,
          })}
        />
        <ol
          className="mt-4 hidden flex-wrap gap-x-3 gap-y-1 sm:flex"
          aria-label={t("integrations.formSteps")}
        >
          {STEPS.map((key, index) => (
            <li
              key={key}
              aria-current={index === step ? "step" : undefined}
              className={`shrink-0 text-xs ${index === step ? "font-semibold text-primary" : "text-muted-foreground"}`}
            >
              {t(STEP_COPY[key].short)}
            </li>
          ))}
        </ol>
      </header>
      <form
        className="mt-5 flex min-h-0 flex-auto flex-col"
        onSubmit={submit}
        aria-busy={saving}
      >
        <div
          ref={scrollRef}
          className="min-h-0 overflow-y-auto overscroll-contain pr-2"
        >
          {replacement && (
            <Alert variant="warning" compact className="mt-4">
              {t("integrations.rotateWarning")}
            </Alert>
          )}
          {error && invalidField !== "name" && invalidField !== "expiresAt" && (
            <div ref={errorRef} tabIndex={-1} className="mt-4 outline-none">
              <Alert variant="error" compact>
                {error}
              </Alert>
            </div>
          )}
          <fieldset disabled={saving} className="space-y-4">
            {step === 0 && (
              <>
                <FormField
                  id="integration-name"
                  label={t("integrations.name")}
                  required
                  error={invalidField === "name" ? error : null}
                >
                  <Input
                    ref={nameRef}
                    value={draft.name}
                    maxLength={100}
                    disabled={Boolean(replacement)}
                    onChange={(event) => change("name", event.target.value)}
                  />
                </FormField>
                <FormField
                  id="integration-expiry"
                  label={t("integrations.expiry")}
                  required
                  hint={t("integrations.expiryHint")}
                  error={invalidField === "expiresAt" ? error : null}
                >
                  <Input
                    ref={expiryRef}
                    type="date"
                    value={draft.expiresAt}
                    min={expiryBounds.min}
                    max={expiryBounds.max}
                    onChange={(event) =>
                      change("expiresAt", event.target.value)
                    }
                  />
                </FormField>
              </>
            )}
            {step === 1 && (
              <ScopePicker
                scopes={draft.scopes}
                onChange={(value) => change("scopes", value)}
              />
            )}
            {(step === 2 || step === 3) && (
              <>
                {resources.error && (
                  <Alert variant="error" compact>
                    {resources.error}
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-2"
                      onClick={resources.retry}
                    >
                      {t("common.retry")}
                    </Button>
                  </Alert>
                )}
                {resources.loading ? (
                  <p role="status">{t("common.loading")}</p>
                ) : step === 2 ? (
                  <PolicyPicker
                    key="categories"
                    id="category-policy"
                    label={t("integrations.categoryPolicy")}
                    restricted={draft.categoryAllowlistEnabled}
                    onRestricted={(value) =>
                      change("categoryAllowlistEnabled", value)
                    }
                    items={resources.categories}
                    selected={draft.categoryIds}
                    onSelected={(value) => change("categoryIds", value)}
                    category
                  />
                ) : (
                  <PolicyPicker
                    key="sources"
                    id="source-policy"
                    label={t("integrations.sourcePolicy")}
                    restricted={draft.paymentSourceAllowlistEnabled}
                    onRestricted={(value) =>
                      change("paymentSourceAllowlistEnabled", value)
                    }
                    items={resources.paymentSources}
                    selected={draft.paymentSourceIds}
                    onSelected={(value) => change("paymentSourceIds", value)}
                  />
                )}
              </>
            )}
            {step === 4 && (
              <fieldset className="space-y-3 rounded-lg border border-border p-4">
                <legend className="px-1 text-sm font-semibold">
                  {t("integrations.ipAccess")}
                </legend>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    className="mt-1 size-4"
                    type="radio"
                    name="integration-ip-policy"
                    checked={!draft.cidrAllowlistEnabled}
                    onChange={() => change("cidrAllowlistEnabled", false)}
                  />
                  <span>{t("integrations.ipUnrestrictedHint")}</span>
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    className="mt-1 size-4"
                    type="radio"
                    name="integration-ip-policy"
                    checked={draft.cidrAllowlistEnabled}
                    onChange={() => change("cidrAllowlistEnabled", true)}
                  />
                  <span>{t("integrations.enableCidr")}</span>
                </label>
                {draft.cidrAllowlistEnabled && (
                  <>
                    <FormField
                      id="integration-cidrs"
                      label={t("integrations.cidrs")}
                      hint={t("integrations.cidrHint")}
                    >
                      <textarea
                        id="integration-cidrs"
                        aria-invalid={invalidField === "cidrs" || undefined}
                        aria-describedby="integration-cidrs-hint"
                        className="min-h-28 w-full rounded-lg border border-input bg-background p-3 font-mono text-sm focus-visible:outline-ring"
                        value={cidrs}
                        onChange={(event) => setCidrs(event.target.value)}
                        spellCheck={false}
                        autoCapitalize="none"
                        maxLength={64 * 66}
                        placeholder="203.0.113.0/24"
                      />
                    </FormField>
                    {!cidrLines(cidrs).length && (
                      <Alert variant="warning" compact>
                        {t("integrations.emptyIpPolicy")}
                      </Alert>
                    )}
                  </>
                )}
              </fieldset>
            )}
            {step === 5 && (
              <>
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <h4 className="font-semibold">
                    {t("integrations.reviewTitle")}
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("integrations.restrictionsOnlyNarrow")}
                  </p>
                  <dl className="mt-4 space-y-3 text-sm">
                    <SummaryRow
                      label={t("integrations.name")}
                      value={draft.name}
                    />
                    <SummaryRow
                      label={t("integrations.expiry")}
                      value={expiryEndOfDay(
                        draft.expiresAt,
                      ).toLocaleDateString()}
                    />
                    <SummaryRow
                      label={t("integrations.summaryPermissions")}
                      value={
                        draft.scopes.length
                          ? draft.scopes
                              .map((scope) =>
                                knownScope(scope)
                                  ? t(SCOPE_COPY[scope].title)
                                  : scope,
                              )
                              .join(", ")
                          : t("integrations.noScopes")
                      }
                    />
                    <SummaryRow
                      label={t("integrations.categoryPolicy")}
                      value={policySummary(
                        draft.categoryAllowlistEnabled,
                        draft.categoryIds,
                        resources.categories,
                      )}
                    />
                    <SummaryRow
                      label={t("integrations.sourcePolicy")}
                      value={policySummary(
                        draft.paymentSourceAllowlistEnabled,
                        draft.paymentSourceIds,
                        resources.paymentSources,
                      )}
                    />
                    <SummaryRow
                      label={t("integrations.ipAccess")}
                      value={
                        draft.cidrAllowlistEnabled
                          ? cidrLines(cidrs).join(", ") ||
                            t("integrations.emptyIpPolicy")
                          : t("integrations.unrestricted")
                      }
                    />
                  </dl>
                </div>
                {!draft.scopes.length && (
                  <Alert variant="warning" compact>
                    {t("integrations.emptyScopePolicy")}
                  </Alert>
                )}
                <FormField
                  id="integration-password"
                  label={t("settings.currentPassword")}
                  required
                  error={
                    invalidField === "password"
                      ? t("integrations.passwordRequired")
                      : null
                  }
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
                    id="integration-2fa"
                    label={t("integrations.twoFactor")}
                    required
                  >
                    <Input
                      required
                      autoComplete="one-time-code"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={128}
                      value={twoFactor}
                      onChange={(event) => setTwoFactor(event.target.value)}
                    />
                  </FormField>
                )}
                <p className="text-xs text-muted-foreground">
                  {t("integrations.uncertainIssuance")}
                </p>
              </>
            )}
          </fieldset>
        </div>
        <div className="mt-4 flex shrink-0 flex-wrap justify-between gap-2 border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => {
              if (step === 0) onClose();
              else {
                setPassword("");
                setTwoFactor("");
                setError(null);
                setInvalidField(null);
                setStep((current) => current - 1);
              }
            }}
          >
            {step === 0 ? t("common.cancel") : t("common.previous")}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={saving} onClick={advance}>
              {t("common.next")}
            </Button>
          ) : (
            <PendingButton
              type="submit"
              isPending={saving}
              pendingLabel={t("settings.saving")}
            >
              {replacement
                ? t("integrations.confirmRotate")
                : t("integrations.issue")}
            </PendingButton>
          )}
        </div>
      </form>
    </Modal>
  );

  function policySummary(
    enabled: boolean,
    ids: string[],
    options: PolicyOption[],
  ) {
    return enabled
      ? ids
          .map(
            (id) =>
              options.find((item) => item.id === id)?.label ??
              t("integrations.unavailableResourceName"),
          )
          .join(", ") || t("integrations.emptyResourcePolicy")
      : t("integrations.unrestricted");
  }
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border/70 pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{value}</dd>
    </div>
  );
}

function ScopePicker({
  scopes,
  onChange,
}: {
  scopes: string[];
  onChange: (value: string[]) => void;
}) {
  const { t } = useTranslation();
  const groups: Array<{
    label:
      | "integrations.scopeWrite"
      | "integrations.scopeRead"
      | "integrations.scopeMetadata";
    scopes: IntegrationScope[];
  }> = [
    {
      label: "integrations.scopeWrite",
      scopes: [
        "transactions:create",
        "transactions:update-own",
        "transactions:delete-own",
      ],
    },
    { label: "integrations.scopeRead", scopes: ["transactions:read-own"] },
    {
      label: "integrations.scopeMetadata",
      scopes: ["categories:read", "payment-sources:read"],
    },
  ];
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t("integrations.scopeIndependence")}
      </p>
      {groups.map((group) => (
        <fieldset
          key={group.label}
          className="rounded-lg border border-border p-4"
        >
          <legend className="px-1 text-sm font-semibold">
            {t(group.label)}
          </legend>
          {group.scopes.map((scope) => (
            <label
              key={scope}
              className="mt-2 flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted"
            >
              <input
                type="checkbox"
                className="mt-1 size-4"
                checked={scopes.includes(scope)}
                onChange={() =>
                  onChange(
                    scopes.includes(scope)
                      ? scopes.filter((value) => value !== scope)
                      : [...scopes, scope],
                  )
                }
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {t(SCOPE_COPY[scope].title)}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
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
  id,
  label,
  restricted,
  onRestricted,
  items,
  selected,
  onSelected,
  category = false,
}: {
  id: string;
  label: string;
  restricted: boolean;
  onRestricted: (value: boolean) => void;
  items: PolicyOption[];
  selected: string[];
  onSelected: (value: string[]) => void;
  category?: boolean;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const missing = selected.filter(
    (selectedId) => !items.some((item) => item.id === selectedId),
  );
  const options: PolicyOption[] = [
    ...items,
    ...missing.map((missingId) => ({
      id: missingId,
      label: t("integrations.unavailableResourceName"),
    })),
  ];
  const visibleOptions = options.filter((item) =>
    item.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <fieldset className="space-y-3 rounded-lg border border-border p-4">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="radio"
          name={id}
          className="mt-1 size-4"
          checked={!restricted}
          onChange={() => onRestricted(false)}
        />
        <span>
          <span className="block font-medium">
            {t("integrations.unrestricted")}
          </span>
          <span className="block text-xs text-muted-foreground">
            {t(
              category
                ? "integrations.categoryUnrestrictedHint"
                : "integrations.unrestrictedHint",
            )}
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="radio"
          name={id}
          className="mt-1 size-4"
          checked={restricted}
          onChange={() => onRestricted(true)}
        />
        <span>{t("integrations.restricted")}</span>
      </label>
      {restricted && (
        <>
          {!selected.length && (
            <Alert compact variant="warning">
              {t("integrations.emptyResourcePolicy")}
            </Alert>
          )}
          {category && (
            <p className="text-xs text-muted-foreground">
              {t("integrations.uncategorizedRestricted")}
            </p>
          )}
          <FormField
            id={`${id}-search`}
            label={t("integrations.searchResources")}
          >
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </FormField>
          <p className="text-xs text-muted-foreground" role="status">
            {t("integrations.selectedCount", { count: selected.length })}
          </p>
          <div className="space-y-1 rounded-lg bg-muted/40 p-2">
            {!items.length && !missing.length && (
              <p className="p-2 text-sm text-muted-foreground">
                {t("integrations.noActiveResources")}
              </p>
            )}
            {options.length > 0 && visibleOptions.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">
                {t("integrations.noMatchingResources")}
              </p>
            )}
            {visibleOptions.map((item) => (
              <label
                key={item.id}
                className="flex cursor-pointer items-start gap-3 rounded-md p-2 text-sm hover:bg-background"
              >
                <input
                  type="checkbox"
                  className="mt-1 size-4"
                  checked={selected.includes(item.id)}
                  disabled={
                    !selected.includes(item.id) && selected.length >= 200
                  }
                  onChange={() =>
                    onSelected(
                      selected.includes(item.id)
                        ? selected.filter((value) => value !== item.id)
                        : [...selected, item.id],
                    )
                  }
                />
                <span
                  className="min-w-0 break-words"
                  style={{ paddingLeft: `${(item.depth ?? 0) * 12}px` }}
                >
                  {item.icon && <span aria-hidden="true">{item.icon} </span>}
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        </>
      )}
    </fieldset>
  );
}
