import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useBudgetOverview } from "@/hooks/useBudgetOverview";
import { CategorySelector } from "@/components/CategorySelector";
import { BudgetProgressBar } from "@/components/BudgetProgressBar";
import { Button } from "@/components/ui/button";
import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { useTranslation } from "react-i18next";
import { WorkspaceErrorState } from "@/components/WorkspaceErrorState";
import { FieldError } from "@/components/ui/field-error";
import { AsyncState } from "@/components/ui/async-state";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer, PageHeader } from "@/components/layout/PageLayout";
import { SectionCard } from "@/components/ui/card";
import { PendingButton } from "@/components/ui/pending-button";
import { useToast } from "@/hooks/useToast";
import { FormField } from "@/components/ui/form-field";
import { MoneyInput } from "@/components/ui/money-input";
import { Select } from "@/components/ui/select";
import { useFocusOnError } from "@/hooks/useFocusOnError";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { queryKeys } from "@/lib/query-client";
import {
  formatMonth,
  getMonthInTimeZone,
  shiftMonth as shiftCalendarMonth,
} from "@/lib/date-only";
import {
  formatCurrency,
  majorAmountToMinorUnits,
  minorUnitsToMajorAmount,
} from "@/lib/money";
import type { Budget } from "@/types/budget";

interface BudgetFormState {
  categoryId: string | null;
  amountMinorUnits: number | null;
  currency: string;
}

