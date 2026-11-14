import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, SectionCard } from "@monqom/ui";
import { useOptionalAuth } from "@/contexts/AuthContext";
import { useSalaryPrivacy } from "@/contexts/SalaryPrivacyContext";
import { formatMonth, formatShortMonth } from "@/lib/date-only";
import { formatCurrency } from "@/lib/money";
import { getIntlLocale } from "@/lib/locale";
import type { FinancialTrendItem } from "@/types/dashboard";

export function FinancialTrend({
  trend,
  currency,
  currentMonth,
  selectedMonth,
  revealed,
  onReveal,
  onSelectMonth,
  range,
  onRangeChange,
}: {
  trend: FinancialTrendItem[];
  currency: string;
  currentMonth: string;
  selectedMonth: string;
  revealed: boolean;
  onReveal: () => void;
  onSelectMonth: (month: string) => void;
  range: 6 | 12;
  onRangeChange: (range: 6 | 12) => void;
}) {
  const tooltipId = useId();
  const [hoveredPoint, setHoveredPoint] = useState<{
    month: string;
    key: "income" | "spending";
  } | null>(null);
  const { t } = useTranslation();
  const hideAmounts = Boolean(useOptionalAuth()?.user?.hideSalaryAmounts);
  const { revealAll } = useSalaryPrivacy();
  const selectedIndex = trend.findIndex((item) => item.month === selectedMonth);
  const latestStart = Math.max(0, trend.length - range);
  const start =
    selectedIndex >= 0 && selectedMonth !== currentMonth
      ? Math.min(
          latestStart,
          Math.max(0, selectedIndex - Math.floor((range - 1) / 2)),
        )
      : latestStart;
  const items = trend.slice(start, start + range);
  const selected = items.find((item) => item.month === selectedMonth);
  const hasData = items.some(
    (item) => item.income !== null && item.spending !== null,
  );
  const locked = hideAmounts && !revealed && !revealAll;
  const dataMax = Math.max(
    1,
    ...items.flatMap((item) => [item.income ?? 0, item.spending ?? 0]),
  );
  const unit =
    dataMax >= 10000
      ? 1000
      : 10 ** Math.max(0, Math.floor(Math.log10(dataMax)) - 1);
  const max = Math.ceil(dataMax / (2 * unit)) * 2 * unit;
  const x = (index: number) =>
    (index + 0.5) * (700 / Math.max(1, items.length));
  const y = (value: number) => 172 - (value / max) * 146;
  function segments(key: "income" | "spending") {
    const result: string[][] = [];
    let current: string[] = [];
    items.forEach((item, index) => {
      if (item[key] === null || item.month === currentMonth) {
        if (current.length) result.push(current);
        current = [];
      } else current.push(`${x(index)},${y(item[key])}`);
    });
    if (current.length) result.push(current);
    return result;
  }
  return (
    <SectionCard padding="responsive" elevation="raised">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {t("dashboard.financialTrend")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("dashboard.financialTrendDescription")}
          </p>
        </div>
        {!locked && (
          <div
            className="flex gap-1 rounded-lg bg-muted p-1"
            role="group"
            aria-label={t("dashboard.trendRange")}
          >
            {([6, 12] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  onRangeChange(value);
                }}
                aria-pressed={range === value}
                className={`min-h-9 rounded-md px-3 text-sm font-medium ${range === value ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t("dashboard.months", { count: value })}
              </button>
            ))}
          </div>
        )}
      </div>
      {locked ? (
        <div className="relative mt-5 flex min-h-48 items-center justify-center overflow-hidden rounded-lg bg-muted/30">
          <svg
            viewBox="0 0 700 190"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="absolute inset-5 h-[calc(100%-2.5rem)] w-[calc(100%-2.5rem)] blur-md opacity-60"
          >
            {[26, 99, 172].map((position) => (
              <line
                key={position}
                x1="0"
                x2="700"
                y1={position}
                y2={position}
                stroke="var(--border)"
                strokeDasharray="3 4"
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {(["income", "spending"] as const).map((key) => (
              <g
                key={key}
                fill="none"
                stroke={
                  key === "income"
                    ? "var(--color-emerald-500)"
                    : "var(--muted-foreground)"
                }
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              >
                {segments(key).map((points, index) => (
                  <polyline
                    key={index}
                    points={points.join(" ")}
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
                {items.map((item, index) => {
                  const value = item[key];
                  const previousValue = items[index - 1]?.[key];
                  return item.month === currentMonth &&
                    value !== null &&
                    previousValue != null ? (
                    <line
                      key={item.month}
                      x1={x(index - 1)}
                      y1={y(previousValue)}
                      x2={x(index)}
                      y2={y(value)}
                      strokeDasharray="5 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  ) : null;
                })}
              </g>
            ))}
          </svg>
          <Button
            type="button"
            variant="outline"
            className="relative"
            onClick={onReveal}
          >
            {t("dashboard.revealTrend")}
          </Button>
        </div>
      ) : !hasData ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t("dashboard.noFinancialTrend")}
        </p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              {t("dashboard.income")}
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-foreground/60" />
              {t("dashboard.totalSpending")}
            </span>
            {items.some((item) => item.month === currentMonth) && (
              <span className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="w-4 border-t-2 border-dashed border-muted-foreground"
                  aria-hidden="true"
                />
                {t("dashboard.monthInProgress")}
              </span>
            )}
          </div>
          <div className="mt-2">
            <div className="flex">
              <div
                className="relative h-44 w-10 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground sm:h-56"
                aria-hidden="true"
              >
                {[
                  { value: max, position: "13.7%" },
                  { value: max / 2, position: "52.1%" },
                  { value: 0, position: "90.5%" },
                ].map(({ value, position }) => (
                  <span
                    key={position}
                    className="absolute right-0 -translate-y-1/2"
                    style={{ top: position }}
                  >
                    {new Intl.NumberFormat(getIntlLocale(), {
                      notation: max >= 10000 ? "compact" : "standard",
                      maximumFractionDigits: 0,
                    }).format(value)}
                  </span>
                ))}
              </div>
              <div className="relative h-44 min-w-0 flex-1 sm:h-56">
                <svg
                  viewBox="0 0 700 190"
                  className="block h-full w-full"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {[26, 99, 172].map((line) => (
                    <line
                      key={line}
                      x1="0"
                      x2="700"
                      y1={line}
                      y2={line}
                      stroke="var(--border)"
                      strokeDasharray="3 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  ))}
                  {selected && (
                    <line
                      x1={x(items.indexOf(selected))}
                      x2={x(items.indexOf(selected))}
                      y1="18"
                      y2="180"
                      stroke="var(--border)"
                      strokeDasharray="3 4"
                      vectorEffect="non-scaling-stroke"
                    />
                  )}
                  {(["income", "spending"] as const).map((key) => (
                    <g
                      key={key}
                      fill="none"
                      stroke={
                        key === "income"
                          ? "var(--color-emerald-500)"
                          : "var(--muted-foreground)"
                      }
                      strokeWidth="2"
                      vectorEffect="non-scaling-stroke"
                    >
                      {segments(key).map((points, index) => (
                        <polyline
                          key={index}
                          points={points.join(" ")}
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                      {items.map((item, index) => {
                        const previous = items[index - 1];
                        const value = item[key];
                        const previousValue = previous?.[key];
                        return item.month === currentMonth &&
                          value !== null &&
                          previousValue != null ? (
                          <line
                            key={`partial-${item.month}`}
                            x1={x(index - 1)}
                            y1={y(previousValue)}
                            x2={x(index)}
                            y2={y(value)}
                            strokeDasharray="5 4"
                            vectorEffect="non-scaling-stroke"
                          />
                        ) : null;
                      })}
                    </g>
                  ))}
                  {items.map((item, index) => (
                    <rect
                      key={item.month}
                      x={index * (700 / items.length)}
                      y="0"
                      width={700 / items.length}
                      height="190"
                      fill="transparent"
                      className="cursor-pointer"
                      onClick={() => onSelectMonth(item.month)}
                    />
                  ))}
                </svg>
                {items.flatMap((item, index) =>
                  (["income", "spending"] as const).map((key) => {
                    const value = item[key];
                    if (value === null) return null;
                    const isSelected = item.month === selected?.month;
                    const isCurrent = item.month === currentMonth;
                    const isHovered =
                      hoveredPoint?.month === item.month &&
                      hoveredPoint.key === key;
                    const fillClass =
                      key === "income"
                        ? "bg-emerald-500"
                        : "bg-muted-foreground";
                    const borderClass =
                      key === "income"
                        ? "border-emerald-500"
                        : "border-muted-foreground";
                    return (
                      <span
                        key={`${item.month}-${key}`}
                        aria-hidden="true"
                        className="pointer-events-auto absolute z-10 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full"
                        style={{
                          left: `${(x(index) / 700) * 100}%`,
                          top: `${(y(value) / 190) * 100}%`,
                        }}
                        onMouseEnter={() =>
                          setHoveredPoint({ month: item.month, key })
                        }
                        onMouseLeave={() => setHoveredPoint(null)}
                        onClick={() => onSelectMonth(item.month)}
                      >
                        <span
                          className={`rounded-full ${
                            isSelected
                              ? `h-3.5 w-3.5 border-2 border-background shadow-sm ${fillClass}`
                              : isCurrent
                                ? `h-1.5 w-1.5 border border-dashed bg-card ${borderClass}`
                                : `h-1.5 w-1.5 border ${fillClass} ${borderClass}`
                          } ${isHovered ? (key === "income" ? "ring-4 ring-emerald-500/15" : "ring-4 ring-muted-foreground/15") : ""}`}
                        />
                      </span>
                    );
                  }),
                )}
                {hoveredPoint &&
                  (() => {
                    const item = items.find(
                      (entry) => entry.month === hoveredPoint.month,
                    );
                    if (!item) return null;
                    const index = items.indexOf(item);
                    const value = item[hoveredPoint.key];
                    if (value === null) return null;
                    const left = (x(index) / 700) * 100;
                    const top = (y(value) / 190) * 100;
                    return (
                      <div
                        id={tooltipId}
                        role="tooltip"
                        className="pointer-events-none absolute z-20 w-48 max-w-full rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg"
                        style={{
                          left: `clamp(0px, calc(${left}% - 6rem), max(0px, calc(100% - 12rem)))`,
                          top: `${top}%`,
                          transform:
                            top < 35
                              ? "translateY(12px)"
                              : "translateY(calc(-100% - 12px))",
                        }}
                      >
                        <p className="border-b border-border pb-2 text-sm font-semibold">
                          {formatMonth(item.month)}
                        </p>
                        <div className="mt-2 space-y-1.5 text-xs">
                          {(["income", "spending"] as const).map((key) => (
                            <div
                              key={key}
                              className="flex items-center justify-between gap-3"
                            >
                              <span className="flex items-center gap-2 text-muted-foreground">
                                <span
                                  aria-hidden="true"
                                  className={`size-2 shrink-0 rounded-full ${key === "income" ? "bg-emerald-500" : "bg-muted-foreground"}`}
                                />
                                {t(
                                  key === "income"
                                    ? "dashboard.income"
                                    : "dashboard.totalSpending",
                                )}
                              </span>
                              <span className="whitespace-nowrap font-medium tabular-nums">
                                {item[key] === null
                                  ? "-"
                                  : formatCurrency(item[key], currency)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
              </div>
            </div>
            <div
              className="ml-10 grid"
              style={{
                gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
              }}
            >
              {items.map((item, index) => (
                <button
                  key={item.month}
                  type="button"
                  aria-label={formatMonth(item.month)}
                  aria-pressed={selected?.month === item.month}
                  aria-describedby={
                    hoveredPoint?.month === item.month ? tooltipId : undefined
                  }
                  onFocus={() => {
                    const key =
                      item.income !== null
                        ? "income"
                        : item.spending !== null
                          ? "spending"
                          : null;
                    setHoveredPoint(key ? { month: item.month, key } : null);
                  }}
                  onBlur={() => setHoveredPoint(null)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setHoveredPoint(null);
                  }}
                  onClick={() => onSelectMonth(item.month)}
                  className="min-h-11 overflow-hidden rounded text-center text-xs text-muted-foreground hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring aria-pressed:font-semibold aria-pressed:text-foreground"
                >
                  <span
                    className={
                      range === 12 &&
                      (index === 10 || (index % 2 === 1 && index !== 11))
                        ? "max-sm:sr-only"
                        : undefined
                    }
                  >
                    {formatShortMonth(item.month)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {selected && (
            <div
              className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded-lg bg-muted/40 px-4 py-3 text-sm"
              aria-live="polite"
            >
              <span className="font-medium">
                {formatMonth(selected.month)}
                {selected.month === currentMonth
                  ? ` · ${t("dashboard.monthInProgress")}`
                  : ""}
              </span>
              {selected.income === null || selected.spending === null ? (
                <span className="text-muted-foreground">
                  {t("dashboard.noMonthTransactions")}
                </span>
              ) : (
                <>
                  <span>
                    {t("dashboard.income")}:{" "}
                    <strong className="font-medium text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(selected.income, currency)}
                    </strong>
                  </span>
                  <span>
                    {t("dashboard.totalSpending")}:{" "}
                    <strong className="font-medium">
                      {formatCurrency(selected.spending, currency)}
                    </strong>
                  </span>
                  <span>
                    {t("dashboard.netBalance")}:{" "}
                    <strong className="font-medium">
                      {formatCurrency(
                        selected.income - selected.spending,
                        currency,
                      )}
                    </strong>
                  </span>
                </>
              )}
            </div>
          )}
        </>
      )}
    </SectionCard>
  );
}
