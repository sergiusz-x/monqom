import { describe, expect, it, vi } from "vitest";
import { buildCategoryLabels } from "@/lib/category-labels";
import type { Category } from "@/types/category";
import type { TFunction } from "i18next";

function category(overrides: Partial<Category>): Category {
  return {
    id: "category-1",
    name: "Food",
    icon: null,
    parentId: null,
    sortOrder: 0,
    children: [],
    ...overrides,
  };
}

describe("buildCategoryLabels", () => {
  it("builds full paths for arbitrarily nested categories", () => {
    const translate = vi.fn(
      (key: string, fallback?: string) => fallback ?? key,
    );
    const categories = [
      category({
        id: "food",
        name: "Food",
        children: [
          category({
            id: "groceries",
            name: "Groceries",
            parentId: "food",
            children: [
              category({
                id: "market",
                name: "Market",
                parentId: "groceries",
              }),
            ],
          }),
        ],
      }),
    ];

    expect(
      buildCategoryLabels(categories, translate as unknown as TFunction),
    ).toEqual({
      food: "Food",
      groceries: "Food / Groceries",
      market: "Food / Groceries / Market",
    });
  });
});
