import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Eye, EyeOff } from "lucide-react";
import { Alert, Button, Modal } from "@monqom/ui";
import type { IssuedIntegrationSecret } from "@/types/integration";

const SECRET_LIFETIME_MS = 5 * 60_000;

export function IntegrationSecretDialog({
  secret,
  onClose,
  returnFocus,
}: {
  secret: IssuedIntegrationSecret;
  onClose: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(onClose, SECRET_LIFETIME_MS);
    const hide = () => {
      if (document.visibilityState === "hidden") onClose();
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("pagehide", onClose);
    hide();
    return () => {
      mounted.current = false;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("pagehide", onClose);
    };
  }, [onClose]);

  async function copy() {
    if (copying) return;
    setCopying(true);
    setCopied(false);
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(secret.token);
      if (mounted.current) setCopied(true);
    } catch {
      if (mounted.current) setCopyError(true);
    } finally {
      if (mounted.current) setCopying(false);
    }
  }

  return (
    <Modal
      open
      finalFocus={returnFocus}
      onClose={onClose}
      ariaLabelledBy="integration-secret-title"
      ariaDescribedBy="integration-secret-warning"
      contentClassName="flex max-w-2xl flex-col overflow-hidden"
    >
      <h3
        id="integration-secret-title"
        className="shrink-0 text-lg font-semibold"
      >
        {t("integrations.secretTitle")}
      </h3>
      <div className="mt-3 min-h-0 overflow-y-auto overscroll-contain pr-2">
        <Alert variant="warning" compact>
          <p id="integration-secret-warning">
            {t("integrations.secretWarning")}
          </p>
        </Alert>
        <p className="mt-3 text-sm text-muted-foreground">
          {t("integrations.secretLifetime")}
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">
              {t("integrations.prefix")}
            </dt>
            <dd>
              <code>{secret.tokenPrefix}</code>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">
              {t("integrations.expiry")}
            </dt>
            <dd>{new Date(secret.expiresAt).toLocaleString()}</dd>
          </div>
        </dl>
        <div
          className="mt-4 rounded-lg border border-border bg-muted p-3"
          data-private="true"
          data-sensitive="true"
        >
          {visible ? (
            <code className="block select-all break-all text-xs">
              {secret.token}
            </code>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <EyeOff size={16} aria-hidden="true" />
              {t("integrations.secretHidden")}
            </p>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" disabled={copying} onClick={() => void copy()}>
            <Copy size={16} aria-hidden="true" />
            {t("integrations.copyToken")}
          </Button>
          <Button
            type="button"
            variant="outline"
            aria-pressed={visible}
            onClick={() => setVisible((current) => !current)}
          >
            {visible ? (
              <EyeOff size={16} aria-hidden="true" />
            ) : (
              <Eye size={16} aria-hidden="true" />
            )}
            {t(visible ? "integrations.hideToken" : "integrations.revealToken")}
          </Button>
        </div>
        <div role="status" className="mt-2 text-sm text-muted-foreground">
          {copied ? t("integrations.copied") : null}
        </div>
        {copyError && (
          <Alert variant="error" compact className="mt-2">
            {t("integrations.copyFailed")}
          </Alert>
        )}
      </div>
      <div className="mt-4 shrink-0 border-t border-border pt-4">
        <Button type="button" onClick={onClose}>
          {t("integrations.closeSecret")}
        </Button>
      </div>
    </Modal>
  );
}
