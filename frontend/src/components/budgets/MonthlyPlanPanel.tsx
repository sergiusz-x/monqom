import { useState } from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Button,
  FieldError,
  FormField,
  Modal,
  MoneyInput,
  PendingButton,
  ProgressBar,
  SectionCard,
  SegmentedControl,
} from "@monqom/ui";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { useGoals } from "@/hooks/useGoals";
import { useCategories } from "@/hooks/useCategories";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import api from "@/lib/api";
import { getApiErrorStatus } from "@/lib/api-errors";
import { formatCurrency } from "@/lib/money";
import { queryKeys } from "@/lib/query-client";

interface Allocation {
  id: string;
  goal_id: string | null;
  name: string;
  archived: boolean;
  amount_cents: number;
  deposited_cents: number;
  withdrawn_cents: number;
  remaining_cents: number;
}
interface MonthlyPlan {
  currency: string;
  funds_cents: number;
  manual_funds_cents: number;
  income_mode: "manual" | "transactions";
  category_ids: string[];
  income_planned: boolean;
  confirmed_at: string;
  revision: number;
  stale: boolean;
  expense_commitments_cents: number;
  goal_commitments_cents: number;
  unallocated_cents: number | null;
  overlaps: boolean;
  allocations: Allocation[];
}

export function MonthlyPlanPanel({
  workspaceId,
  month,
  currentMonth,
  currency,
}: {
  workspaceId: string;
  month: string;
  currentMonth: string;
  currency: string;
}) {
  const { t, i18n } = useTranslation();
  const user = useOptionalAuth()?.user;
  const client = useQueryClient();
  const key = [...queryKeys.budgets(workspaceId), "plan", month];
  const url = `/workspaces/${encodeURIComponent(workspaceId)}/budgets/plan/${encodeURIComponent(month)}`;
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) =>
      (await api.get<MonthlyPlan | null>(url, { signal })).data,
    enabled: Boolean(workspaceId),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });
  const {
    goals,
    isLoading: goalsLoading,
    error: goalsError,
    retry: retryGoals,
  } = useGoals(workspaceId);
  const incomeCategories = useCategories(workspaceId, true, "income");
  const plan = query.data;
  const privacyKey = `${user?.id ?? "anonymous"}:${Boolean(user?.hideSalaryAmounts)}`;
  const [privacy, setPrivacy] = useState({ key: privacyKey, revealed: false });
  if (privacy.key !== privacyKey) {
    setPrivacy({ key: privacyKey, revealed: false });
  }
  const [activeSegment, setActiveSegment] = useState<string | null>(null);
  const [fundsOpen, setFundsOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [funds, setFunds] = useState<number | null>(null);
  const [incomeMode, setIncomeMode] = useState<"manual" | "transactions">(
    "manual",
  );
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState(true);
  const [amounts, setAmounts] = useState<Record<string, number | null>>({});
  const [removedAllocations, setRemovedAllocations] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const display = (value: number) =>
    formatCurrency(value / 100, plan?.currency ?? currency);
  const expenses = Math.max(0, plan?.expense_commitments_cents ?? 0);
  const savings = Math.max(0, plan?.goal_commitments_cents ?? 0);
  const unallocated = Math.max(0, plan?.unallocated_cents ?? 0);
  const chartTotal = expenses + savings + unallocated;
  const segments = [
    {
      id: "expenses",
      label: t("budgets.expenseCommitments"),
      value: expenses,
      color: "bg-primary",
    },
    {
      id: "savings",
      label: t("budgets.goalCommitments"),
      value: savings,
      color: "bg-emerald-500",
    },
    {
      id: "unallocated",
      label: t("budgets.unallocated"),
      value: unallocated,
      color: "bg-muted-foreground/25",
    },
  ];

  function openFunds() {
    setFunds(
      plan?.income_planned
        ? (plan.manual_funds_cents ?? plan.funds_cents)
        : null,
    );
    setIncomeMode(plan?.income_mode ?? "manual");
    setCategoryIds(plan?.category_ids ?? []);
    setAllCategories(!plan?.category_ids?.length);
    setError(null);
    setFundsOpen(true);
  }
  function openGoals() {
    setRemovedAllocations([]);
    setAmounts(
      Object.fromEntries(
        (plan?.allocations ?? []).flatMap((item) =>
          item.goal_id ? [[item.goal_id, item.amount_cents]] : [],
        ),
      ),
    );
    setError(null);
    setGoalsOpen(true);
  }
  async function confirmFunds() {
    if (
      (incomeMode === "manual" && funds === null) ||
      (funds !== null && (funds < 0 || funds > 2147483647))
    ) {
      setError(t("budgets.planInvalidAmount"));
      return;
    }
    if (
      incomeMode === "transactions" &&
      !allCategories &&
      !categoryIds.length
    ) {
      setError(t("budgets.selectIncomeCategory"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await api.put<MonthlyPlan>(`${url}/funds`, {
        funds_cents: funds ?? 0,
        income_mode: incomeMode,
        category_ids:
          incomeMode === "transactions" && !allCategories ? categoryIds : [],
        ...(plan?.revision ? { expected_revision: plan.revision } : {}),
      });
      client.setQueryData(key, response.data);
      setFundsOpen(false);
    } catch (cause) {
      if (getApiErrorStatus(cause) === 409) {
        setError(t("budgets.planConflict"));
        await query.refetch();
      } else setError(t("budgets.planSaveError"));
    } finally {
      setPending(false);
    }
  }
  async function saveGoals() {
    if (!plan) return;
    if (
      Object.values(amounts).some(
        (value) => value !== null && (value < 0 || value > 2147483647),
      )
    ) {
      setError(t("budgets.planInvalidAmount"));
      return;
    }
    setPending(true);
    setError(null);
    try {
      const allocations = Object.entries(amounts).flatMap(
        ([goal_id, amount_cents]) =>
          amount_cents && amount_cents > 0 ? [{ goal_id, amount_cents }] : [],
      );
      const response = await api.put<MonthlyPlan>(`${url}/goals`, {
        expected_revision: plan.revision,
        allocations,
        ...(removedAllocations.length
          ? { removed_allocation_ids: removedAllocations }
          : {}),
      });
      client.setQueryData(key, response.data);
      setGoalsOpen(false);
    } catch (cause) {
      if (getApiErrorStatus(cause) === 409) {
        setError(t("budgets.planConflict"));
        await query.refetch();
      } else setError(t("budgets.planSaveError"));
    } finally {
      setPending(false);
    }
  }
  if (query.isPending) return null;
  if (query.isError)
    return (
      <SectionCard padding="default">
        <p className="text-sm text-destructive">{t("budgets.planLoadError")}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => void query.refetch()}
        >
          {t("common.retry")}
        </Button>
      </SectionCard>
    );
  if (
    plan &&
    user?.hideSalaryAmounts &&
    !(privacy.key === privacyKey && privacy.revealed)
  )
    return (
      <SectionCard padding="default">
        <h2 className="text-lg font-semibold">{t("budgets.monthlyPlan")}</h2>
        <button
          type="button"
          className="mt-3 block cursor-pointer rounded-md text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          aria-label={t("budgets.revealPlan")}
          onClick={() => setPrivacy({ key: privacyKey, revealed: true })}
        >
          <span
            aria-hidden="true"
            className="block select-none text-2xl font-semibold blur-[8px]"
          >
            {display(plan.unallocated_cents ?? plan.funds_cents)}
          </span>
          <span className="mt-2 block text-sm text-muted-foreground">
            {t("budgets.revealPlan")}
          </span>
        </button>
      </SectionCard>
    );
  return (
    <>
      <SectionCard padding="default" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">
              {t("budgets.monthlyPlan")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(
                plan?.income_planned
                  ? "budgets.planDescription"
                  : "budgets.planEmpty",
              )}
            </p>
          </div>
          <Button
            type="button"
            variant={plan?.income_planned ? "outline" : "default"}
            onClick={openFunds}
          >
            {t(
              plan?.income_planned
                ? "budgets.updateFunds"
                : "budgets.startPlan",
            )}
          </Button>
        </div>
        {plan && (
          <>
            {plan.stale ? (
              <p
                role="status"
                className="rounded-lg bg-amber-500/10 p-3 text-sm text-foreground"
              >
                {t("budgets.planCurrencyMismatch")}
              </p>
            ) : null}
            {plan.income_planned && !plan.stale ? (
              <div className="space-y-4 border-t border-border pt-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm text-muted-foreground">
                    {t(
                      plan.income_mode === "transactions"
                        ? "budgets.incomeFromTransactions"
                        : "budgets.availableFunds",
                    )}
                  </span>
                  <span className="text-lg font-semibold tabular-nums">
                    {display(plan.funds_cents)}
                  </span>
                </div>
                {plan.income_mode === "transactions" &&
                  month > currentMonth &&
                  plan.funds_cents === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t("budgets.futureIncomeHint")}
                    </p>
                  )}
                <div
                  aria-hidden="true"
                  className="flex h-3 overflow-hidden rounded-full bg-muted"
                >
                  {chartTotal > 0 &&
                    segments.map((item) => (
                      <div
                        key={item.id}
                        data-segment={item.id}
                        className={`${item.color} transition-opacity ${activeSegment && activeSegment !== item.id ? "opacity-40" : "opacity-100"}`}
                        style={{ width: `${(item.value / chartTotal) * 100}%` }}
                        onMouseEnter={() => setActiveSegment(item.id)}
                        onMouseLeave={() => setActiveSegment(null)}
                      />
                    ))}
                </div>
                <div className="-mx-2 grid grid-cols-1 sm:grid-cols-3">
                  {segments.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-2 rounded-md px-2 py-2 transition-colors ${activeSegment === item.id ? "bg-muted/60" : ""}`}
                      onMouseEnter={() => setActiveSegment(item.id)}
                      onMouseLeave={() => setActiveSegment(null)}
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${item.color}`}
                      />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {item.label}
                        </p>
                        <p className="mt-1 break-words font-semibold tabular-nums">
                          {display(item.value)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {(plan.unallocated_cents ?? 0) < 0 && (
                  <p
                    role="status"
                    className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                  >
                    {t("budgets.overplanned")}:{" "}
                    <span className="font-semibold tabular-nums">
                      {display(Math.abs(plan.unallocated_cents ?? 0))}
                    </span>
                    <span className="mt-1 block text-xs">
                      {t("budgets.overplannedChartHint")}
                    </span>
                  </p>
                )}
              </div>
            ) : (
              <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("budgets.expenseCommitments")}
                  </p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {display(plan.expense_commitments_cents)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t("budgets.goalCommitments")}
                  </p>
                  <p className="mt-1 font-semibold tabular-nums">
                    {display(plan.goal_commitments_cents)}
                  </p>
                </div>
              </div>
            )}
            {plan.overlaps && (
              <p className="text-xs text-muted-foreground">
                {t("budgets.overlapExplanation")}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-sm font-medium">
                {t("budgets.plannedGoals")}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openGoals}
              >
                {t("budgets.planGoals")}
              </Button>
            </div>
            {plan.allocations.length ? (
              <ul className="divide-y divide-border">
                {plan.allocations.map((item) => {
                  const netDeposited =
                    item.deposited_cents - item.withdrawn_cents;
                  const progress =
                    item.amount_cents > 0
                      ? (netDeposited / item.amount_cents) * 100
                      : 0;
                  const completed =
                    item.amount_cents > 0 && netDeposited >= item.amount_cents;
                  return (
                    <li key={item.id} className="space-y-2 py-3 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="min-w-0 break-words">
                          {item.name}
                          {!item.goal_id && ` (${t("budgets.deletedGoal")})`}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          {t(
                            item.withdrawn_cents > 0
                              ? "budgets.goalProgressNet"
                              : "budgets.goalProgress",
                            {
                              deposited: display(netDeposited),
                              planned: display(item.amount_cents),
                            },
                          )}
                          {completed && (
                            <span className="ml-2 font-semibold text-emerald-600 dark:text-emerald-400">
                              {t("budgets.goalCompletedPercent", {
                                percent: new Intl.NumberFormat(
                                  i18n.resolvedLanguage,
                                  { maximumFractionDigits: 1 },
                                ).format(progress),
                              })}
                            </span>
                          )}
                        </span>
                      </div>
                      {!completed && (
                        <ProgressBar
                          value={progress}
                          ariaLabel={t("budgets.goalProgressLabel", {
                            name: item.name,
                          })}
                          indicatorClassName="bg-emerald-500"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("budgets.noPlannedGoals")}
              </p>
            )}
          </>
        )}
      </SectionCard>
      <Modal
        open={fundsOpen}
        onClose={() => setFundsOpen(false)}
        preventClose={pending}
        ariaLabel={t("budgets.confirmFundsTitle")}
        contentClassName="max-w-lg"
      >
        <h2 className="text-lg font-semibold">
          {t("budgets.confirmFundsTitle")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            incomeMode === "manual"
              ? "budgets.confirmFundsDescription"
              : "budgets.incomeSyncDescription",
          )}
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void confirmFunds();
          }}
        >
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("budgets.incomeSource")}</p>
            <SegmentedControl
              value={incomeMode}
              onChange={setIncomeMode}
              ariaLabel={t("budgets.incomeSource")}
              options={[
                { value: "manual", label: t("budgets.incomeManual") },
                { value: "transactions", label: t("budgets.incomeSync") },
              ]}
            />
          </div>
          {incomeMode === "manual" ? (
            <FormField
              id="plan-funds"
              label={t("budgets.availableFunds")}
              error={error}
            >
              <MoneyInput
                currency={currency}
                minorUnits={funds}
                onMinorUnitsChange={setFunds}
              />
            </FormField>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {t("budgets.incomeCategories")}
              </p>
              <SegmentedControl
                value={allCategories ? "all" : "selected"}
                onChange={(value) => setAllCategories(value === "all")}
                ariaLabel={t("budgets.incomeCategories")}
                options={[
                  { value: "all", label: t("budgets.allCategories") },
                  { value: "selected", label: t("budgets.selectedCategories") },
                ]}
              />
              {!allCategories &&
                (incomeCategories.isLoading ? (
                  <p>{t("common.loading")}</p>
                ) : incomeCategories.error ? (
                  <div>
                    <p className="text-sm text-destructive">
                      {incomeCategories.error}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void incomeCategories.retry()}
                    >
                      {t("common.retry")}
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {t("budgets.incomeCategoryHint")}
                    </p>
                    <div className="max-h-56 space-y-1 overflow-y-auto rounded-lg bg-muted/40 p-2">
                      {incomeCategories.categories
                        .flatMap((category) => [category, ...category.children])
                        .filter(
                          (category) =>
                            !category.isArchived ||
                            categoryIds.includes(category.id),
                        )
                        .map((category) => (
                          <label
                            key={category.id}
                            className={`flex cursor-pointer items-center gap-3 rounded-md p-2 text-sm hover:bg-background ${category.parentId ? "pl-7" : ""}`}
                          >
                            <input
                              type="checkbox"
                              className="size-4 shrink-0 accent-primary"
                              checked={
                                categoryIds.includes(category.id) ||
                                Boolean(
                                  category.parentId &&
                                  categoryIds.includes(category.parentId),
                                )
                              }
                              disabled={Boolean(
                                category.parentId &&
                                categoryIds.includes(category.parentId),
                              )}
                              onChange={(event) =>
                                setCategoryIds((ids) =>
                                  event.target.checked
                                    ? [...ids, category.id]
                                    : ids.filter((id) => id !== category.id),
                                )
                              }
                            />
                            {category.icon}{" "}
                            {translateSystemLabel(
                              t,
                              category.systemKey,
                              category.name,
                            )}
                          </label>
                        ))}
                    </div>
                  </>
                ))}
              <FieldError message={error} className="text-sm" />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <PendingButton
              type="submit"
              isPending={pending}
              disabled={
                incomeMode === "transactions" &&
                !allCategories &&
                (incomeCategories.isLoading || Boolean(incomeCategories.error))
              }
              pendingLabel={t("settings.saving")}
            >
              {t("common.save")}
            </PendingButton>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setFundsOpen(false)}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={goalsOpen}
        onClose={() => setGoalsOpen(false)}
        preventClose={pending}
        ariaLabel={t("budgets.planGoals")}
        contentClassName="max-w-lg"
      >
        <h2 className="text-lg font-semibold">{t("budgets.planGoals")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("budgets.planGoalsDescription")}
        </p>
        <form
          className="mt-4 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void saveGoals();
          }}
        >
          {plan?.allocations
            .filter((item) => !item.goal_id)
            .map((item) => (
              <label key={item.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={removedAllocations.includes(item.id)}
                  onChange={(event) =>
                    setRemovedAllocations((current) =>
                      event.target.checked
                        ? [...current, item.id]
                        : current.filter((id) => id !== item.id),
                    )
                  }
                />
                {t("budgets.removeDeletedGoal", {
                  name: item.name,
                  amount: display(item.amount_cents),
                })}
              </label>
            ))}
          {goalsLoading ? (
            <p className="text-sm text-muted-foreground">
              {t("common.loading")}
            </p>
          ) : goalsError ? (
            <div>
              <p className="text-sm text-destructive">{goalsError}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void retryGoals()}
              >
                {t("common.retry")}
              </Button>
            </div>
          ) : (
            goals
              .filter(
                (goal) =>
                  goal.currency === currency &&
                  !goal.archivedAt &&
                  goal.status !== "completed" &&
                  (!goal.archivedAt || amounts[goal.id]),
              )
              .map((goal) => (
                <FormField
                  key={goal.id}
                  id={`goal-plan-${goal.id}`}
                  label={goal.name}
                >
                  <MoneyInput
                    currency={currency}
                    minorUnits={amounts[goal.id] ?? null}
                    onMinorUnitsChange={(value) =>
                      setAmounts((prev) => ({ ...prev, [goal.id]: value }))
                    }
                  />
                </FormField>
              ))
          )}
          {!goalsLoading &&
            !goalsError &&
            goals.filter(
              (goal) =>
                goal.currency === currency &&
                !goal.archivedAt &&
                goal.status !== "completed",
            ).length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t("budgets.noGoalsToPlan")}{" "}
                <Link to="/goals" className="text-primary underline">
                  {t("budgets.openGoals")}
                </Link>
              </p>
            )}
          <FieldError message={error} className="text-sm" />
          <div className="flex flex-wrap gap-2">
            <PendingButton
              type="submit"
              isPending={pending}
              disabled={goalsLoading || Boolean(goalsError)}
              pendingLabel={t("settings.saving")}
            >
              {t("common.save")}
            </PendingButton>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setGoalsOpen(false)}
            >
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
