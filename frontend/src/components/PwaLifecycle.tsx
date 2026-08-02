import { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useTranslation } from "react-i18next";
import { Button } from "@monqom/ui";
import { useToast } from "@/hooks/useToast";

export function PwaLifecycle() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [isOffline, setIsOffline] = useState(() => !navigator.onLine);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError() {
      showToast(t("messages.updateFailed"), "warning");
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
      {needRefresh ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[100] mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-lg"
        >
          <p className="text-sm font-medium">{t("messages.updateAvailable")}</p>
          <Button
            type="button"
            size="sm"
            onClick={() => void updateServiceWorker(true)}
          >
            {t("messages.updateNow")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
