import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/useToast";
import { Alert } from "@/components/ui/alert";
import { AsyncState } from "@/components/ui/async-state";
import { EmptyState } from "@/components/ui/empty-state";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { PaymentSourceDialog } from "@/components/payment-sources/PaymentSourceDialog";
import { usePaymentSources } from "@/hooks/usePaymentSources";
import type { PaymentSource } from "@/types/payment-source";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  paymentSourceName,
  paymentSourceTypeLabel,
} from "@/lib/payment-sources";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { queryKeys } from "@/lib/query-client";
import { PageContainer, PageHeader } from "@/components/layout/PageLayout";
import { Card, SectionCard } from "@/components/ui/card";

export default function PaymentSourcesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { workspaceId } = useWorkspace();
  const { paymentSources, isLoading, error, retry } = usePaymentSources(
    workspaceId ?? "",
    true,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<PaymentSource | null>(
    null,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [sourceToArchive, setSourceToArchive] = useState<PaymentSource | null>(
    null,
  );
  const { showToast } = useToast(3000);

  function openCreateDialog() {
    setEditingSource(null);
    setDialogOpen(true);
  }

  function openEditDialog(source: PaymentSource) {
    setEditingSource(source);
    setDialogOpen(true);
  }

  async function archiveSource(source: PaymentSource) {
    if (!workspaceId || source.systemKey === "cash") return;
    setArchivingId(source.id);
    setActionError(null);
    try {
      await api.post(
        `/workspaces/${workspaceId}/payment-sources/${source.id}/archive`,
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.paymentSourcesRoot(workspaceId),
      });
      showToast(t("paymentSources.archivedSuccess"));
      setSourceToArchive(null);
    } catch {
      setActionError(t("paymentSources.archiveError"));
    } finally {
      setArchivingId(null);
    }
  }

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={t("paymentSources.title")}
        description={t("paymentSources.description")}
        actions={
          <Button
            type="button"
            onClick={openCreateDialog}
            disabled={!workspaceId}
          >
            {t("paymentSources.add")}
          </Button>
        }
      />

      <SectionCard>
        {isLoading ? (
          <AsyncState
            status="loading"
            message={t("common.loading")}
            skeletonRows={4}
          />
        ) : error ? (
          <AsyncState
            status="error"
            message={error}
            onRetry={() => void retry()}
          />
        ) : paymentSources.length === 0 ? (
          <EmptyState
            title={t("paymentSources.empty")}
            description={t("paymentSources.emptyDescription")}
            actionLabel={t("paymentSources.add")}
            onAction={openCreateDialog}
          />
        ) : (
          <div className="space-y-2">
            {paymentSources.map((source) => (
              <Card
                key={source.id}
                padding="compact"
                tone="transparent"
                className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium">{paymentSourceName(source, t)}</p>
                  <p className="text-sm text-muted-foreground">
                    {paymentSourceTypeLabel(source.type, t)}
                    {source.isArchived
                      ? ` - ${t("paymentSources.archived")}`
                      : ""}
                  </p>
                </div>
                {!source.isArchived && source.systemKey !== "cash" && (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openEditDialog(source)}
                    >
                      {t("common.edit")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={archivingId === source.id}
                      onClick={() => {
                        setActionError(null);
                        setSourceToArchive(source);
                      }}
                    >
                      {t("paymentSources.archive")}
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {actionError && (
          <Alert variant="error" compact className="mt-4">
            {actionError}
          </Alert>
        )}
      </SectionCard>

      {workspaceId && (
        <PaymentSourceDialog
          key={`${editingSource?.id ?? "new"}-${dialogOpen ? "open" : "closed"}`}
          open={dialogOpen}
          workspaceId={workspaceId}
          source={editingSource}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            showToast(t("paymentSources.saved"));
          }}
        />
      )}

      <ConfirmationDialog
        open={Boolean(sourceToArchive)}
        title={t("paymentSources.archive")}
        description={t("paymentSources.archiveConfirm", {
          name: sourceToArchive?.name ?? "",
        })}
        confirmLabel={t("paymentSources.archive")}
        cancelLabel={t("common.cancel")}
        pendingLabel={t("common.loading")}
        isPending={Boolean(
          sourceToArchive && archivingId === sourceToArchive.id,
        )}
        error={actionError}
        onClose={() => {
          if (!archivingId) setSourceToArchive(null);
        }}
        onConfirm={() => {
          if (sourceToArchive) void archiveSource(sourceToArchive);
        }}
      />
    </PageContainer>
  );
}
