import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Card } from "@monqom/ui";
import { getApiErrorMessage, getApiErrorStatus } from "@/lib/api-errors";
import { listIntegrationCredentials } from "@/lib/integration-credentials";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import { paymentSourceName } from "@/lib/payment-sources";
import { useCategories } from "@/hooks/useCategories";
import { usePaymentSources } from "@/hooks/usePaymentSources";
import type { Category } from "@/types/category";
import type { User } from "@/contexts/AuthContext";
import {
  credentialStatus,
  type Integration,
  type IntegrationCredential,
  type IssuedIntegrationSecret,
} from "@/types/integration";
import { IntegrationCredentialForm } from "./integrations/IntegrationCredentialForm";
import { IntegrationSecretDialog } from "./integrations/IntegrationSecretDialog";
import { IntegrationActionDialog } from "./integrations/IntegrationActionDialog";
import { IntegrationCredentialDetails } from "./integrations/IntegrationCredentialDetails";
import {
  INTEGRATION_GUIDE_URL,
  CREDENTIAL_STATUS_COPY,
  knownScope,
  SCOPE_COPY,
  type PolicyOption,
} from "./integrations/credential-policy";

type Target = { integration: Integration; credential: IntegrationCredential };
type Dialog =
  | { kind: "create" }
  | ({ kind: "rotate" | "inspect" | "revoke" | "delete" } & Target)
  | { kind: "secret"; secret: IssuedIntegrationSecret };

export function IntegrationManagementSection({
  workspaceId,
  role,
  user,
  onSaved,
}: {
  workspaceId: string | null;
  role?: "owner" | "admin" | "member";
  user: User | null;
  onSaved: (message: string) => void;
}) {
  if (!workspaceId || !user || (role !== "owner" && role !== "admin"))
    return null;
  // Workspace, identity, or authority changes discard the complete dialog/request lifetime.
  return (
    <IntegrationManagementPanel
      key={`${workspaceId}:${user.id}:${role}`}
      workspaceId={workspaceId}
      user={user}
      onSaved={onSaved}
    />
  );
}

