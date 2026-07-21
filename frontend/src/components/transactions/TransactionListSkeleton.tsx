import { useTranslation } from "react-i18next";
import { AsyncState } from "@/components/ui/async-state";

export function TransactionListSkeleton() {
  const { t } = useTranslation();
  return (
    <AsyncState
      status="loading"
      message={t("transactions.loading")}
      skeletonRows={6}
    />
  );
}
