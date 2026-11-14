import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HelpLink } from "@/components/layout/HelpLink";
import { budgetsApi } from "@/api/contract";
import api from "@/lib/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useBudgetOverview } from "@/hooks/useBudgetOverview";
import { CategorySelector } from "@/components/CategorySelector";
import { BudgetProgressBar } from "@/components/BudgetProgressBar";
import { BudgetDetailsModal } from "@/components/budgets/BudgetDetailsModal";
import { MonthlyPlanPanel } from "@/components/budgets/MonthlyPlanPanel";
import { DashboardMonthPicker } from "@/components/dashboard/DashboardMonthPicker";
import { useCategories } from "@/hooks/useCategories";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { useTranslation } from "react-i18next";
import { WorkspaceErrorState } from "@/components/WorkspaceErrorState";

import { PageContainer, PageHeader } from "@/components/layout/PageLayout";

import { useToast } from "@/hooks/useToast";

import { useFocusOnError } from "@/hooks/useFocusOnError";

import { queryKeys } from "@/lib/query-client";
import {
  formatMonth,
  getMonthInTimeZone,
  parseYearMonth,
  shiftMonth as shiftCalendarMonth,
} from "@/lib/date-only";
import {
  formatCurrency,
  majorAmountToMinorUnits,
  minorUnitsToMajorAmount,
} from "@/lib/money";
import type { Budget } from "@/types/budget";
import {
  AsyncState,
  Button,
  EmptyState,
  FieldError,
  FormField,
  MoneyInput,
  PendingButton,
  SectionCard,
  Modal,
  Select,
} from "@monqom/ui";

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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
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
  const [budgetScope, setBudgetScope] = useState<"month" | "future">("future");
  const [deleteScope, setDeleteScope] = useState<"month" | "future">("month");
  const budgetFormRef = useFocusOnError(
    fieldErrors.categoryId ?? fieldErrors.amount,
  );

  const currentMonth = getMonthInTimeZone(
    new Date(),
    workspace?.timezone ?? "UTC",
  );
  const { categories } = useCategories(workspaceId ?? "");
  const allCategories = useMemo(
    () => categories.flatMap((category) => [category, ...category.children]),
    [categories],
  );
  const categoryById = useMemo(
    () => new Map(allCategories.map((category) => [category.id, category])),
    [allCategories],
  );

  const budgetByCategoryId = useMemo(() => {
    const map = new Map<string, Budget>();
    for (const budget of budgets) {
      map.set(budget.categoryId, budget);
    }
    return map;
  }, [budgets]);

  const budgetedItems = useMemo(
    () =>
      progressItems
        .filter((item) => item.budgetAmount !== null)
        .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0)),
    [progressItems],
  );
  const unbudgetedItems = useMemo(
    () =>
      progressItems
        .filter(
          (item) =>
            item.budgetAmount === null &&
            item.spent > 0 &&
            categoryById.has(item.categoryId) &&
            !budgetByCategoryId.has(
              categoryById.get(item.categoryId)?.parentId ?? "",
            ) &&
            !categoryById
              .get(item.categoryId)
              ?.children.some((child) => budgetByCategoryId.has(child.id)),
        )
        .sort((a, b) => b.spent - a.spent),
    [progressItems, categoryById, budgetByCategoryId],
  );

  function resetForm() {
    setForm({
      categoryId: null,
      amountMinorUnits: null,
      currency: workspace?.baseCurrency ?? "USD",
    });
    setSubmitError(null);
    setFieldErrors({});
    setEditingBudgetId(null);
    setBudgetScope("future");
    setConfirmingDelete(false);
  }

  function showCreate(categoryId: string | null = null) {
    resetForm();
    setForm((prev) => ({ ...prev, categoryId }));
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
    setBudgetScope(budget.id.startsWith("recurring:") ? "future" : "month");
    setSubmitError(null);
  }

  function shiftMonth(delta: number) {
    setSelectedCategoryId(null);
    setSelectedMonth(shiftCalendarMonth(month, delta));
    hideCreate();
  }

  async function handleCreateOrUpdate() {
    if (!workspaceId || !form.categoryId) {
      setFieldErrors({ categoryId: t("budgets.chooseCategory") });
      return;
    }

    if (!editingBudgetId && budgetByCategoryId.has(form.categoryId)) {
      setFieldErrors({ categoryId: t("budgets.alreadyExists") });
      return;
    }

    if (form.amountMinorUnits === null || form.amountMinorUnits <= 0) {
      setFieldErrors({ amount: t("budgets.positiveAmount") });
      return;
    }
    const amount = minorUnitsToMajorAmount(form.amountMinorUnits);

    const parsedMonth = parseYearMonth(month);
    if (!parsedMonth) {
      setSubmitError(t("budgets.saveError"));
      return;
    }
    const [year, monthPart] = parsedMonth;
    setIsSubmitting(true);
    setSubmitError(null);
    setFieldErrors({});

    try {
      const wasEditing = Boolean(editingBudgetId);
      if (budgetScope === "future") {
        if (form.currency !== workspace?.baseCurrency) {
          setSubmitError(t("budgets.recurringCurrencyError"));
          return;
        }
        await api.post(
          `/workspaces/${encodeURIComponent(workspaceId)}/budgets/recurring`,
          {
            amount,
            currency: form.currency,
            category_id: form.categoryId,
            year,
            month: monthPart,
          },
        );
      } else if (editingBudgetId && !editingBudgetId.startsWith("recurring:")) {
        await budgetsApi.budgetsControllerUpdateBudget(
          editingBudgetId,
          workspaceId,
          {
            amount,
            currency: form.currency,
            category_id: form.categoryId,
            year,
            month: monthPart,
          },
        );
      } else {
        await budgetsApi.budgetsControllerCreateBudget(workspaceId, {
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
    const budget = selectedCategoryId
      ? budgetByCategoryId.get(selectedCategoryId)
      : undefined;
    const parsedMonth = parseYearMonth(month);
    if (!workspaceId || !budget || !parsedMonth) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.post(
        `/workspaces/${encodeURIComponent(workspaceId)}/budgets/recurring/remove?scope=${deleteScope}`,
        {
          category_id: budget.categoryId,
          amount: budget.amount,
          currency: budget.currency,
          year: parsedMonth[0],
          month: parsedMonth[1],
        },
      );
      setSelectedCategoryId(null);
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
      <div className="space-y-8">
        {budgetedItems.length > 0 ? (
          <section className="space-y-3" aria-label={t("budgets.yourBudgets")}>
            <h2 className="text-lg font-semibold">
              {t("budgets.yourBudgets")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("budgets.budgetsProgressDescription")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {budgetedItems.map((item) => (
                <button
                  key={item.categoryId}
                  type="button"
                  className="group w-full cursor-pointer rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  aria-label={t("budgets.openDetails", {
                    category: translateSystemLabel(
                      t,
                      item.categorySystemKey,
                      item.categoryName,
                    ),
                  })}
                  onClick={() => setSelectedCategoryId(item.categoryId)}
                >
                  <BudgetProgressBar
                    item={item}
                    currency={workspace?.baseCurrency ?? "USD"}
                    icon={categoryById.get(item.categoryId)?.icon}
                    interactive
                  />
                </button>
              ))}
            </div>
          </section>
        ) : (
          <EmptyState
            title={t("budgets.emptyTitle")}
            description={t("budgets.emptyDescription")}
            actionLabel={t("budgets.add")}
            onAction={() => showCreate()}
          />
        )}

        {unbudgetedItems.length > 0 && (
          <section className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">
                {t("budgets.unbudgetedTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("budgets.unbudgetedDescription")}
              </p>
            </div>
            <SectionCard padding="default" className="divide-y divide-border">
              {unbudgetedItems.map((item) => (
                <div
                  key={item.categoryId}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span aria-hidden="true">
                    {categoryById.get(item.categoryId)?.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {translateSystemLabel(
                      t,
                      item.categorySystemKey,
                      item.categoryName,
                    )}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums">
                    {formatCurrency(
                      item.spent,
                      workspace?.baseCurrency ?? "USD",
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => showCreate(item.categoryId)}
                  >
                    {t("budgets.setLimit")}
                  </Button>
                </div>
              ))}
            </SectionCard>
          </section>
        )}
      </div>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title={t("budgets.title")}
        description={<>{t("budgets.description")} <HelpLink newTab article="budgets" className="underline underline-offset-4 hover:text-foreground">{t("nav.budgetHelp")}</HelpLink></>}
        className="mb-6"
        actions={
          <Button onClick={() => showCreate()}>{t("budgets.add")}</Button>
        }
      />
      <div
        className="mb-6 flex items-center gap-2"
        aria-label={t("dashboard.monthSelector")}
      >
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          onClick={() => shiftMonth(-1)}
          aria-label={t("dashboard.previousMonth")}
        >
          <ChevronLeft size={18} />
        </Button>
        <DashboardMonthPicker
          month={month}
          currentMonth={currentMonth}
          onSelectMonth={(value) => {
            setSelectedMonth(value);
            setSelectedCategoryId(null);
            hideCreate();
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          onClick={() => shiftMonth(1)}
          aria-label={t("dashboard.nextMonth")}
        >
          <ChevronRight size={18} />
        </Button>
      </div>
      {workspaceId && !workspaceLoading && !workspaceError && (
        <div className="mb-6">
          <MonthlyPlanPanel
            key={month}
            workspaceId={workspaceId}
            month={month}
            currentMonth={currentMonth}
            currency={workspace?.baseCurrency ?? "USD"}
          />
        </div>
      )}
      {renderContent()}
      {selectedCategoryId &&
        !editingBudgetId &&
        (() => {
          const item = budgetedItems.find(
            (entry) => entry.categoryId === selectedCategoryId,
          );
          const budget = budgetByCategoryId.get(selectedCategoryId);
          if (!item || !budget || item.budgetAmount === null || !workspaceId)
            return null;
          return (
            <BudgetDetailsModal
              workspaceId={workspaceId}
              month={month}
              currency={workspace?.baseCurrency ?? "USD"}
              item={item}
              budget={budget}
              icon={categoryById.get(item.categoryId)?.icon}
              isDeleting={isSubmitting}
              onClose={() => setSelectedCategoryId(null)}
              onEdit={() => showEditForCategory(item.categoryId)}
              onDelete={() => {
                setDeleteScope("month");
                setSubmitError(null);
                setConfirmingDelete(true);
              }}
            />
          );
        })()}
      <Modal
        open={showCreateForm || Boolean(editingBudgetId)}
        onClose={hideCreate}
        preventClose={isSubmitting}
        ariaLabel={editingBudgetId ? t("budgets.edit") : t("budgets.add")}
        contentClassName="max-w-lg"
      >
        <h2 className="text-lg font-semibold">
          {editingBudgetId ? t("budgets.edit") : t("budgets.add")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("budgets.monthOnly", { month: formatMonth(month) })}
        </p>
        <form
          ref={budgetFormRef}
          className="mt-5 space-y-4"
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
              workspaceId={workspaceId ?? ""}
              value={form.categoryId}
              onChange={(categoryId) =>
                setForm((prev) => ({ ...prev, categoryId }))
              }
              disabled={Boolean(editingBudgetId)}
            />
          </FormField>
          <FormField
            id="budget-amount"
            label={t("budgets.limit")}
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
          <FormField id="budget-currency" label={t("common.currency")} required>
            <Select
              value={form.currency}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, currency: event.target.value }))
              }
            >
              {SUPPORTED_CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField id="budget-scope" label={t("budgets.applyScope")}>
            <Select
              value={budgetScope}
              onChange={(event) =>
                setBudgetScope(event.target.value as "month" | "future")
              }
            >
              <option value="future">{t("budgets.thisAndFuture")}</option>
              <option value="month">{t("budgets.thisMonth")}</option>
            </Select>
          </FormField>
          <FieldError message={submitError} className="text-sm" />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <PendingButton
              type="submit"
              isPending={isSubmitting}
              pendingLabel={t("settings.saving")}
            >
              {editingBudgetId ? t("budgets.save") : t("budgets.create")}
            </PendingButton>
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
      </Modal>
      <Modal
        open={confirmingDelete}
        onClose={() => setConfirmingDelete(false)}
        preventClose={isSubmitting}
        layer="nested"
        ariaLabel={t("budgets.deleteConfirm")}
        contentClassName="max-w-md"
      >
        <h2 className="text-lg font-semibold">{t("budgets.deleteConfirm")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("budgets.deleteDescription")}
        </p>
        <div className="mt-4">
          <FormField id="budget-delete-scope" label={t("budgets.applyScope")}>
            <Select
              value={deleteScope}
              onChange={(event) =>
                setDeleteScope(event.target.value as "month" | "future")
              }
            >
              <option value="month">{t("budgets.thisMonth")}</option>
              <option value="future">{t("budgets.thisAndFuture")}</option>
            </Select>
          </FormField>
        </div>
        <FieldError message={submitError} className="mt-3 text-sm" />
        <div className="mt-5 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => setConfirmingDelete(false)}
          >
            {t("common.cancel")}
          </Button>
          <PendingButton
            type="button"
            variant="destructive"
            isPending={isSubmitting}
            pendingLabel={t("budgets.deleting")}
            onClick={() => void handleDelete()}
          >
            {t("budgets.delete")}
          </PendingButton>
        </div>
      </Modal>
    </PageContainer>
  );
}
