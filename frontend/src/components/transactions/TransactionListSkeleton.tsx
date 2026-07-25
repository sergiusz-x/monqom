import { useTranslation } from "react-i18next";
import { AsyncState } from "@monqom/ui";


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
