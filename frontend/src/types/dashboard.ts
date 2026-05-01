export interface SpendingSummary {
  month: string;
  currency: string;
  current_total: number;
  previous_total: number;
  change_amount: number;
  change_percentage: number | null;
  direction: "up" | "down" | "flat";
}

export interface CategoryBreakdownItem {
  category_id: string;
  category_name: string;
  category_color: string | null;
  amount: number;
  percentage: number;
}

export interface CategoryBreakdown {
  month: string;
  currency: string;
  total_spending: number;
  categories: CategoryBreakdownItem[];
}

export interface TransactionItem {
  id: string;
  workspace_id: string;
  category_id: string;
  payment_source_id: string | null;
  type: string;
  amount: number;
  currency: string;
  date: string;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface TransactionsListResponse {
  data: TransactionItem[];
  total: number;
  limit: number;
  offset: number;
}
