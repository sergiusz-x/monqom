import { useTranslation } from "react-i18next";
import { Button, Modal } from "@monqom/ui";
import {
  credentialStatus,
  type Integration,
  type IntegrationCredential,
} from "@/types/integration";
import {
  CREDENTIAL_STATUS_COPY,
  knownScope,
  SCOPE_COPY,
  type PolicyOption,
} from "./credential-policy";

export function IntegrationCredentialDetails({
  workspaceId,
  integration,
  credential,
  categories,
  paymentSources,
  onClose,
  returnFocus,
}: {
  workspaceId: string;
  integration: Integration;
  credential: IntegrationCredential;
  categories: PolicyOption[];
  paymentSources: PolicyOption[];
  onClose: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const { t } = useTranslation();
  const formatDate = (date: string | null) =>
    date ? new Date(date).toLocaleString() : t("integrations.notRecorded");
  const policy = (enabled: boolean, ids: string[], options: PolicyOption[]) =>
    !enabled
      ? t("integrations.unrestricted")
      : ids.length
        ? ids
            .map(
              (id) =>
                options.find((item) => item.id === id)?.label ??
                t("integrations.unavailableResourceName"),
            )
            .join(", ")
        : t("integrations.emptyResourcePolicy");
  const summary = [
    [t("integrations.expiry"), formatDate(credential.expiresAt)],
    [
      t("integrations.lastUsed"),
      credential.lastUsedAt
        ? formatDate(credential.lastUsedAt)
        : t("integrations.neverUsed"),
    ],
    ...(credential.revokedAt
      ? [[t("integrations.revokedAt"), formatDate(credential.revokedAt)]]
      : []),
  ];
  const restrictions = [
    [
      t("integrations.categoryPolicy"),
      policy(
        credential.categoryAllowlistEnabled,
        credential.categoryIds,
        categories,
      ),
    ],
    [
      t("integrations.sourcePolicy"),
      policy(
        credential.paymentSourceAllowlistEnabled,
        credential.paymentSourceIds,
        paymentSources,
      ),
    ],
    [
      t("integrations.ipAccess"),
      credential.cidrAllowlistEnabled
        ? credential.allowedCidrs.join(", ") || t("integrations.emptyIpPolicy")
        : t("integrations.unrestricted"),
    ],
  ];
  const technical = [
    [t("integrations.prefix"), credential.tokenPrefix],
    [t("integrations.workspaceId"), workspaceId],
    [t("integrations.integrationId"), integration.id],
    [t("integrations.credentialId"), credential.id],
    [t("integrations.creator"), integration.createdBy.name],
    [t("integrations.integrationCreated"), formatDate(integration.createdAt)],
    [t("integrations.versionCreated"), formatDate(credential.createdAt)],
  ];
  return (
    <Modal
      open
      finalFocus={returnFocus}
      onClose={onClose}
      ariaLabelledBy="integration-details-title"
      contentClassName="flex max-w-2xl flex-col overflow-hidden"
    >
      <header className="shrink-0">
        <h3
          id="integration-details-title"
          className="break-words text-lg font-semibold"
        >
          {integration.name}
        </h3>
        <span className="mt-2 inline-flex rounded-full bg-muted px-3 py-1 text-sm font-medium">
          {t(CREDENTIAL_STATUS_COPY[credentialStatus(credential)])}
        </span>
      </header>
      <div className="mt-5 min-h-0 overflow-y-auto overscroll-contain pr-2">
        <dl className="grid gap-4 rounded-lg border border-border p-4 text-sm sm:grid-cols-2">
          {summary.map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="mt-1 break-words [overflow-wrap:anywhere]">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <section
          className="mt-6"
          aria-labelledby="integration-permissions-title"
        >
          <h4 id="integration-permissions-title" className="font-semibold">
            {t("integrations.summaryPermissions")}
          </h4>
          {credential.scopes.length ? (
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
              {credential.scopes.map((scope) => (
                <li key={scope}>
                  {knownScope(scope) ? t(SCOPE_COPY[scope].title) : scope}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("integrations.noScopes")}
            </p>
          )}
        </section>
        <section
          className="mt-6"
          aria-labelledby="integration-restrictions-title"
        >
          <h4 id="integration-restrictions-title" className="font-semibold">
            {t("integrations.restrictionsTitle")}
          </h4>
          <dl className="mt-3 divide-y divide-border text-sm">
            {restrictions.map(([label, value]) => (
              <div key={label} className="py-3 first:pt-0 sm:flex sm:gap-4">
                <dt className="text-muted-foreground sm:w-40 sm:shrink-0">
                  {label}
                </dt>
                <dd className="mt-1 min-w-0 break-words sm:mt-0 [overflow-wrap:anywhere]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
        <details className="mt-5 rounded-lg border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {t("integrations.technicalDetails")}
          </summary>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("integrations.detailsHint")}
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            {technical.map(([label, value]) => (
              <div key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mt-1 break-words [overflow-wrap:anywhere]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </details>
        <details className="mt-3 rounded-lg border border-border p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {t("integrations.versionHistory")}
          </summary>
          <ol className="mt-3 space-y-3 text-sm">
            {integration.credentials.map((version) => (
              <li
                key={version.id}
                className="rounded-lg border border-border p-3"
              >
                <code className="break-all">{version.tokenPrefix}</code>
                <span className="ml-2">
                  {t(CREDENTIAL_STATUS_COPY[credentialStatus(version)])}
                </span>
                <p className="mt-1 text-muted-foreground">
                  {t("integrations.createdOn", {
                    date: formatDate(version.createdAt),
                  })}
                </p>
                {version.revokedAt && (
                  <p className="text-muted-foreground">
                    {t("integrations.revokedOn", {
                      date: formatDate(version.revokedAt),
                    })}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </details>
      </div>
      <div className="mt-4 shrink-0 border-t border-border pt-4">
        <Button type="button" onClick={onClose}>
          {t("integrations.closeDetails")}
        </Button>
      </div>
    </Modal>
  );
}
