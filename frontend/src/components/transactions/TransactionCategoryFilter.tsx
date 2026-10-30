import { useMemo } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Menu } from "@base-ui/react/menu";
import { useTranslation } from "react-i18next";
import { buttonVariants } from "@monqom/ui";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import type { Category } from "@/types/category";
import type { TransactionFilters } from "@/types/transaction";

export function TransactionCategoryFilter({
  filters,
  categories,
  onChange,
}: {
  filters: TransactionFilters;
  categories: Category[];
  onChange: (next: TransactionFilters) => void;
}) {
  const { t } = useTranslation();
  const options = useMemo(
    () =>
      categories.flatMap((category) => {
        const name = translateSystemLabel(t, category.systemKey, category.name);
        return [
          { id: category.id, label: name },
          ...category.children.map((child) => ({
            id: child.id,
            label: `${name} / ${translateSystemLabel(t, child.systemKey, child.name)}`,
          })),
        ];
      }),
    [categories, t],
  );
  const selectedLabels = options
    .filter((option) => filters.categoryIds.includes(option.id))
    .map((option) => option.label);
  const summary =
    selectedLabels.length === 0
      ? t("transactions.allCategories")
      : selectedLabels.length === 1
        ? selectedLabels[0]
        : t("transactions.selectedCategories", {
            count: selectedLabels.length,
          });

  function toggleCategory(id: string) {
    onChange({
      ...filters,
      uncategorized: false,
      categoryIds: filters.categoryIds.includes(id)
        ? filters.categoryIds.filter((value) => value !== id)
        : [...filters.categoryIds, id],
    });
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        className={buttonVariants({
          variant: "outline",
          size: "sm",
          className: "h-9 w-full justify-between gap-3 font-normal sm:w-44",
        })}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown
          size={14}
          className="shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner
          sideOffset={6}
          align="start"
          className="z-[90] outline-none"
        >
          <Menu.Popup className="max-h-72 min-w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none sm:w-64">
            {filters.categoryIds.length > 0 && (
              <Menu.Item
                className="cursor-pointer rounded-md px-3 py-2 text-sm text-muted-foreground outline-none data-[highlighted]:bg-muted"
                onClick={() =>
                  onChange({
                    ...filters,
                    categoryIds: [],
                    uncategorized: false,
                  })
                }
              >
                {t("transactions.clearCategories")}
              </Menu.Item>
            )}
            {options.map((option) => (
              <Menu.CheckboxItem
                key={option.id}
                checked={filters.categoryIds.includes(option.id)}
                className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                onCheckedChange={() => toggleCategory(option.id)}
              >
                <span className="flex size-4 shrink-0 items-center justify-center rounded border border-input">
                  {filters.categoryIds.includes(option.id) && (
                    <Check size={12} aria-hidden="true" />
                  )}
                </span>
                {option.label}
              </Menu.CheckboxItem>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
