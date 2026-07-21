export interface Transaction {
  id: string;
  workspaceId: string;
  categoryId: string;
  paymentSourceId: string | null;
  type: "expense";
  amount: number;
  currency: string;
  date: string;
  description: string;
  notes: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TransactionsPage {
  data: Transaction[];
  total: number;
  limit: number;
  offset: number;
}

export type TransactionSortField =
  | "date"
  | "category"
  | "amount"
  | "description"
  | "notes"
  | "tags"
  | "payment_source";

export type TransactionSortDirection = "asc" | "desc";

export interface TransactionFilters {
  categoryIds: string[];
  tag: string;
  paymentSourceId: string;
  dateFrom: string;
  dateTo: string;
  sortBy: TransactionSortField;
  sortDirection: TransactionSortDirection;
}
