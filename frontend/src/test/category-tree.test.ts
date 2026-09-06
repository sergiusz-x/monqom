import { describe, expect, it } from "vitest";
import { flattenCategories } from "@/lib/category-tree";
import type { Category } from "@/types/category";

function category(overrides: Partial<Category>): Category {
  return {
    id: "category-1",
    name: "Category",
    icon: null,
    parentId: null,
    sortOrder: 0,
    children: [],
    ...overrides,
  };
}

describe("flattenCategories", () => {
  it("returns every category in parent-before-child order", () => {
    const categories = [
      category({
        id: "parent",
        children: [
          category({
            id: "child",
            children: [category({ id: "grandchild" })],
          }),
        ],
      }),
    ];

    expect(flattenCategories(categories).map((item) => item.id)).toEqual([
      "parent",
      "child",
      "grandchild",
    ]);
  });
});
