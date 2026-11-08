import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Archive,
  Banknote,
  CreditCard,
  Landmark,
  Pencil,
  Wallet,
} from "lucide-react";
import { getApiErrorStatus } from "@/lib/api-errors";
import { useToast } from "@/hooks/useToast";

import { paymentSourcesApi } from "@/api/contract";

import { PaymentSourceDialog } from "@/components/payment-sources/PaymentSourceDialog";
import { usePaymentSources } from "@/hooks/usePaymentSources";
import type { PaymentSource } from "@/types/payment-source";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  paymentSourceName,
  paymentSourceTypeLabel,
} from "@/lib/payment-sources";

import { queryKeys } from "@/lib/query-client";
import { PageContainer, PageHeader } from "@/components/layout/PageLayout";
import {
  ActionMenu,
  Alert,
  AsyncState,
  Button,
  Card,
  ConfirmationDialog,
  EmptyState,
  SectionCard,
  SegmentedControl,
} from "@monqom/ui";

export default function PaymentSourcesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { workspaceId, workspace } = useWorkspace();
  const canConfigure = !workspace?.role || workspace.role !== "member";
  const { paymentSources, isLoading, error, retry } = usePaymentSources(
    workspaceId ?? "",
    true,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [view, setView] = useState<"active" | "archived">("active");
  const [restoringId, setRestoringId] = useState<string | null>(null);
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
      await paymentSourcesApi.paymentSourcesControllerArchivePaymentSource(
        source.id,
        workspaceId,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.paymentSourcesRoot(workspaceId),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workspaces }),
      ]);
      showToast(t("paymentSources.archivedSuccess"));
      setSourceToArchive(null);
    } catch {
      setActionError(t("paymentSources.archiveError"));
    } finally {
      setArchivingId(null);
    }
  }

  async function restoreSource(source: PaymentSource) {
    if (!workspaceId) return;
    setRestoringId(source.id);
    setActionError(null);
    try {
      await paymentSourcesApi.paymentSourcesControllerRestorePaymentSource(
        source.id,
        workspaceId,
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.paymentSourcesRoot(workspaceId),
      });
      setView("active");
      showToast(t("paymentSources.restoredSuccess"));
    } catch (error) {
      setActionError(
        t(
          getApiErrorStatus(error) === 409
            ? "paymentSources.restoreConflict"
            : "paymentSources.restoreError",
        ),
      );
    } finally {
      setRestoringId(null);
    }
  }

  const visibleSources = paymentSources.filter(
    (source) => source.isArchived === (view === "archived"),
  );

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title={t("paymentSources.title")}
        description={t("paymentSources.description")}
        actions={
          canConfigure ? (
            <Button
              type="button"
              onClick={openCreateDialog}
              disabled={!workspaceId}
            >
              {t("paymentSources.add")}
            </Button>
          ) : undefined
        }
      />

      <SegmentedControl
        value={view}
        ariaLabel={t("paymentSources.title")}
        options={[
          { value: "active", label: t("paymentSources.active") },
          { value: "archived", label: t("paymentSources.archived") },
        ]}
        onChange={(next) => {
          setView(next);
          setActionError(null);
        }}
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
        ) : paymentSources.length === 0 && view === "active" ? (
          <EmptyState
            title={t("paymentSources.empty")}
            description={t("paymentSources.emptyDescription")}
            actionLabel={canConfigure ? t("paymentSources.add") : undefined}
            onAction={canConfigure ? openCreateDialog : undefined}
          />
        ) : visibleSources.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t(
              view === "active"
                ? "paymentSources.noActive"
                : "paymentSources.noArchived",
            )}
          </p>
        ) : (
          <div className="space-y-2">
            {visibleSources.map((source) => {
              const Icon =
                source.type === "cash"
                  ? Banknote
                  : source.type === "bank"
                    ? Landmark
                    : source.type === "other"
                      ? Wallet
                      : CreditCard;
              const name = paymentSourceName(source, t);
              return (
                <Card
                  key={source.id}
                  padding="compact"
                  tone="transparent"
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="rounded-lg bg-muted p-2 text-muted-foreground">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="break-words font-medium">{name}</p>
                      {name.toLocaleLowerCase() !==
                      paymentSourceTypeLabel(
                        source.type,
                        t,
                      ).toLocaleLowerCase() ? (
                        <p className="text-sm text-muted-foreground">
                          {paymentSourceTypeLabel(source.type, t)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {canConfigure && source.systemKey !== "cash" ? (
                    source.isArchived ? (
                      <Button
                        variant="outline"
                        disabled={restoringId === source.id}
                        onClick={() => void restoreSource(source)}
                      >
                        {t("paymentSources.restore")}
                      </Button>
                    ) : (
                      <ActionMenu
                        ariaLabel={t("paymentSources.actions", { name })}
                        disabled={archivingId === source.id}
                        items={[
                          {
                            id: "edit",
                            label: t("common.edit"),
                            icon: Pencil,
                            onSelect: () => openEditDialog(source),
                          },
                          {
                            id: "archive",
                            label: t("paymentSources.archive"),
                            icon: Archive,
                            onSelect: () => {
                              setActionError(null);
                              setSourceToArchive(source);
                            },
                          },
                        ]}
                      />
                    )
                  ) : null}
                </Card>
              );
            })}
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
