import { useId, useState, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  CircleAlert,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Card, Input, Select } from "@monqom/ui";
import {
  formatShortDate,
  getMonthDateRange,
  getMonthInTimeZone,
} from "@/lib/date-only";
import { DEFAULT_TRANSACTION_FILTERS } from "@/lib/transaction-list-state";
import { paymentSourceName } from "@/lib/payment-sources";
import type { Category } from "@/types/category";
import type { PaymentSource } from "@/types/payment-source";
import type { TransactionFilters } from "@/types/transaction";
import { TransactionCategoryFilter } from "./TransactionCategoryFilter";

interface TransactionFilterBarProps {
  filters: TransactionFilters;
  categories: Category[];
  tags: string[];
  paymentSources: PaymentSource[];
  timeZone: string;
  onChange: (next: TransactionFilters) => void;
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5 text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={t("transactions.removeFilter", { filter: label })}
      className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-11"
    >
      <span className="truncate">{label}</span>
      <X size={12} className="shrink-0" aria-hidden="true" />
    </button>
  );
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
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const currentMonth = getMonthDateRange(
    getMonthInTimeZone(new Date(), timeZone),
  );
  const isCurrentMonth =
    filters.dateFrom === currentMonth.dateFrom &&
    filters.dateTo === currentMonth.dateTo;
  const hasDates = Boolean(filters.dateFrom || filters.dateTo);
  const extraCount = [
    filters.origin,
    filters.tag,
    filters.paymentSourceId,
    hasDates,
  ].filter(Boolean).length;
  const hasFilters = Boolean(
    extraCount ||
    filters.type ||
    filters.uncategorized ||
    filters.categoryIds.length,
  );
  const source = paymentSources.find(
    (item) => item.id === filters.paymentSourceId,
  );
  const originLabel =
    filters.origin === "integration"
      ? t("transactions.imported")
      : t("transactions.manual");
  const dateLabel = [
    filters.dateFrom ? formatShortDate(filters.dateFrom) : "…",
    filters.dateTo ? formatShortDate(filters.dateTo) : "…",
  ].join(" - ");

  function resetFilters() {
    onChange({
      ...DEFAULT_TRANSACTION_FILTERS,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
    });
  }

  return (
    <Card padding="none">
      <div
        className="flex flex-wrap items-center gap-2 p-3"
        role="group"
        aria-label={t("transactions.filters")}
      >
        <label className="min-w-32 flex-1 sm:flex-none">
          <span className="sr-only">{t("transactions.type")}</span>
          <Select
            value={filters.type ?? ""}
            onChange={(event) =>
              onChange({
                ...filters,
                type: event.target.value as TransactionFilters["type"],
                categoryIds: [],
              })
            }
            className="h-9 w-full text-sm max-sm:min-h-11"
          >
            <option value="">{t("transactions.allTypes")}</option>
            <option value="expense">{t("transactions.expense")}</option>
            <option value="income">{t("transactions.income")}</option>
          </Select>
        </label>
        <div className="min-w-40 flex-1 sm:flex-none">
          <TransactionCategoryFilter
            filters={filters}
            categories={categories}
            onChange={onChange}
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant={isCurrentMonth ? "secondary" : "ghost"}
          aria-pressed={isCurrentMonth}
          className="h-9 gap-1.5"
          onClick={() =>
            onChange({
              ...filters,
              dateFrom: isCurrentMonth ? "" : currentMonth.dateFrom,
              dateTo: isCurrentMonth ? "" : currentMonth.dateTo,
            })
          }
        >
          <CalendarDays size={15} aria-hidden="true" />
          {t("transactions.thisMonth")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={filters.uncategorized ? "secondary" : "ghost"}
          aria-pressed={Boolean(filters.uncategorized)}
          className="h-9 gap-1.5"
          onClick={() =>
            onChange({
              ...filters,
              uncategorized: !filters.uncategorized,
              categoryIds: [],
            })
          }
        >
          <CircleAlert size={15} aria-hidden="true" />
          {t("transactions.needsAttention")}
        </Button>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-9 gap-1.5"
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => setExpanded((value) => !value)}
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            {t("transactions.moreFilters")}
            {extraCount > 0 && (
              <span
                aria-hidden="true"
                className="flex size-5 items-center justify-center rounded-md bg-muted text-xs tabular-nums"
              >
                {extraCount}
              </span>
            )}
            <ChevronDown
              size={13}
              aria-hidden="true"
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </Button>
          {hasFilters && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 text-muted-foreground"
              onClick={resetFilters}
            >
              {t("transactions.clearFilters")}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div
          id={panelId}
          className="grid grid-cols-1 gap-3 border-t border-border bg-muted/20 p-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <FilterField label={t("transactions.origin")}>
            <Select
              value={filters.origin ?? ""}
              onChange={(event) =>
                onChange({
                  ...filters,
                  origin: event.target.value as TransactionFilters["origin"],
                })
              }
            >
              <option value="">{t("transactions.allOrigins")}</option>
              <option value="integration">{t("transactions.imported")}</option>
              <option value="manual">{t("transactions.manual")}</option>
            </Select>
          </FilterField>
          <FilterField label={t("common.paymentSource")}>
            <Select
              value={filters.paymentSourceId}
              onChange={(event) =>
                onChange({ ...filters, paymentSourceId: event.target.value })
              }
            >
              <option value="">{t("transactions.allSources")}</option>
              {paymentSources.map((item) => (
                <option key={item.id} value={item.id}>
                  {paymentSourceName(item, t)}
                  {item.isArchived ? ` (${t("paymentSources.archived")})` : ""}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t("common.tags")}>
            <Select
              value={filters.tag}
              onChange={(event) =>
                onChange({ ...filters, tag: event.target.value })
              }
            >
              <option value="">{t("transactions.allTags")}</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t("transactions.dateFrom")}>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(event) =>
                onChange({ ...filters, dateFrom: event.target.value })
              }
            />
          </FilterField>
          <FilterField label={t("transactions.dateTo")}>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(event) =>
                onChange({ ...filters, dateTo: event.target.value })
              }
            />
          </FilterField>
        </div>
      )}

      {extraCount > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
          {filters.origin && (
            <FilterChip
              label={originLabel}
              onRemove={() => onChange({ ...filters, origin: "" })}
            />
          )}
          {filters.paymentSourceId && (
            <FilterChip
              label={
                source ? paymentSourceName(source, t) : filters.paymentSourceId
              }
              onRemove={() => onChange({ ...filters, paymentSourceId: "" })}
            />
          )}
          {filters.tag && (
            <FilterChip
              label={`${t("common.tags")}: ${filters.tag}`}
              onRemove={() => onChange({ ...filters, tag: "" })}
            />
          )}
          {hasDates && (
            <FilterChip
              label={dateLabel}
              onRemove={() =>
                onChange({ ...filters, dateFrom: "", dateTo: "" })
              }
            />
          )}
        </div>
      )}
    </Card>
  );
}
