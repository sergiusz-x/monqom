import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";

export function RouteLoadingFallback() {
  const { t } = useTranslation();

  return (
    <div
      className="mx-auto flex min-h-48 w-full max-w-6xl flex-col gap-4 p-6"
      role="status"
      aria-live="polite"
      aria-label={t("common.loading")}
    >
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <span className="sr-only">{t("common.loading")}</span>
    </div>
  );
}
