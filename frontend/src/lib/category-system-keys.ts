import type { Category } from "@/types/category";

export const SALARY_CATEGORY_SYSTEM_KEY = "categories.income.salary";

export function categorySystemKeys(
  categories: Category[],
): Record<string, string | null | undefined> {
  const keys: Record<string, string | null | undefined> = {};

  function visit(category: Category) {
    keys[category.id] = category.systemKey;
    category.children.forEach(visit);
  }

  categories.forEach(visit);
  return keys;
}

export function isSalaryCategory(
  categoryId: string,
  systemKeys: Record<string, string | null | undefined>,
): boolean {
  return systemKeys[categoryId] === SALARY_CATEGORY_SYSTEM_KEY;
}
