import { useMemo, useState } from "react";
import api from "@/lib/api";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useBudgetOverview } from "@/hooks/useBudgetOverview";
import { CategorySelector } from "@/components/CategorySelector";
import { BudgetProgressBar } from "@/components/BudgetProgressBar";
import { Button } from "@/components/ui/button";

interface Budget {
  id: string;
  category_id: string;
  amount: number;
  year: number;
  month: number;
}

interface BudgetFormState {
  categoryId: string | null;
  amount: string;
}

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function BudgetsPage() {
  const {
    workspaceId,
    isLoading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace();
  const [month, setMonth] = useState(getCurrentMonth);
  const [reloadToken, setReloadToken] = useState(0);
  const { progressItems, budgets, isLoading, error } = useBudgetOverview(
    workspaceId ?? "",
    month,
    reloadToken,
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [form, setForm] = useState<BudgetFormState>({
    categoryId: null,
    amount: "",
  });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedDate = useMemo(() => {
    const [year, monthPart] = month.split("-").map(Number);
    return new Date(year, monthPart - 1, 1);
  }, [month]);

  const monthLabel = useMemo(
    () =>
      selectedDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
    [selectedDate],
  );

  const budgetByCategoryId = useMemo(() => {
    const map = new Map<string, Budget>();
    for (const budget of budgets) {
      map.set(budget.category_id, budget);
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
    () => progressItems.filter((item) => item.budget_amount === null),
    [progressItems],
  );

  const hasAnyBudgets = budgets.length > 0;

  function formatAmount(amount: number): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function toMonthString(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function resetForm() {
    setForm({ categoryId: null, amount: "" });
    setSubmitError(null);
    setEditingBudgetId(null);
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
    setForm({ categoryId: budget.category_id, amount: String(budget.amount) });
    setShowCreateForm(false);
    setEditingBudgetId(budget.id);
    setSubmitError(null);
  }

  function shiftMonth(delta: number) {
    const next = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth() + delta,
      1,
    );
    setMonth(toMonthString(next));
    hideCreate();
  }

  async function handleCreateOrUpdate() {
    if (!workspaceId || !form.categoryId) {
      setSubmitError("Choose a category first");
      return;
    }

    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setSubmitError("Amount must be greater than 0");
      return;
    }

    const [year, monthPart] = month.split("-").map(Number);
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (editingBudgetId) {
        await api.put(`/workspaces/${workspaceId}/budgets/${editingBudgetId}`, {
          amount,
          category_id: form.categoryId,
          year,
          month: monthPart,
        });
      } else {
        await api.post(`/workspaces/${workspaceId}/budgets`, {
          amount,
          category_id: form.categoryId,
          year,
          month: monthPart,
        });
      }

      hideCreate();
      setReloadToken((value) => value + 1);
    } catch {
      setSubmitError("Failed to save budget");
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
      setReloadToken((value) => value + 1);
    } catch {
      setSubmitError("Failed to delete budget");
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderContent() {
    if (workspaceLoading || isLoading) {
      return (
        <div className="py-8 text-center text-muted-foreground" role="status">
          Loading…
        </div>
      );
    }

    if (workspaceError || !workspaceId || error) {
      return (
        <div className="py-8 text-center text-destructive" role="alert">
          {workspaceError ?? error ?? "No workspace found."}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <section className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">
              Total monthly budget
            </p>
            <p className="text-xl font-semibold">
              {formatAmount(totalBudgeted)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total spending</p>
            <p className="text-xl font-semibold">{formatAmount(totalSpent)}</p>
          </div>
        </section>

        {showCreateForm || editingBudgetId ? (
          <section className="space-y-3 rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold">
              {editingBudgetId ? "Edit budget" : "Add budget"}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">
                  Category
                </label>
                <CategorySelector
                  workspaceId={workspaceId}
                  value={form.categoryId}
                  onChange={(categoryId) =>
                    setForm((prev) => ({ ...prev, categoryId }))
                  }
                  disabled={Boolean(editingBudgetId)}
                />
              </div>
              <div>
                <label
                  htmlFor="budget-amount"
                  className="mb-1 block text-xs text-muted-foreground"
                >
                  Amount
                </label>
                <input
                  id="budget-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              {submitError ? (
                <p className="text-sm text-destructive" role="alert">
                  {submitError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => void handleCreateOrUpdate()}
                  disabled={isSubmitting}
                >
                  {editingBudgetId ? "Save budget" : "Create budget"}
                </Button>
                {editingBudgetId ? (
                  <Button
                    variant="destructive"
                    onClick={() => void handleDelete()}
                    disabled={isSubmitting}
                  >
                    Delete budget
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  onClick={hideCreate}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </section>
        ) : (
          <Button onClick={showCreate}>Add Budget</Button>
        )}

        {!hasAnyBudgets ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
            No budgets defined for this month yet.
          </div>
        ) : null}

        {progressItems.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No budgets or spending this month.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {progressItems.map((item) => {
              const isBudgeted = item.budget_amount !== null;
              return (
                <button
                  key={item.category_id}
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    if (isBudgeted) {
                      showEditForCategory(item.category_id);
                    }
                  }}
                  disabled={!isBudgeted}
                >
                  <BudgetProgressBar item={item} />
                </button>
              );
            })}
          </div>
        )}

        {unbudgetedItems.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Categories without budgets are shown as unbudgeted spending.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Budgets</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shiftMonth(-1)}>
            Prev
          </Button>
          <span className="min-w-28 text-center text-sm text-muted-foreground">
            {monthLabel}
          </span>
          <Button variant="outline" size="sm" onClick={() => shiftMonth(1)}>
            Next
          </Button>
        </div>
      </div>
      {renderContent()}
    </div>
  );
}
