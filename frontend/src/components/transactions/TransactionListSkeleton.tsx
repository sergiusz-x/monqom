export function TransactionListSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="Loading transactions">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-14 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}
