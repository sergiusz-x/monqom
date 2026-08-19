import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  AsyncState,
  Button,
  Card,
  EmptyState,
  ProgressBar,
  SectionCard,
  SegmentedControl,
} from "@monqom/ui";
import { PageContainer, PageHeader } from "@/components/layout/PageLayout";
import { GoalStatusBadge } from "@/components/goals/GoalStatusBadge";
import { useGoals } from "@/hooks/useGoals";
import { useWorkspace } from "@/hooks/useWorkspace";
import { formatDateOnly } from "@/lib/goals";
import { formatCurrency } from "@/lib/money";
import type { Goal } from "@/types/goal";

type View = "active" | "completed" | "archived";

export default function GoalsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { workspaceId } = useWorkspace();
  const { goals, isLoading, error, retry } = useGoals(workspaceId ?? "", true);
  const [view, setView] = useState<View>("active");
  const visible = goals.filter((goal) => {
    if (view === "archived") return Boolean(goal.archivedAt);
    if (goal.archivedAt) return false;
    if (view === "completed") return goal.status === "completed";
    return goal.status !== "completed";
  });

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={t("goals.title")}
        description={t("goals.description")}
        actions={
          <Button type="button" onClick={() => navigate("/goals/new")}>
            {t("goals.add")}
          </Button>
        }
      />
      <SegmentedControl
        value={view}
        ariaLabel={t("goals.title")}
        options={(["active", "completed", "archived"] as const).map((item) => ({
          value: item,
          label: t(item === "active" ? "goals.allActive" : `goals.${item}`),
        }))}
        onChange={setView}
      />
      {isLoading ? (
        <SectionCard>
          <AsyncState
            status="loading"
            message={t("common.loading")}
            skeletonRows={4}
          />
        </SectionCard>
      ) : error ? (
        <SectionCard>
          <AsyncState
            status="error"
            message={error}
            onRetry={() => void retry()}
          />
        </SectionCard>
      ) : goals.length === 0 ? (
        <SectionCard>
          <EmptyState
            title={t("goals.empty")}
            description={t("goals.emptyDescription")}
            actionLabel={t("goals.add")}
            onAction={() => navigate("/goals/new")}
          />
        </SectionCard>
      ) : visible.length === 0 ? (
        <SectionCard>
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("goals.noResults")}
          </p>
        </SectionCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((goal) => (
            <GoalCard key={goal.id} goal={goal} locale={i18n.language} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function GoalCard({ goal, locale }: { goal: Goal; locale: string }) {
  const { t } = useTranslation();
  return (
    <Link
      to={`/goals/${goal.id}`}
      className="rounded-xl focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <Card
        padding="responsive"
        className="h-full space-y-5 transition-colors hover:border-primary/50 hover:bg-muted/20"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{goal.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("goals.due", {
                date: formatDateOnly(goal.targetDate, locale),
              })}
            </p>
          </div>
          {goal.status !== "active" ? (
            <GoalStatusBadge status={goal.status} size="sm" />
          ) : null}
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="font-semibold tabular-nums">
              {formatCurrency(goal.currentAmount, goal.currency)}
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {goal.progressPercentage}%
            </span>
          </div>
          <ProgressBar
            value={goal.progressPercentage}
            ariaLabel={t("goals.progressLabel", {
              name: goal.name,
              percent: goal.progressPercentage,
            })}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t("goals.target", {
              amount: formatCurrency(goal.targetAmount, goal.currency),
            })}
          </p>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">
            {t("goals.monthlyNeeded")}
          </span>
          <span className="font-semibold tabular-nums">
            {goal.recommendedMonthlyAmount === null
              ? "-"
              : formatCurrency(goal.recommendedMonthlyAmount, goal.currency)}
          </span>
        </div>
      </Card>
    </Link>
  );
}
