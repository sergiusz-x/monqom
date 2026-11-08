export interface Transaction {
  id: string;
  workspaceId: string;
  categoryId: string | null;
  integrationId?: string | null;
  integrationName?: string | null;
  paymentSourceId: string | null;
  type: "expense" | "income";
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
  "date" | "category" | "amount" | "description" | "notes" | "payment_source";

export type TransactionSortDirection = "asc" | "desc";

export interface TransactionFilters {
  search?: string;
  uncategorized?: boolean;
  origin?: "" | "manual" | "integration";
  type?: "" | "expense" | "income";
  categoryIds: string[];
  paymentSourceId: string;
  dateFrom: string;
  dateTo: string;
  sortBy: TransactionSortField;
  sortDirection: TransactionSortDirection;
}
