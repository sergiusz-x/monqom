import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

interface TransactionPaginationProps {
  total: number;
  limit: number;
  offset: number;
  onPrev: () => void;
  onNext: () => void;
}

export function TransactionPagination({
  total,
  limit,
  offset,
  onPrev,
  onNext,
}: TransactionPaginationProps) {
  const { t } = useTranslation();
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">
        {t("transactions.page", { page, totalPages })}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          variant="outline"
        >
          {t("common.previous")}
        </Button>
        <Button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          variant="outline"
        >
          {t("common.next")}
        </Button>
      </div>
    </div>
  );
}
