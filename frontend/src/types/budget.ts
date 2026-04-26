export interface BudgetProgressItem {
  category_id: string
  category_name: string
  budget_amount: number | null
  limit: number | null
  spent: number
  remaining: number | null
  percentage: number | null
}
