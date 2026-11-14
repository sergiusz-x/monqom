import { useState } from "react";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { useSalaryPrivacy } from "@/contexts/SalaryPrivacyContext";
import type { SpendingSummary } from "@/types/dashboard";
import { formatCurrency } from "@/lib/money";
import { useTranslation } from "react-i18next";
import { Button, SectionCard } from "@monqom/ui";
import { DashboardMonthPicker } from "./DashboardMonthPicker";

interface MonthlySpendingSummaryProps {
  summary: SpendingSummary;
  spendingPace?: {
    changePercentage: number;
    direction: "up" | "down" | "flat";
  } | null;
  month: string;
  currentMonth: string;
  onSelectMonth: (month: string) => void;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
}

export function MonthlySpendingSummary({
  summary,
  spendingPace,
  month,
  currentMonth,
  onSelectMonth,
  onPreviousMonth,
  onNextMonth,
}: MonthlySpendingSummaryProps) {
  const { t } = useTranslation();
  const user = useOptionalAuth()?.user;
  const hideAmounts = Boolean(user?.hideSalaryAmounts);
  const { revealAll, hideVersion } = useSalaryPrivacy();
  const privacyKey = `${hideVersion}:${user?.id ?? "anonymous"}:${hideAmounts ? user?.updatedAt : "disabled"}`;
  const [privacy, setPrivacy] = useState({
    key: privacyKey,
    income: false,
    balance: false,
  });
  if (privacy.key !== privacyKey) {
    setPrivacy({ key: privacyKey, income: false, balance: false });
  }
  const incomeRevealed =
    revealAll || (privacy.key === privacyKey && privacy.income);
  const balanceRevealed =
    revealAll || (privacy.key === privacyKey && privacy.balance);
  return (
    <section aria-label={t("dashboard.summary")} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
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
          <DashboardMonthPicker
            month={month}
            currentMonth={currentMonth}
            onSelectMonth={onSelectMonth}
          />
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
      <SectionCard padding="responsive" elevation="raised">
        <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="min-w-0 pb-4 sm:pb-0 sm:pr-5">
            <p className="text-sm text-muted-foreground">
              {t("dashboard.income")}
            </p>
            {hideAmounts && !incomeRevealed ? (
              <button
                type="button"
                data-sensitive-amount="masked"
                aria-label={t("dashboard.revealIncome")}
                className="mt-1 block cursor-pointer select-none border-0 bg-transparent p-0 text-left text-2xl font-semibold tracking-tight tabular-nums text-emerald-600 blur-[8px] transition-[filter] hover:blur-[5px] focus-visible:blur-[5px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring dark:text-emerald-400"
                onClick={() =>
                  setPrivacy((current) => ({ ...current, income: true }))
                }
              >
                {formatCurrency(summary.incomeTotal, summary.currency)}
              </button>
            ) : (
              <p
                data-sensitive-amount={hideAmounts ? "revealed" : undefined}
                className="mt-1 break-words text-2xl font-semibold tracking-tight tabular-nums text-emerald-600 dark:text-emerald-400"
              >
                {formatCurrency(summary.incomeTotal, summary.currency)}
              </p>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              <span>{t("dashboard.netBalance")}:</span>
              {hideAmounts && !balanceRevealed ? (
                <button
                  type="button"
                  data-sensitive-amount="masked"
                  aria-label={t("dashboard.revealBalance")}
                  className="-my-2 cursor-pointer select-none border-0 bg-transparent py-2 tabular-nums blur-[8px] transition-[filter] hover:blur-[5px] focus-visible:blur-[5px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  onClick={() =>
                    setPrivacy((current) => ({ ...current, balance: true }))
                  }
                >
                  {formatCurrency(summary.netTotal, summary.currency)}
                </button>
              ) : (
                <span
                  data-sensitive-amount={hideAmounts ? "revealed" : undefined}
                  className="tabular-nums"
                >
                  {formatCurrency(summary.netTotal, summary.currency)}
                </span>
              )}
            </div>
          </div>
          <div className="min-w-0 pt-4 sm:pl-5 sm:pt-0">
            <p className="text-sm text-muted-foreground">
              {t("dashboard.totalSpending")}
            </p>
            <p className="mt-1 break-words text-2xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(summary.currentTotal, summary.currency)}
            </p>
            {month === currentMonth
              ? spendingPace && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {spendingPace.direction === "flat"
                      ? t("dashboard.paceNoChange")
                      : t("dashboard.paceChange", {
                          value: Math.abs(
                            spendingPace.changePercentage,
                          ).toFixed(1),
                          direction: t(
                            spendingPace.direction === "up"
                              ? "dashboard.up"
                              : "dashboard.down",
                          ),
                        })}
                  </p>
                )
              : month < currentMonth &&
                summary.previousTotal > 0 &&
                summary.changePercentage !== null && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {summary.direction === "flat"
                      ? t("dashboard.noChange")
                      : t("dashboard.changeVsPrevious", {
                          value: Math.abs(summary.changePercentage).toFixed(1),
                          direction: t(
                            summary.direction === "up"
                              ? "dashboard.up"
                              : "dashboard.down",
                          ),
                        })}
                  </p>
                )}
          </div>
        </div>
      </SectionCard>
    </section>
  );
}