function IntegrationManagementPanel({
  workspaceId,
  user,
  onSaved,
}: {
  workspaceId: string;
  user: User;
  onSaved: (message: string) => void;
}) {
  const { t } = useTranslation();
  const expense = useCategories(workspaceId, false, "expense");
  const income = useCategories(workspaceId, false, "income");
  const sources = usePaymentSources(workspaceId, false);
  const [items, setItems] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const closeDialog = useCallback(() => setDialog(null), []);
  const restoreFocus = useCallback(() => {
    if (trigger.current?.isConnected && !trigger.current.matches(":disabled"))
      return trigger.current;
    return title.current?.isConnected ? title.current : null;
  }, []);
  function openDialog(next: Dialog, element: HTMLElement) {
    trigger.current = element;
    setDialog(next);
  }

  const categories = useMemo(() => {
    function flatten(list: Category[], depth = 0): PolicyOption[] {
      return list.flatMap((item) => [
        {
          id: item.id,
          label: translateSystemLabel(t, item.systemKey, item.name),
          icon: item.icon,
          depth,
        },
        ...flatten(item.children, depth + 1),
      ]);
    }
    return flatten([...expense.categories, ...income.categories]);
  }, [expense.categories, income.categories, t]);
  const paymentSources = useMemo(
    () =>
      sources.paymentSources.map((item) => ({
        id: item.id,
        label: paymentSourceName(item, t),
      })),
    [sources.paymentSources, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    listIntegrationCredentials(workspaceId, controller.signal)
      .then((next) => {
        if (!controller.signal.aborted) {
          setItems(next);
          setError(null);
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setItems([]);
        setError(getApiErrorMessage(cause));
        setLoading(false);
        const status = getApiErrorStatus(cause);
        if (status === 401 || status === 403 || status === 404) setDialog(null);
      });
    return () => controller.abort();
  }, [workspaceId, revision]);

  function reload() {
    setLoading(true);
    setError(null);
    setRevision((current) => current + 1);
  }
  function issued(secret: IssuedIntegrationSecret) {
    // Switching dialogs unmounts the form and drops its password/second-factor state.
    setDialog({ kind: "secret", secret });
    reload();
  }
  const resources = {
    categories,
    paymentSources,
    loading: expense.isLoading || income.isLoading || sources.isLoading,
    error: expense.error || income.error || sources.error,
    retry: () => {
      void expense.retry();
      void income.retry();
      void sources.retry();
    },
  };

  return (
    <section className="space-y-6" aria-labelledby="integrations-title">
      <Card padding="responsive">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2
              id="integrations-title"
              ref={title}
              tabIndex={-1}
              className="text-lg font-semibold outline-none"
            >
              {t("integrations.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("integrations.description")}
            </p>
          </div>
          <Button
            type="button"
            disabled={loading || Boolean(error)}
            aria-haspopup="dialog"
            onClick={(event) =>
              openDialog({ kind: "create" }, event.currentTarget)
            }
          >
            {t("integrations.create")}
          </Button>
        </div>
      </Card>
      <Card padding="responsive">
        <details>
          <summary className="cursor-pointer font-semibold">
            {t("integrations.guideTitle")}
          </summary>
          <div className="mt-3">
            <p className="mt-2 text-sm text-muted-foreground">
              {t("integrations.guideDescription")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("integrations.scopeIndependence")}
            </p>
            <a
              className="mt-3 inline-block text-sm font-medium text-primary underline underline-offset-4"
              href={INTEGRATION_GUIDE_URL}
              target="_blank"
              rel="noreferrer"
            >
              {t("integrations.documentation")}
            </a>
            <p className="mt-3 text-xs text-muted-foreground">
              {t("integrations.workspaceId")}
              <code className="mt-1 block select-all break-all">
                {workspaceId}
              </code>
            </p>
          </div>
        </details>
      </Card>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={loading || Boolean(dialog)}
          onClick={reload}
        >
          {t("integrations.refresh")}
        </Button>
      </div>
      {error && (
        <Alert variant="error" compact>
          {error}
          <Button
            type="button"
            className="mt-2"
            variant="outline"
            onClick={reload}
          >
            {t("common.retry")}
          </Button>
        </Alert>
      )}
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("common.loading")}
        </p>
      ) : !error && items.length === 0 ? (
        <Card padding="responsive">
          <p className="text-sm text-muted-foreground">
            {t("integrations.empty")}
          </p>
        </Card>
      ) : (
        !error &&
        items.map((integration) => (
          <Card key={integration.id} padding="responsive">
            <h3 className="break-words font-semibold">{integration.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("integrations.createdBy", {
                name: integration.createdBy.name,
              })}
            </p>
            <ul className="mt-4 space-y-3">
              {integration.credentials.map((credential) => {
                const status = credentialStatus(credential);
                return (
                  <li
                    key={credential.id}
                    className="rounded-lg border border-border p-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="break-words font-medium">
                        {integration.name}
                      </span>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">
                        {t(CREDENTIAL_STATUS_COPY[status])}
                      </span>
                    </div>
                    <p className="mt-2 text-muted-foreground">
                      {t("integrations.expires", {
                        date: new Date(credential.expiresAt).toLocaleString(),
                      })}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {t("integrations.lastUsed")}:{" "}
                      {credential.lastUsedAt
                        ? new Date(credential.lastUsedAt).toLocaleString()
                        : t("integrations.neverUsed")}
                    </p>
                    <p className="mt-2 break-words">
                      {credential.scopes.length
                        ? credential.scopes
                            .map((scope) =>
                              knownScope(scope)
                                ? t(SCOPE_COPY[scope].title)
                                : scope,
                            )
                            .join(", ")
                        : t("integrations.noScopes")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("integrations.restrictions", {
                        categories: credential.categoryAllowlistEnabled
                          ? credential.categoryIds.length
                          : t("integrations.unrestricted"),
                        sources: credential.paymentSourceAllowlistEnabled
                          ? credential.paymentSourceIds.length
                          : t("integrations.unrestricted"),
                        cidrs: credential.cidrAllowlistEnabled
                          ? credential.allowedCidrs.length
                          : t("integrations.unrestricted"),
                      })}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={(event) =>
                          openDialog(
                            {
                              kind: "inspect",
                              integration,
                              credential,
                            },
                            event.currentTarget,
                          )
                        }
                      >
                        {t("integrations.inspect")}
                      </Button>
                      {status === "active" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            if (credentialStatus(credential) === "active")
                              openDialog(
                                {
                                  kind: "rotate",
                                  integration,
                                  credential,
                                },
                                event.currentTarget,
                              );
                            else reload();
                          }}
                        >
                          {t("integrations.rotate")}
                        </Button>
                      )}
                      {(status === "active" || status === "expired") && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(event) =>
                            openDialog(
                              {
                                kind: "revoke",
                                integration,
                                credential,
                              },
                              event.currentTarget,
                            )
                          }
                        >
                          {t("integrations.revoke")}
                        </Button>
                      )}
                      {status === "revoked" && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(event) =>
                            openDialog(
                              {
                                kind: "delete",
                                integration,
                                credential,
                              },
                              event.currentTarget,
                            )
                          }
                        >
                          {t("integrations.delete")}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))
      )}
      {(dialog?.kind === "create" || dialog?.kind === "rotate") && (
        <IntegrationCredentialForm
          workspaceId={workspaceId}
          user={user}
          resources={resources}
          replacement={dialog.kind === "rotate" ? dialog : undefined}
          onClose={closeDialog}
          returnFocus={restoreFocus}
          onIssued={issued}
        />
      )}
      {dialog?.kind === "secret" && (
        <IntegrationSecretDialog
          secret={dialog.secret}
          onClose={closeDialog}
          returnFocus={restoreFocus}
        />
      )}
      {dialog?.kind === "inspect" && (
        <IntegrationCredentialDetails
          workspaceId={workspaceId}
          integration={dialog.integration}
          credential={dialog.credential}
          categories={categories}
          paymentSources={paymentSources}
          onClose={closeDialog}
          returnFocus={restoreFocus}
        />
      )}
      {(dialog?.kind === "revoke" || dialog?.kind === "delete") && (
        <IntegrationActionDialog
          kind={dialog.kind}
          workspaceId={workspaceId}
          integration={dialog.integration}
          credential={dialog.credential}
          user={user}
          onClose={closeDialog}
          returnFocus={restoreFocus}
          onCompleted={() => {
            onSaved(
              t(
                dialog.kind === "revoke"
                  ? "integrations.revoked"
                  : "integrations.deleted",
              ),
            );
            closeDialog();
            reload();
          }}
        />
      )}
    </section>
  );
}