export default function BudgetsPage() {
  const { t } = useTranslation();
  const {
    workspaceId,
    workspace,
    isLoading: workspaceLoading,
    error: workspaceError,
    refetch: retryWorkspace,
  } = useWorkspace();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const month =
    selectedMonth ??
    getMonthInTimeZone(new Date(), workspace?.timezone ?? "UTC");
  const queryClient = useQueryClient();
  const { showToast } = useToast(3000);
  const { progressItems, budgets, isLoading, error, retry } = useBudgetOverview(
    workspaceId ?? "",
    month,
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetFormState>({
    categoryId: null,
    amountMinorUnits: null,
    currency: "USD",
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    categoryId?: string;
    amount?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const budgetFormRef = useFocusOnError(
    fieldErrors.categoryId ?? fieldErrors.amount,
  );

  const monthLabel = useMemo(() => formatMonth(month), [month]);

  const budgetByCategoryId = useMemo(() => {
    const map = new Map<string, Budget>();
    for (const budget of budgets) {
      map.set(budget.categoryId, budget);
    }
    return map;
  }, [budgets]);

  const totalBudgeted = useMemo(
    () => budgets.reduce((sum, budget) => sum + budget.amount, 0),
    [budgets],
  );

  const totalSpent = useMemo(
    () => progressItems.reduce((sum, item) => sum + item.spent, 0),
    [progressItems],
  );

  const unbudgetedItems = useMemo(
    () => progressItems.filter((item) => item.budgetAmount === null),
    [progressItems],
  );

  const hasAnyBudgets = budgets.length > 0;

  function resetForm() {
    setForm({
      categoryId: null,
      amountMinorUnits: null,
      currency: workspace?.baseCurrency ?? "USD",
    });
    setSubmitError(null);
    setFieldErrors({});
    setEditingBudgetId(null);
    setConfirmingDelete(false);
  }

  function showCreate() {
    resetForm();
    setShowCreateForm(true);
  }

  function hideCreate() {
    setShowCreateForm(false);
    resetForm();
  }

  function showEditForCategory(categoryId: string) {
    const budget = budgetByCategoryId.get(categoryId);
    if (!budget) return;
    setForm({
      categoryId: budget.categoryId,
      amountMinorUnits: majorAmountToMinorUnits(budget.amount),
      currency: budget.currency,
    });
    setShowCreateForm(false);
    setEditingBudgetId(budget.id);
    setSubmitError(null);
  }

  function shiftMonth(delta: number) {
    setSelectedMonth(shiftCalendarMonth(month, delta));
    hideCreate();
  }

  async function handleCreateOrUpdate() {
    if (!workspaceId || !form.categoryId) {
      setFieldErrors({ categoryId: t("budgets.chooseCategory") });
      return;
    }

    if (form.amountMinorUnits === null || form.amountMinorUnits <= 0) {
      setFieldErrors({ amount: t("budgets.positiveAmount") });
      return;
    }
    const amount = minorUnitsToMajorAmount(form.amountMinorUnits);

    const [year, monthPart] = month.split("-").map(Number);
    setIsSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const wasEditing = Boolean(editingBudgetId);
      if (editingBudgetId) {
        await api.put(`/workspaces/${workspaceId}/budgets/${editingBudgetId}`, {
          amount,
          currency: form.currency,
          category_id: form.categoryId,
          year,
          month: monthPart,
        });
      } else {
        await api.post(`/workspaces/${workspaceId}/budgets`, {
          amount,
          currency: form.currency,
          category_id: form.categoryId,
          year,
          month: monthPart,
        });
      }

      hideCreate();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.budgets(workspaceId),
      });
      showToast(
        t(wasEditing ? "budgets.updatedSuccess" : "budgets.createdSuccess"),
      );
    } catch {
      setSubmitError(t("budgets.saveError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!workspaceId || !editingBudgetId) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.delete(`/workspaces/${workspaceId}/budgets/${editingBudgetId}`);
      hideCreate();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.budgets(workspaceId),
      });
      showToast(t("budgets.deletedSuccess"));
    } catch {
      setSubmitError(t("budgets.deleteError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderContent() {
    if (workspaceLoading || isLoading) {
      return (
        <AsyncState
          status="loading"
          message={t("common.loading")}
          skeletonRows={4}
        />
      );
    }

    if (workspaceError || !workspaceId) {
      return (
        <WorkspaceErrorState
          message={workspaceError ?? t("common.noWorkspace")}
          className="text-center"
          onRetry={workspaceError ? () => void retryWorkspace() : undefined}
        />
      );
    }

    if (error) {
      return (
        <AsyncState
          status="error"
          message={error}
          onRetry={() => void retry()}
        />
      );
    }

    return (
      <div className="space-y-4">
        <SectionCard padding="default" className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">
              {t("budgets.totalBudget")}
            </p>
            <p className="text-xl font-semibold">
              {formatCurrency(totalBudgeted, workspace?.baseCurrency ?? "USD")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("budgets.totalSpending")}
            </p>
            <p className="text-xl font-semibold">
              {formatCurrency(totalSpent, workspace?.baseCurrency ?? "USD")}
            </p>
          </div>
        </SectionCard>

        {showCreateForm || editingBudgetId ? (
          <SectionCard padding="default" className="space-y-3">
            <h2 className="text-sm font-semibold">
              {editingBudgetId ? t("budgets.edit") : t("budgets.add")}
            </h2>
            <form
              ref={budgetFormRef}
              className="space-y-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreateOrUpdate();
              }}
            >
              <FormField
                id="budget-category"
                label={t("common.category")}
                error={fieldErrors.categoryId}
                required
              >
                <CategorySelector
                  workspaceId={workspaceId}
                  value={form.categoryId}
                  onChange={(categoryId) =>
                    setForm((prev) => ({ ...prev, categoryId }))
                  }
                  disabled={Boolean(editingBudgetId)}
                />
              </FormField>
              <FormField
                id="budget-amount"
                label={t("common.amount")}
                error={fieldErrors.amount}
                required
              >
                <MoneyInput
                  currency={form.currency}
                  minorUnits={form.amountMinorUnits}
                  onMinorUnitsChange={(amountMinorUnits) =>
                    setForm((prev) => ({ ...prev, amountMinorUnits }))
                  }
                />
              </FormField>
              <FormField
                id="budget-currency"
                label={t("common.currency")}
                required
              >
                <Select
                  value={form.currency}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      currency: event.target.value,
                    }))
                  }
                >
                  {SUPPORTED_CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              </FormField>{" "}
              <FieldError message={submitError} className="text-sm" />
              <div className="flex flex-wrap gap-2">
                <PendingButton
                  type="submit"
                  isPending={isSubmitting}
                  pendingLabel={t("settings.saving")}
                >
                  {editingBudgetId ? t("budgets.save") : t("budgets.create")}
                </PendingButton>
                {editingBudgetId ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setConfirmingDelete(true)}
                    disabled={isSubmitting}
                  >
                    {t("budgets.delete")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  onClick={hideCreate}
                  disabled={isSubmitting}
                >
                  {t("common.cancel")}
                </Button>
              </div>
            </form>
          </SectionCard>
        ) : (
          <Button onClick={showCreate}>{t("budgets.add")}</Button>
        )}

        {!hasAnyBudgets ? (
          <EmptyState
            title={t("budgets.noneDefined")}
            description={t("budgets.noActivity")}
            actionLabel={t("budgets.add")}
            onAction={showCreate}
          />
        ) : null}

        {progressItems.length === 0 && hasAnyBudgets ? (
          <div className="py-8 text-center text-muted-foreground">
            {t("budgets.noActivity")}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {progressItems.map((item) => {
              const isBudgeted = item.budgetAmount !== null;
              return (
                <Button
                  key={item.categoryId}
                  type="button"
                  variant="ghost"
                  className="h-auto w-full justify-start p-0 text-left hover:bg-transparent"
                  onClick={() => {
                    if (isBudgeted) {
                      showEditForCategory(item.categoryId);
                    }
                  }}
                  disabled={!isBudgeted}
                >
                  <BudgetProgressBar
                    item={item}
                    currency={workspace?.baseCurrency ?? "USD"}
                  />
                </Button>
              );
            })}
          </div>
        )}

        {unbudgetedItems.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("budgets.unbudgetedHint")}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={t("budgets.title")}
        className="mb-6"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}>
              {t("common.previous")}
            </Button>
            <span className="min-w-28 text-center text-sm text-muted-foreground">
              {monthLabel}
            </span>
            <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}>
              {t("common.next")}
            </Button>
          </>
        }
      />
      {renderContent()}
      <ConfirmationDialog
        open={confirmingDelete}
        title={t("budgets.deleteConfirm")}
        description={t("budgets.deleteDescription")}
        confirmLabel={t("budgets.delete")}
        cancelLabel={t("common.cancel")}
        pendingLabel={t("budgets.deleting")}
        isPending={isSubmitting}
        error={submitError}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => void handleDelete()}
      />
    </PageContainer>
  );
}
