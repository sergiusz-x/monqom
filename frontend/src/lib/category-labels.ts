import type { TFunction } from "i18next";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import type { Category } from "@/types/category";

export function buildCategoryLabels(
  categories: Category[],
  translate: TFunction,
): Record<string, string> {
  const labels: Record<string, string> = {};

  const visit = (category: Category, parentLabel?: string) => {
    const ownLabel = translateSystemLabel(
      translate,
      category.systemKey,
      category.name,
    );
    const label = parentLabel ? `${parentLabel} / ${ownLabel}` : ownLabel;
    labels[category.id] = label;
    category.children.forEach((child) => visit(child, label));
  };

  categories.forEach((category) => visit(category));

  return labels;
}
