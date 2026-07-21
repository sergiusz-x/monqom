import { describe, expect, it } from "vitest";
import {
  mapBudget,
  mapBudgetProgressItem,
  mapCategory,
  mapDashboardOverview,
  mapPaymentSource,
  mapTransaction,
  mapTransactionsPage,
} from "@/lib/api-mappers";
import type {
  ApiDashboardOverview,
  ApiTransaction,
} from "@/types/api-contracts";

const apiTransaction: ApiTransaction = {
  id: "tx-1",
  workspace_id: "ws-1",
  category_id: "cat-1",
  payment_source_id: "source-1",
  type: "expense",
  amount: 12.34,
  currency: "PLN",
  date: "2026-07-20",
  description: "Lunch",
  notes: null,
  tags: ["food"],
  created_at: "2026-07-20T10:00:00.000Z",
  updated_at: "2026-07-20T11:00:00.000Z",
};

describe("API mappers", () => {
  it("maps transaction wire fields exactly once at the boundary", () => {
    expect(mapTransaction(apiTransaction)).toEqual({
      id: "tx-1",
      workspaceId: "ws-1",
      categoryId: "cat-1",
      paymentSourceId: "source-1",
      type: "expense",
      amount: 12.34,
      currency: "PLN",
      date: "2026-07-20",
      description: "Lunch",
      notes: null,
      tags: ["food"],
      createdAt: "2026-07-20T10:00:00.000Z",
      updatedAt: "2026-07-20T11:00:00.000Z",
    });
    expect(
      mapTransactionsPage({
        data: [apiTransaction],
        total: 1,
        limit: 20,
        offset: 0,
      }).data[0].categoryId,
    ).toBe("cat-1");
  });

  it("maps budgets and progress to shared application models", () => {
    expect(
      mapBudget({
        id: "budget-1",
        category_id: "cat-1",
        amount: 500,
        currency: "PLN",
        year: 2026,
        month: 7,
      }),
    ).toMatchObject({ categoryId: "cat-1", amount: 500 });
    expect(
      mapBudgetProgressItem({
        category_id: "cat-1",
        category_name: "Food",
        category_system_key: "categories.food",
        budget_amount: 500,
        limit: 500,
        spent: 120,
        remaining: 380,
        percentage: 24,
      }),
    ).toMatchObject({
      categoryId: "cat-1",
      categoryName: "Food",
      categorySystemKey: "categories.food",
      budgetAmount: 500,
    });
  });

  it("maps payment sources and recursive categories", () => {
    expect(
      mapPaymentSource({
        id: "source-1",
        workspace_id: "ws-1",
        name: "Cash",
        type: "cash",
        system_key: "cash",
        is_archived: false,
        archived_at: null,
        created_at: "2026-07-20T10:00:00.000Z",
        updated_at: "2026-07-20T10:00:00.000Z",
      }),
    ).toMatchObject({
      workspaceId: "ws-1",
      systemKey: "cash",
      isArchived: false,
    });
    expect(
      mapCategory({
        id: "parent",
        name: "Food",
        system_key: "categories.food",
        icon: null,
        parent_id: null,
        sort_order: 1,
        children: [
          {
            id: "child",
            name: "Groceries",
            icon: null,
            parent_id: "parent",
            sort_order: 1,
            children: [],
          },
        ],
      }).children[0],
    ).toMatchObject({ id: "child", parentId: "parent", sortOrder: 1 });
  });

  it("maps the complete dashboard aggregate, including recent transactions", () => {
    const response: ApiDashboardOverview = {
      summary: {
        month: "2026-07",
        currency: "PLN",
        current_total: 12.34,
        previous_total: 10,
        change_amount: 2.34,
        change_percentage: 23.4,
        direction: "up",
      },
      category_breakdown: {
        month: "2026-07",
        currency: "PLN",
        total_spending: 12.34,
        categories: [
          {
            category_id: "cat-1",
            category_name: "Food",
            category_color: null,
            amount: 12.34,
            percentage: 100,
          },
        ],
      },
      spending_trend: [{ month: "2026-07", total: 12.34 }],
      recent_transactions: [apiTransaction],
    };

    const mapped = mapDashboardOverview(response);
    expect(mapped.summary.currentTotal).toBe(12.34);
    expect(mapped.categoryBreakdown.totalSpending).toBe(12.34);
    expect(mapped.recentTransactions[0].workspaceId).toBe("ws-1");
  });
});
