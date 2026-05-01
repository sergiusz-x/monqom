import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { useWorkspace } from "@/hooks/useWorkspace";
import { TransactionFormModal } from "@/components/transactions/TransactionFormModal";
import { emitTransactionSaved } from "@/lib/transaction-refresh";

export default function AppLayout() {
  const { workspaceId } = useWorkspace();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function handleAddTransaction() {
    setIsCreateModalOpen(true);
  }

  function handleSaved() {
    setToast("Transaction saved successfully.");
    emitTransactionSaved();
    window.setTimeout(() => setToast(null), 2500);
  }

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:flex">
        <Sidebar onAddTransaction={handleAddTransaction} />
      </div>
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <Outlet />
        </div>
      </main>
      <BottomNav onAddTransaction={handleAddTransaction} />
      {workspaceId && (
        <TransactionFormModal
          key={isCreateModalOpen ? "create-open" : "create-closed"}
          open={isCreateModalOpen}
          mode="create"
          workspaceId={workspaceId}
          onClose={() => setIsCreateModalOpen(false)}
          onSaved={handleSaved}
        />
      )}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
