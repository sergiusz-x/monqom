export interface SpendingSummary {
  month: string;
  currency: string;
  currentTotal: number;
  previousTotal: number;
  changeAmount: number;
  changePercentage: number | null;
  direction: "up" | "down" | "flat";
}

export interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  categorySystemKey?: string | null;
  categoryColor: string | null;
  amount: number;
  percentage: number;
}

export interface CategoryBreakdown {
  month: string;
  currency: string;
  totalSpending: number;
  categories: CategoryBreakdownItem[];
}

export interface SpendingTrendItem {
  month: string;
  total: number;
}

export interface DashboardOverview {
  summary: SpendingSummary;
  categoryBreakdown: CategoryBreakdown;
  spendingTrend: SpendingTrendItem[];
  recentTransactions: import("@/types/transaction").Transaction[];
}
