import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { useTranslation } from "react-i18next";
import { Input, buttonVariants } from "@monqom/ui";
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
  const [search, setSearch] = useState("");
  const available = categories.filter(
    (category) =>
      !filters.type || !category.type || category.type === filters.type,
  );
  const localized = available.map((parent) => ({
    ...parent,
    name: translateSystemLabel(t, parent.systemKey, parent.name),
    children: parent.children.map((child) => ({
      ...child,
      name: translateSystemLabel(t, child.systemKey, child.name),
    })),
  }));
  const selected = localized
    .flatMap((parent) => [parent, ...parent.children])
    .filter((item) => filters.categoryIds.includes(item.id));
  const summary =
    filters.categoryIds.length === 0
      ? t("transactions.allCategories")
      : filters.categoryIds.length === 1 && selected[0]
        ? selected[0].name
        : t("transactions.selectedCategories", {
            count: filters.categoryIds.length,
          });
  const query = search.trim().toLocaleLowerCase();
  const groups = localized
    .map((parent) => {
      const parentMatches = parent.name.toLocaleLowerCase().includes(query);
      return {
        ...parent,
        children: parentMatches
          ? parent.children
          : parent.children.filter((child) =>
              child.name.toLocaleLowerCase().includes(query),
            ),
        visible:
          parentMatches ||
          parent.children.some((child) =>
            child.name.toLocaleLowerCase().includes(query),
          ),
      };
    })
    .filter((parent) => parent.visible);

  function toggle(id: string) {
    onChange({
      ...filters,
      uncategorized: false,
      categoryIds: filters.categoryIds.includes(id)
        ? filters.categoryIds.filter((value) => value !== id)
        : [...filters.categoryIds, id],
    });
  }
  function option(category: Category, child = false) {
    const checked = filters.categoryIds.includes(category.id);
    return (
      <button
        key={category.id}
        type="button"
        aria-pressed={checked}
        onClick={() => toggle(category.id)}
        className={`flex min-h-10 w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${child ? "pl-8" : "font-medium"}`}
      >
        <span aria-hidden="true" className="w-5 text-center">
          {category.icon || "•"}
        </span>
        <span className="min-w-0 flex-1 break-words">{category.name}</span>
        {checked && <Check size={16} aria-hidden="true" />}
      </button>
    );
  }
  return (
    <Popover.Root
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
    >
      <Popover.Trigger
        className={buttonVariants({
          variant: "outline",
          size: "sm",
          className:
            "h-9 min-h-11 w-full justify-between gap-3 font-normal sm:min-h-0 sm:w-44",
        })}
      >
        <span className="truncate">{summary}</span>
        <ChevronDown
          size={14}
          className="shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          sideOffset={6}
          align="start"
          className="z-[90] outline-none"
        >
          <Popover.Popup
            aria-label={t("transactions.categories")}
            className="w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-lg outline-none"
          >
            <Input
              type="search"
              aria-label={t("transactions.searchCategoriesLabel")}
              placeholder={t("transactions.searchCategories")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <p className="px-1 pt-2 text-xs text-muted-foreground">
              {t("transactions.categoryGroupHint")}
            </p>
            <div className="mt-2 max-h-64 overflow-y-auto">
              {groups.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  {t("transactions.noResults")}
                </p>
              )}
              {groups.map((parent) => (
                <div key={parent.id}>
                  {option(parent)}
                  {parent.children.map((child) => option(child, true))}
                </div>
              ))}
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
