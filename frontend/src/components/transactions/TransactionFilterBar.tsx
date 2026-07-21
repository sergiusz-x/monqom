import { CalendarDays, Check, ChevronDown, X } from "lucide-react";
import { useMemo } from "react";
import type { Category } from "@/types/category";
import type { PaymentSource } from "@/types/payment-source";
import type { TransactionFilters } from "@/types/transaction";
import { useTranslation } from "react-i18next";
import { paymentSourceName } from "@/lib/payment-sources";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getMonthDateRange, getMonthInTimeZone } from "@/lib/date-only";
import { Menu } from "@base-ui/react/menu";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { translateSystemLabel } from "@/i18n/translate-system-label";

interface TransactionFilterBarProps {
  filters: TransactionFilters;
  categories: Category[];
  tags: string[];
  paymentSources: PaymentSource[];
  timeZone: string;
  onChange: (next: TransactionFilters) => void;
}

export function TransactionFilterBar({
  filters,
  categories,
  tags,
  paymentSources,
  timeZone,
  onChange,
}: TransactionFilterBarProps) {
  const { t } = useTranslation();
  const categoryOptions = useMemo(
    () =>
      categories.flatMap((category) => {
        const parentName = translateSystemLabel(
          t,
          category.systemKey,
          category.name,
        );
        return [
          { id: category.id, label: parentName },
          ...category.children.map((child) => ({
            id: child.id,
            label: `${parentName} / ${translateSystemLabel(
              t,
              child.systemKey,
              child.name,
            )}`,
          })),
        ];
      }),
    [categories, t],
  );
  const selectedCategoryLabels = categoryOptions
    .filter((option) => filters.categoryIds.includes(option.id))
    .map((option) => option.label);
  const categorySummary =
    selectedCategoryLabels.length === 0
      ? t("transactions.allCategories")
      : selectedCategoryLabels.length === 1
        ? selectedCategoryLabels[0]
        : t("transactions.selectedCategories", {
            count: selectedCategoryLabels.length,
          });
  const currentMonth = getMonthDateRange(
    getMonthInTimeZone(new Date(), timeZone),
  );
  const isCurrentMonth =
    filters.dateFrom === currentMonth.dateFrom &&
    filters.dateTo === currentMonth.dateTo;

  function toggleCategory(categoryId: string) {
    const selected = filters.categoryIds.includes(categoryId);
    onChange({
      ...filters,
      categoryIds: selected
        ? filters.categoryIds.filter((id) => id !== categoryId)
        : [...filters.categoryIds, categoryId],
    });
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t("transactions.quickRanges")}
        </span>
        <Button
          type="button"
          size="sm"
          variant={isCurrentMonth ? "default" : "outline"}
          className="gap-1.5"
          onClick={() =>
            onChange({
              ...filters,
              dateFrom: currentMonth.dateFrom,
              dateTo: currentMonth.dateTo,
            })
          }
        >
          <CalendarDays size={15} aria-hidden="true" />
          {t("transactions.thisMonth")}
        </Button>
        {(filters.dateFrom || filters.dateTo) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5"
            onClick={() => onChange({ ...filters, dateFrom: "", dateTo: "" })}
          >
            <X size={14} aria-hidden="true" />
            {t("transactions.clearDates")}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        <div className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("common.category")}</span>
          <Menu.Root>
            <Menu.Trigger
              className={buttonVariants({
                variant: "outline",
                className: "h-10 w-full justify-between px-2 font-normal",
              })}
            >
              <span className="truncate">{categorySummary}</span>
              <ChevronDown
                size={16}
                className="shrink-0 transition-transform group-data-[popup-open]/button:rotate-180"
                aria-hidden="true"
              />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner
                sideOffset={4}
                align="start"
                className="z-[90] outline-none"
              >
                <Menu.Popup className="max-h-72 min-w-[var(--anchor-width)] overflow-y-auto rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none md:w-72">
                  {filters.categoryIds.length > 0 && (
                    <Menu.Item
                      className="cursor-pointer rounded-md px-3 py-2 text-sm text-muted-foreground outline-none data-[highlighted]:bg-muted"
                      onClick={() => onChange({ ...filters, categoryIds: [] })}
                    >
                      {t("transactions.clearCategories")}
                    </Menu.Item>
                  )}
                  {categoryOptions.map((option) => {
                    const selected = filters.categoryIds.includes(option.id);
                    return (
                      <Menu.CheckboxItem
                        key={option.id}
                        checked={selected}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                        onCheckedChange={() => toggleCategory(option.id)}
                      >
                        <span className="flex size-4 shrink-0 items-center justify-center rounded border border-input">
                          {selected && <Check size={12} aria-hidden="true" />}
                        </span>
                        {option.label}
                      </Menu.CheckboxItem>
                    );
                  })}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{t("common.tags")}</span>
          <Select
            value={filters.tag}
            onChange={(event) =>
              onChange({ ...filters, tag: event.target.value })
            }
            className="rounded-md border border-input bg-background px-2 py-2"
          >
            <option value="">{t("transactions.allTags")}</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">
            {t("common.paymentSource")}
          </span>
          <Select
            value={filters.paymentSourceId}
            onChange={(event) =>
              onChange({ ...filters, paymentSourceId: event.target.value })
            }
            className="rounded-md border border-input bg-background px-2 py-2"
          >
            <option value="">{t("transactions.allSources")}</option>
            {paymentSources.map((source) => (
              <option key={source.id} value={source.id}>
                {paymentSourceName(source, t)}
                {source.isArchived ? ` (${t("paymentSources.archived")})` : ""}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">
            {t("transactions.dateFrom")}
          </span>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(event) =>
              onChange({ ...filters, dateFrom: event.target.value })
            }
            className="rounded-md border border-input bg-background px-2 py-2"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">
            {t("transactions.dateTo")}
          </span>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(event) =>
              onChange({ ...filters, dateTo: event.target.value })
            }
            className="rounded-md border border-input bg-background px-2 py-2"
          />
        </label>
      </div>
    </Card>
  );
}
