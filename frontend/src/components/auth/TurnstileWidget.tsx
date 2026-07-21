import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme: "light" | "dark" | "auto";
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

export function TurnstileWidget({
  onTokenChange,
}: {
  onTokenChange: (token: string | null) => void;
}) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!SITE_KEY) return;
    const render = () => {
      if (!containerRef.current || !window.turnstile || widgetIdRef.current)
        return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        theme: "auto",
        callback: onTokenChange,
        "expired-callback": () => onTokenChange(null),
        "error-callback": () => {
          onTokenChange(null);
          setFailed(true);
        },
      });
    };
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = render;
    script.onerror = () => setFailed(true);
    document.head.appendChild(script);
    return () => {
      if (widgetIdRef.current && window.turnstile)
        window.turnstile.remove(widgetIdRef.current);
      script.remove();
    };
  }, [onTokenChange]);
  if (!SITE_KEY) return null;
  if (failed)
    return (
      <p className="text-sm text-destructive">
        {t("auth.securityVerificationFailed")}
      </p>
    );
  return <div ref={containerRef} aria-label={t("auth.securityVerification")} />;
}
