export interface TransactionItem {
  id: string;
  workspace_id: string;
  category_id: string;
  payment_source_id: string;
  type: "expense";
  amount: number;
  currency: string;
  date: string;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface TransactionsResponse {
  data: TransactionItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface TransactionFilters {
  categoryId: string;
  tag: string;
  paymentSourceId: string;
  dateFrom: string;
  dateTo: string;
}
