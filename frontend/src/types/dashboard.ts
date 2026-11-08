export interface SpendingSummary {
  month: string;
  currency: string;
  currentTotal: number;
  previousTotal: number;
  changeAmount: number;
  changePercentage: number | null;
  direction: "up" | "down" | "flat";
  incomeTotal: number;
  netTotal: number;
}

export interface CategoryBreakdownItem {
  categoryId: string | null;
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

export interface FinancialTrendItem {
  month: string;
  income: number | null;
  spending: number | null;
}

export interface DashboardOverview {
  summary: SpendingSummary;
  categoryBreakdown: CategoryBreakdown;
  spendingTrend: SpendingTrendItem[];
  financialTrend: FinancialTrendItem[];
  spendingPace: {
    changePercentage: number;
    direction: "up" | "down" | "flat";
  } | null;
  recentTransactions: import("@/types/transaction").Transaction[];
}
