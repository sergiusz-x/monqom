import type { SpendingSummary } from "@/types/dashboard";
import { formatCurrency } from "@/lib/money";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";

interface MonthlySpendingSummaryProps {
  summary: SpendingSummary;
  monthLabel: string;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

function formatChange(summary: SpendingSummary, t: TFunction): string {
  if (summary.changePercentage === null) {
    return t("dashboard.noPrevious");
  }

  if (summary.direction === "flat") {
    return t("dashboard.noChange");
  }

  return t("dashboard.changeVsPrevious", {
    value: Math.abs(summary.changePercentage).toFixed(1),
    direction: t(
      summary.direction === "up" ? "dashboard.up" : "dashboard.down",
    ),
  });
}

function getDirectionSymbol(direction: SpendingSummary["direction"]): string {
  if (direction === "up") return "↑";
  if (direction === "down") return "↓";
  return "→";
}

export function MonthlySpendingSummary({
  summary,
  monthLabel,
  onPreviousMonth,
  onNextMonth,
}: MonthlySpendingSummaryProps) {
  const { t } = useTranslation();
  return (
    <SectionCard
      padding="spacious"
      elevation="raised"
      aria-label={t("dashboard.summary")}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.totalSpending")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {formatCurrency(summary.currentTotal, summary.currency)}
          </h1>
        </div>
        <div
          className="flex items-center gap-2"
          aria-label={t("dashboard.monthSelector")}
        >
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            onClick={onPreviousMonth}
            aria-label={t("dashboard.previousMonth")}
          >
            ←
          </Button>
          <span className="min-w-28 text-center text-sm font-medium">
            {monthLabel}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-lg"
            onClick={onNextMonth}
            aria-label={t("dashboard.nextMonth")}
          >
            →
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("dashboard.previousMonth")}
          </p>
          <p className="mt-1 text-lg font-medium">
            {formatCurrency(summary.previousTotal, summary.currency)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("dashboard.change")}
          </p>
          <p className="mt-1 text-lg font-medium">
            {getDirectionSymbol(summary.direction)}{" "}
            {formatCurrency(Math.abs(summary.changeAmount), summary.currency)}
          </p>
          <p className="text-sm text-muted-foreground">
            {formatChange(summary, t)}
          </p>
        </div>
      </div>
    </SectionCard>
  );
}
