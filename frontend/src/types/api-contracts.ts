/**
 * Wire-format contracts returned by the backend. These types intentionally
 * mirror the public JSON API and must not leak into components.
 */
export interface ApiTransaction {
  id: string;
  workspace_id: string;
  category_id: string;
  payment_source_id: string | null;
  type: "expense";
  amount: number;
  currency: string;
  date: string;
  description: string;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ApiTransactionsPage {
  data: ApiTransaction[];
  total: number;
  limit: number;
  offset: number;
}

export interface ApiBudget {
  id: string;
  category_id: string;
  amount: number;
  currency: string;
  year: number;
  month: number;
}

export interface ApiBudgetProgressItem {
  category_id: string;
  category_name: string;
  category_system_key?: string | null;
  budget_amount: number | null;
  limit: number | null;
  spent: number;
  remaining: number | null;
  percentage: number | null;
}

export type ApiPaymentSourceType =
  | "cash"
  | "debit_card"
  | "credit_card"
  | "bank"
  | "other";

export interface ApiPaymentSource {
  id: string;
  workspace_id: string;
  name: string;
  type: ApiPaymentSourceType;
  system_key: string | null;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiCategory {
  id: string;
  name: string;
  system_key?: string | null;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  children: ApiCategory[];
}

export interface ApiSpendingSummary {
  month: string;
  currency: string;
  current_total: number;
  previous_total: number;
  change_amount: number;
  change_percentage: number | null;
  direction: "up" | "down" | "flat";
}

export interface ApiCategoryBreakdownItem {
  category_id: string;
  category_name: string;
  category_system_key?: string | null;
  category_color: string | null;
  amount: number;
  percentage: number;
}

export interface ApiCategoryBreakdown {
  month: string;
  currency: string;
  total_spending: number;
  categories: ApiCategoryBreakdownItem[];
}

export interface ApiSpendingTrendItem {
  month: string;
  total: number;
}

export interface ApiDashboardOverview {
  summary: ApiSpendingSummary;
  category_breakdown: ApiCategoryBreakdown;
  spending_trend: ApiSpendingTrendItem[];
  recent_transactions: ApiTransaction[];
}
