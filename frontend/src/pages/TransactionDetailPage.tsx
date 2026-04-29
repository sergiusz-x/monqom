import { useParams } from "react-router-dom";

export default function TransactionDetailPage() {
  const { transactionId } = useParams<{ transactionId: string }>();

  return (
    <div className="p-6">
      <h1 className="mb-2 text-2xl font-semibold">Transaction details</h1>
      <p className="text-sm text-muted-foreground">
        Transaction ID: {transactionId}
      </p>
    </div>
  );
}
