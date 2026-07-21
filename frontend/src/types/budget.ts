export interface BudgetProgressItem {
  categoryId: string;
  categoryName: string;
  categorySystemKey?: string | null;
  budgetAmount: number | null;
  limit: number | null;
  spent: number;
  remaining: number | null;
  percentage: number | null;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  currency: string;
  year: number;
  month: number;
}
