import type { Category } from "@/types/category";
import { flattenCategories } from "@/lib/category-tree";

export const SALARY_CATEGORY_SYSTEM_KEY = "categories.income.salary";

export function categorySystemKeys(
  categories: Category[],
): Record<string, string | null | undefined> {
  return Object.fromEntries(
    flattenCategories(categories).map((category) => [
      category.id,
      category.systemKey,
    ]),
  );
}

export function isSalaryCategory(
  categoryId: string,
  systemKeys: Record<string, string | null | undefined>,
): boolean {
  return systemKeys[categoryId] === SALARY_CATEGORY_SYSTEM_KEY;
}
