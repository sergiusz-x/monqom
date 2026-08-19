import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router";
import {
  Archive,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ActionMenu,
  Alert,
  AsyncState,
  Button,
  Card,
  ConfirmationDialog,
  FormField,
  Input,
  Modal,
  MoneyInput,
  PendingButton,
  ProgressBar,
  SectionCard,
  Textarea,
} from "@monqom/ui";
import api from "@/lib/api";
import { getApiErrorMessage } from "@/lib/api-errors";
import { formatDateOnly, todayInTimeZone } from "@/lib/goals";
import { formatCurrency } from "@/lib/money";
import { queryClient, queryKeys } from "@/lib/query-client";
import { useGoal } from "@/hooks/useGoals";
import { useToast } from "@/hooks/useToast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { PageContainer, PageHeader } from "@/components/layout/PageLayout";
import { GoalStatusBadge } from "@/components/goals/GoalStatusBadge";
import { cn } from "@/lib/utils";
import type { GoalOperation, GoalOperationType } from "@/types/goal";

export default function GoalDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { goalId = "" } = useParams();
  const { workspaceId, workspace } = useWorkspace();
  const { goal, isLoading, error, retry } = useGoal(workspaceId ?? "", goalId);
  const { showToast } = useToast(3000);
  const [operationDialog, setOperationDialog] = useState<{
    type: GoalOperationType;
    operation?: GoalOperation;
  } | null>(null);
  const [confirm, setConfirm] = useState<"archive" | "delete" | null>(null);
  const [operationToDelete, setOperationToDelete] =
    useState<GoalOperation | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function refresh() {
    if (!workspaceId) return;
    await queryClient.invalidateQueries({
      queryKey: queryKeys.goals(workspaceId),
    });
  }

  async function archiveOrRestore() {
    if (!workspaceId || !goal) return;
    setPending(true);
    setActionError(null);
    const restoring = Boolean(goal.archivedAt);
    try {
      await api.post(
        `/workspaces/${workspaceId}/goals/${goal.id}/${restoring ? "restore" : "archive"}`,
      );
      await refresh();
      showToast(
        t(restoring ? "goals.restoredSuccess" : "goals.archivedSuccess"),
      );
      setConfirm(null);
    } catch (nextError) {
      setActionError(getApiErrorMessage(nextError));
    } finally {
      setPending(false);
    }
  }

  async function deleteGoal() {
    if (!workspaceId || !goal) return;
    setPending(true);
    setActionError(null);
    try {
      await api.delete(`/workspaces/${workspaceId}/goals/${goal.id}`);
      await refresh();
      showToast(t("goals.deletedSuccess"));
      navigate("/goals");
    } catch (nextError) {
      setActionError(getApiErrorMessage(nextError));
      setPending(false);
    }
  }

  async function deleteOperation() {
    if (!workspaceId || !goal || !operationToDelete) return;
    setPending(true);
    setActionError(null);
    try {
      await api.delete(
        `/workspaces/${workspaceId}/goals/${goal.id}/operations/${operationToDelete.id}`,
      );
      await refresh();
      showToast(t("goals.operationDeleted"));
      setOperationToDelete(null);
    } catch (nextError) {
      setActionError(getApiErrorMessage(nextError));
    } finally {
      setPending(false);
    }
  }

  if (isLoading)
    return (
      <PageContainer>
        <AsyncState
          status="loading"
          message={t("common.loading")}
          skeletonRows={6}
        />
      </PageContainer>
    );
  if (error || !goal)
    return (
      <PageContainer>
        <AsyncState
          status="error"
          message={error ?? t("apiErrors.notFound")}
          onRetry={() => void retry()}
        />
      </PageContainer>
    );

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        beforeTitle={
          <Link
            to="/goals"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} aria-hidden="true" /> {t("goals.back")}
          </Link>
        }
        title={goal.name}
        description={t("goals.due", {
          date: formatDateOnly(goal.targetDate, i18n.language),
        })}
        actions={
          <ActionMenu
            ariaLabel={t("goals.actions")}
            items={[
              ...(!goal.archivedAt
                ? [
                    {
                      id: "edit",
                      label: t("goals.edit"),
                      icon: Pencil,
                      onSelect: () => navigate(`/goals/${goal.id}/edit`),
                    },
                  ]
                : []),
              {
                id: goal.archivedAt ? "restore" : "archive",
                label: t(goal.archivedAt ? "goals.restore" : "goals.archive"),
                icon: goal.archivedAt ? RotateCcw : Archive,
                onSelect: () =>
                  goal.archivedAt
                    ? void archiveOrRestore()
                    : setConfirm("archive"),
              },
              {
                id: "delete",
                label: t("goals.delete"),
                icon: Trash2,
                tone: "destructive",
                onSelect: () => setConfirm("delete"),
              },
            ]}
          />
        }
      />
      {actionError ? <Alert variant="error">{actionError}</Alert> : null}

      <SectionCard className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <GoalStatusBadge status={goal.status} />
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            {goal.progressPercentage}%
          </span>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            {t("goals.currentBalance")}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <p className="text-3xl font-semibold tabular-nums sm:text-4xl">
              {formatCurrency(goal.currentAmount, goal.currency)}
            </p>
            <p className="text-sm text-muted-foreground">
              / {formatCurrency(goal.targetAmount, goal.currency)}
            </p>
          </div>
          <ProgressBar
            value={goal.progressPercentage}
            className="mt-4 h-2.5"
            ariaLabel={t("goals.progressLabel", {
              name: goal.name,
              percent: goal.progressPercentage,
            })}
          />
        </div>
        <div className="grid gap-5 border-t border-border pt-5 sm:grid-cols-2 sm:divide-x sm:divide-border">
          <div>
            <p className="text-xs text-muted-foreground">
              {t("goals.remaining")}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {formatCurrency(goal.remainingAmount, goal.currency)}
            </p>
          </div>
          <div className="sm:pl-5">
            <p className="text-xs text-muted-foreground">
              {t("goals.monthlyNeeded")}
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums">
              {goal.recommendedMonthlyAmount === null
                ? "-"
                : formatCurrency(goal.recommendedMonthlyAmount, goal.currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {goal.status === "overdue"
                ? t("goals.deadlinePassed")
                : t("goals.months", { count: goal.remainingMonths })}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">{t("goals.operations")}</h2>
          {!goal.archivedAt ? (
            <div className="flex gap-2">
              <Button onClick={() => setOperationDialog({ type: "deposit" })}>
                <ArrowDownLeft aria-hidden="true" />
                {t("goals.addDeposit")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setOperationDialog({ type: "withdrawal" })}
              >
                <ArrowUpRight aria-hidden="true" />
                {t("goals.addWithdrawal")}
              </Button>
            </div>
          ) : null}
        </div>
        {goal.initialAmount > 0 ? (
          <Card
            tone="muted"
            padding="compact"
            className="flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-medium">{t("goals.openingBalance")}</p>
              <p className="text-xs text-muted-foreground">
                {goal.planStartMonth}
              </p>
            </div>
            <p className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              +{formatCurrency(goal.initialAmount, goal.currency)}
            </p>
          </Card>
        ) : null}
        {goal.operations?.length ? (
          <div className="space-y-2">
            {goal.operations.map((operation) => (
              <Card
                key={operation.id}
                padding="compact"
                tone="transparent"
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "rounded-lg p-2",
                      operation.type === "deposit"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {operation.type === "deposit" ? (
                      <ArrowDownLeft aria-hidden="true" />
                    ) : (
                      <ArrowUpRight aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <p className="font-medium">
                      {t(`goals.${operation.type}`)}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarDays size={13} aria-hidden="true" />
                      {formatDateOnly(operation.date, i18n.language)}
                      {operation.note ? ` · ${operation.note}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      operation.type === "deposit"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-destructive",
                    )}
                  >
                    {operation.type === "deposit" ? "+" : "-"}
                    {formatCurrency(operation.amount, goal.currency)}
                  </span>
                  {!goal.archivedAt ? (
                    <ActionMenu
                      ariaLabel={t("goals.operationActions")}
                      items={[
                        {
                          id: "edit",
                          label: t("goals.editOperation"),
                          icon: Pencil,
                          onSelect: () =>
                            setOperationDialog({
                              type: operation.type,
                              operation,
                            }),
                        },
                        {
                          id: "delete",
                          label: t("goals.deleteOperation"),
                          icon: Trash2,
                          tone: "destructive",
                          onSelect: () => setOperationToDelete(operation),
                        },
                      ]}
                    />
                  ) : null}
                </div>
              </Card>
            ))}
          </div>
        ) : goal.initialAmount === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("goals.noOperations")}
          </p>
        ) : null}
      </SectionCard>

      {operationDialog && workspaceId ? (
        <OperationDialog
          key={operationDialog.operation?.id ?? operationDialog.type}
          open
          workspaceId={workspaceId}
          goalId={goal.id}
          currency={goal.currency}
          maxDate={todayInTimeZone(workspace?.timezone ?? "UTC")}
          type={operationDialog.type}
          operation={operationDialog.operation}
          onClose={() => setOperationDialog(null)}
          onSaved={async () => {
            setOperationDialog(null);
            await refresh();
            showToast(t("goals.operationSaved"));
          }}
        />
      ) : null}
      <ConfirmationDialog
        open={confirm === "archive"}
        title={t("goals.archive")}
        description={t("goals.archiveConfirm", { name: goal.name })}
        confirmLabel={t("goals.archive")}
        cancelLabel={t("common.cancel")}
        pendingLabel={t("common.loading")}
        isPending={pending}
        error={actionError}
        onClose={() => !pending && setConfirm(null)}
        onConfirm={() => void archiveOrRestore()}
      />
      <ConfirmationDialog
        open={confirm === "delete"}
        title={t("goals.delete")}
        description={t("goals.deleteConfirm", { name: goal.name })}
        confirmLabel={t("goals.delete")}
        cancelLabel={t("common.cancel")}
        pendingLabel={t("common.loading")}
        isPending={pending}
        error={actionError}
        onClose={() => !pending && setConfirm(null)}
        onConfirm={() => void deleteGoal()}
      />
      <ConfirmationDialog
        open={Boolean(operationToDelete)}
        title={t("goals.deleteOperation")}
        description={t("goals.deleteOperationConfirm")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        pendingLabel={t("common.loading")}
        isPending={pending}
        error={actionError}
        onClose={() => !pending && setOperationToDelete(null)}
        onConfirm={() => void deleteOperation()}
      />
    </PageContainer>
  );
}

function OperationDialog({
  open,
  workspaceId,
  goalId,
  currency,
  maxDate,
  type,
  operation,
  onClose,
  onSaved,
}: {
  open: boolean;
  workspaceId: string;
  goalId: string;
  currency: string;
  maxDate: string;
  type: GoalOperationType;
  operation?: GoalOperation;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState<number | null>(
    operation ? Math.round(operation.amount * 100) : null,
  );
  const [date, setDate] = useState(operation?.date ?? maxDate);
  const [note, setNote] = useState(operation?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!amount || amount <= 0) return setError(t("goals.invalidTarget"));
    setSaving(true);
    setError(null);
    try {
      const url = `/workspaces/${workspaceId}/goals/${goalId}/operations${operation ? `/${operation.id}` : ""}`;
      const body = { type, amount: amount / 100, date, note };
      if (operation) await api.patch(url, body);
      else await api.post(url, body);
      await onSaved();
    } catch (nextError) {
      setError(getApiErrorMessage(nextError) || t("goals.operationSaveError"));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      preventClose={saving}
      ariaLabelledBy="goal-operation-title"
      contentClassName="max-w-md"
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <h2 id="goal-operation-title" className="text-lg font-semibold">
          {operation
            ? t("goals.editOperation")
            : t("goals.addOperation", {
                type: t(`goals.${type}`).toLowerCase(),
              })}
        </h2>
        <FormField label={t("common.amount")} required>
          <MoneyInput
            currency={currency}
            minorUnits={amount}
            onMinorUnitsChange={setAmount}
          />
        </FormField>
        <FormField label={t("goals.operationDate")} required>
          <Input
            type="date"
            max={maxDate}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormField>
        <FormField label={t("goals.note")}>
          <Textarea
            maxLength={500}
            value={note}
            placeholder={t("goals.notePlaceholder")}
            onChange={(event) => setNote(event.target.value)}
          />
        </FormField>
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <PendingButton
            type="submit"
            isPending={saving}
            pendingLabel={t("goals.saving")}
          >
            {t("common.save")}
          </PendingButton>
        </div>
      </form>
    </Modal>
  );
}
