import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/ui/empty-state";

export function TransactionEmptyState({ onAdd }: { onAdd: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      title={t("transactions.empty")}
      actionLabel={t("transactions.add")}
      onAction={onAdd}
    />
  );
}
