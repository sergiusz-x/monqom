import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Search,
  ChevronDown,
  CircleAlert,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button, Card, Input, Select } from "@monqom/ui";
import {
  formatShortDate,
  getDateOnlyInTimeZone,
  getMonthDateRange,
  getMonthInTimeZone,
  shiftMonth,
} from "@/lib/date-only";
import { DEFAULT_TRANSACTION_FILTERS } from "@/lib/transaction-list-state";
import { translateSystemLabel } from "@/i18n/translate-system-label";
import { paymentSourceName } from "@/lib/payment-sources";
import type { Category } from "@/types/category";
import type { PaymentSource } from "@/types/payment-source";
import type { TransactionFilters } from "@/types/transaction";
import { TransactionCategoryFilter } from "./TransactionCategoryFilter";

interface TransactionFilterBarProps {
  filters: TransactionFilters;
  categories: Category[];
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
  paymentSources,
  timeZone,
  onChange,
}: TransactionFilterBarProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const [search, setSearch] = useState(filters.search ?? "");
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const latestFilters = useRef(filters);
  useEffect(() => {
    latestFilters.current = filters;
  }, [filters]);
  useEffect(() => {
    // Keep the draft in sync with navigation and filters cleared elsewhere.
    clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSearch(filters.search ?? "");
  }, [filters.search]);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  function updateSearch(value: string) {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      onChange({ ...latestFilters.current, search: value.trim() });
    }, 300);
  }
  const currentMonth = getMonthDateRange(
    getMonthInTimeZone(new Date(), timeZone),
  );
  const isCurrentMonth =
    filters.dateFrom === currentMonth.dateFrom &&
    filters.dateTo === currentMonth.dateTo;
  const hasDates = Boolean(filters.dateFrom || filters.dateTo);
  const invalidDates = Boolean(
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo,
  );
  const previousMonth = getMonthDateRange(
    shiftMonth(getMonthInTimeZone(new Date(), timeZone), -1),
  );
  const today = getDateOnlyInTimeZone(new Date(), timeZone);
  const thirtyDaysStart = new Date(`${today}T00:00:00Z`);
  thirtyDaysStart.setUTCDate(thirtyDaysStart.getUTCDate() - 29);
  const lastThirtyDays = {
    dateFrom: thirtyDaysStart.toISOString().slice(0, 10),
    dateTo: today,
  };
  const categoryNames = new Map(
    categories
      .flatMap((parent) => [parent, ...parent.children])
      .map((category) => [
        category.id,
        translateSystemLabel(t, category.systemKey, category.name),
      ]),
  );
  const extraCount = [filters.origin, filters.paymentSourceId, hasDates].filter(
    Boolean,
  ).length;
  const hasFilters = Boolean(
    extraCount ||
    filters.search ||
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
    clearTimeout(searchTimer.current);
    setSearch("");
    onChange({
      ...DEFAULT_TRANSACTION_FILTERS,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
    });
  }

  return (
    <Card padding="none">
      <div className="relative border-b border-border p-3">
        <Search
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label={t("transactions.search")}
          placeholder={t("transactions.searchPlaceholder")}
          value={search}
          maxLength={200}
          onChange={(event) => updateSearch(event.target.value)}
          className="w-full pl-9"
        />
      </div>
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
                categoryIds: filters.categoryIds.filter((id) => {
                  const category = categories.find(
                    (parent) =>
                      parent.id === id ||
                      parent.children.some((child) => child.id === id),
                  );
                  return (
                    !category ||
                    !category.type ||
                    !event.target.value ||
                    category.type === event.target.value
                  );
                }),
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
          className="min-h-11 gap-1.5 sm:min-h-0 sm:h-9"
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
          className="min-h-11 gap-1.5 sm:min-h-0 sm:h-9"
          onClick={() =>
            onChange({
              ...filters,
              uncategorized: !filters.uncategorized,
              categoryIds: [],
            })
          }
        >
          <CircleAlert size={15} aria-hidden="true" />
          {t("transactions.withoutCategory")}
        </Button>
        <div className="flex items-center gap-1 sm:ml-auto">
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

      {invalidDates && !expanded && (
        <p
          role="alert"
          className="border-t border-border px-3 py-2 text-sm text-destructive"
        >
          {t("transactions.invalidRange")}
        </p>
      )}
      <div className="border-t border-border px-3 py-2 md:hidden">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{t("transactions.sort")}</span>
          <Select
            value={`${filters.sortBy}:${filters.sortDirection}`}
            onChange={(event) => {
              const [sortBy, sortDirection] = event.target.value.split(":") as [
                TransactionFilters["sortBy"],
                TransactionFilters["sortDirection"],
              ];
              onChange({ ...filters, sortBy, sortDirection });
            }}
            className="h-9 flex-1 text-sm"
          >
            {!["date:desc", "date:asc", "amount:desc", "amount:asc"].includes(
              `${filters.sortBy}:${filters.sortDirection}`,
            ) && (
              <option value={`${filters.sortBy}:${filters.sortDirection}`}>
                {t("transactions.sort")}
              </option>
            )}
            <option value="date:desc">{t("transactions.newest")}</option>
            <option value="date:asc">{t("transactions.oldest")}</option>
            <option value="amount:desc">
              {t("transactions.highestAmount")}
            </option>
            <option value="amount:asc">{t("transactions.lowestAmount")}</option>
          </Select>
        </label>
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
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-5">
            {[
              { label: t("transactions.previousMonth"), range: previousMonth },
              {
                label: t("transactions.lastThirtyDays"),
                range: lastThirtyDays,
              },
            ].map(({ label, range }) => (
              <Button
                key={label}
                type="button"
                size="sm"
                variant={
                  filters.dateFrom === range.dateFrom &&
                  filters.dateTo === range.dateTo
                    ? "secondary"
                    : "ghost"
                }
                aria-pressed={
                  filters.dateFrom === range.dateFrom &&
                  filters.dateTo === range.dateTo
                }
                onClick={() => onChange({ ...filters, ...range })}
              >
                {label}
              </Button>
            ))}
          </div>
          <FilterField label={t("transactions.dateFrom")}>
            <Input
              type="date"
              aria-invalid={invalidDates}
              value={filters.dateFrom}
              onChange={(event) =>
                onChange({ ...filters, dateFrom: event.target.value })
              }
            />
          </FilterField>
          <FilterField label={t("transactions.dateTo")}>
            <Input
              type="date"
              aria-invalid={invalidDates}
              value={filters.dateTo}
              onChange={(event) =>
                onChange({ ...filters, dateTo: event.target.value })
              }
            />
          </FilterField>
          {invalidDates && (
            <p
              role="alert"
              className="text-sm text-destructive sm:col-span-2 lg:col-span-5"
            >
              {t("transactions.invalidRange")}
            </p>
          )}
        </div>
      )}

      {hasFilters && (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
          {filters.search && (
            <FilterChip
              label={filters.search}
              onRemove={() => {
                clearTimeout(searchTimer.current);
                setSearch("");
                onChange({ ...filters, search: "" });
              }}
            />
          )}
          {filters.type && (
            <FilterChip
              label={t(
                filters.type === "expense"
                  ? "transactions.expense"
                  : "transactions.income",
              )}
              onRemove={() => onChange({ ...filters, type: "" })}
            />
          )}
          {filters.uncategorized && (
            <FilterChip
              label={t("transactions.withoutCategory")}
              onRemove={() => onChange({ ...filters, uncategorized: false })}
            />
          )}
          {filters.categoryIds.map((id) => (
            <FilterChip
              key={id}
              label={categoryNames.get(id) ?? t("transactions.categories")}
              onRemove={() =>
                onChange({
                  ...filters,
                  categoryIds: filters.categoryIds.filter(
                    (value) => value !== id,
                  ),
                })
              }
            />
          ))}
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
