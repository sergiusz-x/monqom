import type {
  ApiBudget,
  ApiBudgetProgressItem,
  ApiCategory,
  ApiDashboardOverview,
  ApiPaymentSource,
  ApiTransaction,
  ApiTransactionsPage,
} from "@/types/api-contracts";
import type { Budget, BudgetProgressItem } from "@/types/budget";
import type { Category } from "@/types/category";
import type {
  CategoryBreakdown,
  DashboardOverview,
  SpendingSummary,
} from "@/types/dashboard";
import type { PaymentSource } from "@/types/payment-source";
import type { Transaction, TransactionsPage } from "@/types/transaction";

export function mapTransaction(value: ApiTransaction): Transaction {
  return {
    id: value.id,
    workspaceId: value.workspace_id,
    categoryId: value.category_id,
    paymentSourceId: value.payment_source_id,
    type: value.type,
    amount: value.amount,
    currency: value.currency,
    date: value.date,
    description: value.description,
    notes: value.notes,
    tags: value.tags,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

export function mapTransactionsPage(
  value: ApiTransactionsPage,
): TransactionsPage {
  return { ...value, data: value.data.map(mapTransaction) };
}

export function mapBudget(value: ApiBudget): Budget {
  return {
    id: value.id,
    categoryId: value.category_id,
    amount: value.amount,
    currency: value.currency,
    year: value.year,
    month: value.month,
  };
}

export function mapBudgetProgressItem(
  value: ApiBudgetProgressItem,
): BudgetProgressItem {
  return {
    categoryId: value.category_id,
    categoryName: value.category_name,
    categorySystemKey: value.category_system_key,
    budgetAmount: value.budget_amount,
    limit: value.limit,
    spent: value.spent,
    remaining: value.remaining,
    percentage: value.percentage,
  };
}

export function mapPaymentSource(value: ApiPaymentSource): PaymentSource {
  return {
    id: value.id,
    workspaceId: value.workspace_id,
    name: value.name,
    type: value.type,
    systemKey: value.system_key,
    isArchived: value.is_archived,
    archivedAt: value.archived_at,
    createdAt: value.created_at,
    updatedAt: value.updated_at,
  };
}

export function mapCategory(value: ApiCategory): Category {
  return {
    id: value.id,
    name: value.name,
    systemKey: value.system_key,
    icon: value.icon,
    parentId: value.parent_id,
    sortOrder: value.sort_order,
    children: value.children.map(mapCategory),
  };
}

export function mapDashboardOverview(
  value: ApiDashboardOverview,
): DashboardOverview {
  const summary: SpendingSummary = {
    month: value.summary.month,
    currency: value.summary.currency,
    currentTotal: value.summary.current_total,
    previousTotal: value.summary.previous_total,
    changeAmount: value.summary.change_amount,
    changePercentage: value.summary.change_percentage,
    direction: value.summary.direction,
  };
  const categoryBreakdown: CategoryBreakdown = {
    month: value.category_breakdown.month,
    currency: value.category_breakdown.currency,
    totalSpending: value.category_breakdown.total_spending,
    categories: value.category_breakdown.categories.map((item) => ({
      categoryId: item.category_id,
      categoryName: item.category_name,
      categorySystemKey: item.category_system_key,
      categoryColor: item.category_color,
      amount: item.amount,
      percentage: item.percentage,
    })),
  };

  return {
    summary,
    categoryBreakdown,
    spendingTrend: value.spending_trend,
    recentTransactions: value.recent_transactions.map(mapTransaction),
  };
}
