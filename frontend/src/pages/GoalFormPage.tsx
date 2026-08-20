import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, CalendarDays, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  AsyncState,
  Button,
  Card,
  FormField,
  Input,
  MoneyInput,
  PendingButton,
  SectionCard,
} from "@monqom/ui";
import api from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-errors";
import {
  addMonthsClamped,
  mapGoal,
  monthsUntilDate,
  previewMonthlyAmount,
  todayInTimeZone,
} from "@/lib/goals";
import { formatCurrency } from "@/lib/money";
import { queryClient, queryKeys } from "@/lib/query-client";
import { useGoal } from "@/hooks/useGoals";
import { useToast } from "@/hooks/useToast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { PageContainer, PageHeader } from "@/components/layout/PageLayout";
import type { ApiGoal } from "@/types/api-contracts";

export default function GoalFormPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { goalId = "" } = useParams();
  const editing = Boolean(goalId);
  const { workspaceId, workspace } = useWorkspace();
  const detail = useGoal(workspaceId ?? "", goalId);
  const { showToast } = useToast(3000);
  const today = todayInTimeZone(workspace?.timezone ?? "UTC");
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState<number | null>(null);
  const [initialAmount, setInitialAmount] = useState<number | null>(0);
  const [months, setMonths] = useState(12);
  const [targetDate, setTargetDate] = useState(() =>
    addMonthsClamped(today, 12),
  );
  const [includeCurrentMonth, setIncludeCurrentMonth] = useState(false);
  const [loadedGoalId, setLoadedGoalId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!detail.goal || loadedGoalId === detail.goal.id) return;
    // Hydrate the controlled edit form once after its async query resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(detail.goal.name);
    setTargetAmount(Math.round(detail.goal.targetAmount * 100));
    setInitialAmount(Math.round(detail.goal.initialAmount * 100));
    setTargetDate(detail.goal.targetDate);
    setMonths(monthsUntilDate(today, detail.goal.targetDate));
    setLoadedGoalId(detail.goal.id);
  }, [detail.goal, loadedGoalId, today]);

  const minDate = addMonthsClamped(today, 1);
  const maxDate = addMonthsClamped(today, 120);
  const preview = useMemo(
    () =>
      previewMonthlyAmount({
        targetAmountCents: targetAmount ?? 0,
        initialAmountCents: initialAmount ?? 0,
        today,
        targetDate,
        includeCurrentMonth,
      }),
    [includeCurrentMonth, initialAmount, targetAmount, targetDate, today],
  );
  const currency = workspace?.baseCurrency ?? "USD";

  function changeMonths(value: number) {
    setMonths(value);
    setTargetDate(addMonthsClamped(today, value));
  }

  function changeDate(value: string) {
    setTargetDate(value);
    if (value >= minDate && value <= maxDate)
      setMonths(monthsUntilDate(today, value));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = t("goals.invalidName");
    if (!targetAmount || targetAmount <= 0)
      nextErrors.target = t("goals.invalidTarget");
    if (!targetDate || targetDate < minDate || targetDate > maxDate) {
      nextErrors.date = t("goals.invalidDate");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !workspaceId || !targetAmount) return;

    setSaving(true);
    setSubmitError(null);
    try {
      let response;
      if (editing && detail.goal) {
        const body: Record<string, string | number> = {};
        if (name.trim() !== detail.goal.name) body.name = name.trim();
        if (targetAmount / 100 !== detail.goal.targetAmount) {
          body.target_amount = targetAmount / 100;
        }
        if ((initialAmount ?? 0) / 100 !== detail.goal.initialAmount) {
          body.initial_amount = (initialAmount ?? 0) / 100;
        }
        if (targetDate !== detail.goal.targetDate)
          body.target_date = targetDate;
        if (Object.keys(body).length === 0) {
          navigate(`/goals/${goalId}`);
          return;
        }
        response = await api.patch<ApiGoal>(
          `/workspaces/${workspaceId}/goals/${goalId}`,
          body,
        );
      } else {
        response = await api.post<ApiGoal>(`/workspaces/${workspaceId}/goals`, {
          name: name.trim(),
          target_amount: targetAmount / 100,
          initial_amount: (initialAmount ?? 0) / 100,
          target_date: targetDate,
          include_current_month: includeCurrentMonth,
        });
      }
      const saved = mapGoal(response.data);
      await queryClient.invalidateQueries({
        queryKey: queryKeys.goals(workspaceId),
      });
      queryClient.setQueryData(queryKeys.goal(workspaceId, saved.id), saved);
      showToast(t(editing ? "goals.updated" : "goals.created"));
      navigate(`/goals/${saved.id}`);
    } catch (error) {
      setSubmitError(getApiErrorMessage(error) || t("goals.saveError"));
    } finally {
      setSaving(false);
    }
  }

  if (editing && (detail.isLoading || !workspace)) {
    return (
      <PageContainer>
        <AsyncState
          status="loading"
          message={t("common.loading")}
          skeletonRows={5}
        />
      </PageContainer>
    );
  }
  if (editing && detail.error) {
    return (
      <PageContainer>
        <AsyncState
          status="error"
          message={detail.error}
          onRetry={() => void detail.retry()}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        beforeTitle={
          <Link
            to={editing ? `/goals/${goalId}` : "/goals"}
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} aria-hidden="true" /> {t("goals.back")}
          </Link>
        }
        title={t(editing ? "goals.editTitle" : "goals.createTitle")}
        description={t("goals.formDescription")}
      />

      <form
        onSubmit={(event) => void submit(event)}
        className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]"
      >
        <SectionCard className="space-y-5">
          <FormField label={t("goals.name")} error={errors.name} required>
            <Input
              value={name}
              maxLength={80}
              placeholder={t("goals.namePlaceholder")}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label={t("goals.targetAmount")}
              error={errors.target}
              required
            >
              <MoneyInput
                currency={currency}
                minorUnits={targetAmount}
                onMinorUnitsChange={setTargetAmount}
              />
            </FormField>
            <FormField label={t("goals.initialAmount")}>
              <MoneyInput
                currency={currency}
                minorUnits={initialAmount}
                onMinorUnitsChange={setInitialAmount}
              />
            </FormField>
          </div>
          <FormField label={t("goals.targetDate")} error={errors.date} required>
            <Input
              type="date"
              min={minDate}
              max={maxDate}
              value={targetDate}
              onChange={(event) => changeDate(event.target.value)}
            />
          </FormField>
          <FormField
            label={t("goals.sliderLabel")}
            hint={t("goals.months", { count: months })}
          >
            <input
              id="goal-months"
              type="range"
              min={1}
              max={120}
              value={months}
              aria-valuetext={t("goals.months", { count: months })}
              className="h-10 w-full accent-primary"
              onChange={(event) => changeMonths(Number(event.target.value))}
            />
          </FormField>
          {!editing ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
              <input
                type="checkbox"
                checked={includeCurrentMonth}
                className="mt-1 size-4 accent-primary"
                onChange={(event) =>
                  setIncludeCurrentMonth(event.target.checked)
                }
              />
              <span>
                <span className="block text-sm font-medium">
                  {t("goals.includeCurrent")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("goals.includeCurrentHint")}
                </span>
              </span>
            </label>
          ) : null}
          {submitError ? <Alert variant="error">{submitError}</Alert> : null}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(editing ? `/goals/${goalId}` : "/goals")}
            >
              {t("common.cancel")}
            </Button>
            <PendingButton
              type="submit"
              isPending={saving}
              pendingLabel={t("goals.saving")}
            >
              {t(editing ? "goals.save" : "goals.create")}
            </PendingButton>
          </div>
        </SectionCard>

        <Card
          padding="responsive"
          className="h-fit space-y-5 border-primary/25 bg-primary/5 lg:sticky lg:top-6"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary" size={18} aria-hidden="true" />
            <h2 className="font-semibold">{t("goals.livePlan")}</h2>
          </div>
          <PlanValue
            label={t("goals.monthlyNeeded")}
            value={formatCurrency(preview.monthlyAmountCents / 100, currency)}
            prominent
          />
          <PlanValue
            label={t("goals.remaining")}
            value={formatCurrency(
              Math.max((targetAmount ?? 0) - (initialAmount ?? 0), 0) / 100,
              currency,
            )}
          />
          <PlanValue
            label={t("goals.plannedMonths")}
            value={String(preview.months)}
          />
          <div className="flex items-center gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
            <CalendarDays size={16} aria-hidden="true" />
            {targetDate}
          </div>
        </Card>
      </form>
    </PageContainer>
  );
}

function PlanValue({
  label,
  value,
  prominent = false,
}: {
  label: string;
  value: string;
  prominent?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={
          prominent
            ? "text-2xl font-semibold tabular-nums"
            : "font-medium tabular-nums"
        }
      >
        {value}
      </p>
    </div>
  );
}
