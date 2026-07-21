import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import api from "@/lib/api";
import { getApiErrorStatus } from "@/lib/api-errors";
import { formatCurrency } from "@/lib/money";
import { paymentSourceName } from "@/lib/payment-sources";
import { useCategories } from "@/hooks/useCategories";
import { usePaymentSources } from "@/hooks/usePaymentSources";
import { useToast } from "@/hooks/useToast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { AsyncState } from "@/components/ui/async-state";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import type { Category } from "@/types/category";
import type { ApiTransaction } from "@/types/api-contracts";
import { mapTransaction } from "@/lib/api-mappers";
import { queryKeys } from "@/lib/query-client";
import { invalidateFinancialData } from "@/lib/query-invalidation";
import { formatLongDate } from "@/lib/date-only";
import { PageContainer, PageHeader } from "@/components/layout/PageLayout";
import { SectionCard, cardVariants } from "@/components/ui/card";
import { translateSystemLabel } from "@/i18n/translate-system-label";

function buildCategoryLabels(
  categories: Category[],
  t: TFunction,
): Record<string, string> {
  const labels: Record<string, string> = {};
  const visit = (category: Category, parentLabel?: string) => {
    const ownLabel = translateSystemLabel(t, category.systemKey, category.name);
    const label = parentLabel ? `${parentLabel} / ${ownLabel}` : ownLabel;
    labels[category.id] = label;
    category.children.forEach((child) => visit(child, label));
  };
  categories.forEach((category) => visit(category));
  return labels;
}

export default function TransactionDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { transactionId } = useParams<{ transactionId: string }>();
  const {
    workspaceId,
    workspace,
    isLoading: workspaceLoading,
    patchWorkspace,
  } = useWorkspace();
  const { categories } = useCategories(workspaceId ?? "");
  const { paymentSources } = usePaymentSources(workspaceId ?? "", true);
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const transactionQuery = useQuery({
    queryKey: queryKeys.transaction(workspaceId ?? "", transactionId ?? ""),
    enabled: Boolean(!workspaceLoading && workspaceId && transactionId),
    queryFn: async ({ signal }) => {
      const response = await api.get<ApiTransaction>(
        `/workspaces/${workspaceId}/transactions/${transactionId}`,
        { signal },
      );
      return mapTransaction(response.data);
    },
  });

  const categoryLabels = useMemo(
    () => buildCategoryLabels(categories, t),
    [categories, t],
  );
  const paymentSourceLabels = useMemo(
    () =>
      Object.fromEntries(
        paymentSources.map((source) => [
          source.id,
          paymentSourceName(source, t),
        ]),
      ),
    [paymentSources, t],
  );

  async function handleDelete() {
    if (!workspaceId || !transactionId) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(
        `/workspaces/${workspaceId}/transactions/${transactionId}`,
      );
      showToast(t("transactions.deleted"));
      navigate("/transactions", { replace: true });
      await invalidateFinancialData(queryClient, workspaceId);
    } catch {
      setDeleteError(t("transactions.deleteError"));
    } finally {
      setIsDeleting(false);
    }
  }

  if (workspaceLoading || transactionQuery.isLoading) {
    return (
      <PageContainer>
        <PageHeader title={t("transactions.details")} visuallyHidden />
        <AsyncState
          status="loading"
          message={t("transactions.loadingDetails")}
        />
      </PageContainer>
    );
  }

  if (!workspaceId || !transactionId) {
    return (
      <PageContainer>
        <Alert variant="error">{t("common.noWorkspace")}</Alert>
      </PageContainer>
    );
  }

  if (
    transactionQuery.isError &&
    getApiErrorStatus(transactionQuery.error) === 404
  ) {
    return (
      <PageContainer>
        <EmptyState
          title={t("transactions.notFound")}
          description={t("transactions.notFoundDescription")}
          action={
            <Link
              to="/transactions"
              className={buttonVariants({
                variant: "outline",
                className: "mt-4",
              })}
            >
              {t("transactions.backToList")}
            </Link>
          }
        />
      </PageContainer>
    );
  }

  if (transactionQuery.isError) {
    return (
      <PageContainer>
        <Alert variant="error" className="items-center">
          <span className="flex-1">{t("transactions.loadDetailsError")}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void transactionQuery.refetch()}
          >
            {t("common.retry")}
          </Button>
        </Alert>
      </PageContainer>
    );
  }

  const transaction = transactionQuery.data;
  if (!transaction) {
    return (
      <PageContainer>
        <AsyncState
          status="loading"
          message={t("transactions.loadingDetails")}
        />
      </PageContainer>
    );
  }
  const categoryLabel =
    categoryLabels[transaction.categoryId] ?? t("dashboard.uncategorized");
  const paymentSourceLabel = transaction.paymentSourceId
    ? (paymentSourceLabels[transaction.paymentSourceId] ?? t("common.none"))
    : t("common.none");

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        beforeTitle={
          <Link
            to="/transactions"
            className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t("transactions.backToList")}
          </Link>
        }
        title={transaction.description}
        description={categoryLabel}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditing(true)}
            >
              <Pencil aria-hidden="true" />
              {t("common.edit")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 aria-hidden="true" />
              {t("common.delete")}
            </Button>
          </>
        }
      />

      <SectionCard className="space-y-6">
        <p className="text-3xl font-semibold tabular-nums">
          {formatCurrency(transaction.amount, transaction.currency)}
        </p>
        <dl
          className={cardVariants({
            tone: "muted",
            className: "grid gap-4 sm:grid-cols-2",
          })}
        >
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("common.date")}
            </dt>
            <dd className="mt-1 text-sm font-medium">
              {formatLongDate(transaction.date)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">
              {t("common.paymentSource")}
            </dt>
            <dd className="mt-1 text-sm font-medium">{paymentSourceLabel}</dd>
          </div>
        </dl>
        <div>
          <h2 className="text-sm font-medium">{t("common.notes")}</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {transaction.notes || t("transactions.noNotes")}
          </p>
        </div>
        <div>
          <h2 className="text-sm font-medium">{t("common.tags")}</h2>
          {transaction.tags.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {transaction.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              {t("transactions.noTags")}
            </p>
          )}
        </div>
      </SectionCard>

      <ConfirmationDialog
        open={confirmingDelete}
        title={t("transactions.deleteConfirm")}
        description={t("transactions.deleteDescription")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        pendingLabel={t("transactions.deleting")}
        isPending={isDeleting}
        error={deleteError}
        onClose={() => setConfirmingDelete(false)}
        onConfirm={() => void handleDelete()}
      />

      <TransactionFormModal
        key={isEditing ? "detail-edit-open" : "detail-edit-closed"}
        open={isEditing}
        mode="edit"
        workspaceId={workspaceId}
        transaction={transaction}
        defaultCurrency={workspace?.baseCurrency ?? transaction.currency}
        onClose={() => setIsEditing(false)}
        onSaved={(result) => {
          patchWorkspace({ lastPaymentSourceId: result.paymentSourceId });
          setIsEditing(false);
          void invalidateFinancialData(queryClient, workspaceId);
          showToast(t("transactions.saved"));
        }}
      />
    </PageContainer>
  );
}
