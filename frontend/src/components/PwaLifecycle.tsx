import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/useToast";

const SERVICE_WORKER_UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export function PwaLifecycle() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();

  useRegisterSW({
    immediate: true,
    onRegisteredSW(_serviceWorkerUrl, nextRegistration) {
      setRegistration(nextRegistration);
    },
    onRegisterError() {
      if (import.meta.env.PROD) {
        showToast(t("messages.updateFailed"), "warning");
      }
    },
  });

  useEffect(() => {
    const goOffline = () => setIsOffline(true);
    const goOnline = () => setIsOffline(false);

    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  useEffect(() => {
    if (!registration) return;

    const checkForUpdate = () => {
      if (navigator.onLine) {
        void registration.update().catch(() => {
          // A later focus, reconnect, or interval will retry the update.
        });
      }
    };

    const intervalId = window.setInterval(
      checkForUpdate,
      SERVICE_WORKER_UPDATE_INTERVAL_MS,
    );
    window.addEventListener("focus", checkForUpdate);
    window.addEventListener("online", checkForUpdate);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", checkForUpdate);
      window.removeEventListener("online", checkForUpdate);
    };
  }, [registration]);

  return (
    <>
      {isOffline ? (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-[100] bg-warning px-4 py-2 text-center text-sm font-medium text-warning-foreground"
        >
          {t("messages.offline")}
        </div>
      ) : null}
    </>
  );
}
