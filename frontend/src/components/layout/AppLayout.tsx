import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Outlet } from "react-router";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { useWorkspace } from "@/hooks/useWorkspace";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { invalidateFinancialData } from "@/lib/query-invalidation";
import { WorkspaceSwitcher } from "@/components/workspace/WorkspaceSwitcher";
export default function AppLayout() {
  const { workspaceId, workspace, patchWorkspace } = useWorkspace();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const queryClient = useQueryClient();

  function handleAddTransaction() {
    setIsCreateModalOpen(true);
  }

  function handleSaved(result: { paymentSourceId: string | null }) {
    patchWorkspace({ lastPaymentSourceId: result.paymentSourceId });
    if (workspaceId) {
      void invalidateFinancialData(queryClient, workspaceId);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden md:flex">
        <Sidebar onAddTransaction={handleAddTransaction} />
      </div>
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <div className="border-b border-border px-4 py-2 md:hidden">
          <WorkspaceSwitcher compact />
        </div>
        <Outlet />
      </main>
      <BottomNav onAddTransaction={handleAddTransaction} />
      {workspaceId && (
        <TransactionFormModal
          key={isCreateModalOpen ? "create-open" : "create-closed"}
          open={isCreateModalOpen}
          mode="create"
          workspaceId={workspaceId}
          defaultCurrency={workspace?.baseCurrency ?? "USD"}
          defaultPaymentSourceId={workspace?.lastPaymentSourceId ?? null}
          defaultTimezone={workspace?.timezone ?? "UTC"}
          onClose={() => setIsCreateModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
