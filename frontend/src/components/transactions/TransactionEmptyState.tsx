export function TransactionEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
      <p className="text-muted-foreground">
        No transactions yet. Add your first expense.
      </p>
    </div>
  );
}
