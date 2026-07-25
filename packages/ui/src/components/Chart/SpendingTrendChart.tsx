import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { SpendingTrendItem } from '@/types/dashboard';
import { formatCurrency } from '@/lib/money';
import { formatMonth, formatShortMonth } from '@/lib/date-only';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';

const FALLBACK_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
  'var(--chart-8)',
] as const;

export function SpendingTrendChart({ trend, currency, currentMonth }: { trend: SpendingTrendItem[]; currency: string; currentMonth: string }) {
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  if (trend.length === 0) {
    return null;
  }

  const maxTotal = Math.max(...trend.map((item) => item.total), 0);

  const barData = trend.map((item) => ({
    month: item.month,
    total: item.total,
    formattedMonth: formatMonth(item.month),
    shortMonth: formatShortMonth(item.month),
  }));

  const getBarFill = (month: string): string => {
    if (month === selectedMonth) return 'var(--chart-2)';
    if (month === currentMonth) return 'var(--chart-1)';
    return 'var(--chart-3)';
  };

  const getBarOpacity = (month: string): number => {
    if (month === selectedMonth) return 1;
    if (month === currentMonth) return 1;
    return 0.7; // matches bg-chart-3/70
  };

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t('dashboard.trend')}</h2>
          <p className="text-sm text-muted-foreground">{t('dashboard.trendDescription')}</p>
        </div>
        {(selectedMonth ?? currentMonth) {selectedMonth ?? currentMonth && ({selectedMonth ?? currentMonth && ( (
          <p className="rounded-full bg-muted px-3 py-1 text-sm font-medium">
            {formatMonth(selectedMonth ?? currentMonth)}: {formatCurrency(
              trend.find((i) => i.month === (selectedMonth ?? currentMonth))?.total ?? 0,
              currency
            )}
          </p>
        )}
      </div>

      <div className="grid grid-cols-[auto_1fr] gap-3">
        {/* Vertical axis labels */}
        <div className="flex h-48 flex-col justify-between text-right text-xs text-muted-foreground" aria-hidden="true">
          <span>{formatCurrency(maxTotal, currency)}</span>
          <span>{formatCurrency(maxTotal / 2, currency)}</span>
          <span>{formatCurrency(0, currency)}</span>
        </div>

        {/* Chart container */}
        <div className="min-w-0 relative">
          {/* The chart with role=list and aria-label for accessibility */}
          <div
            role="list"
            aria-label={t("dashboard.monthlyAmounts")}
            className="h-48 w-full"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
              >
                <XAxis
                  dataKey="shortMonth"
                  tickLine={false}
                  tick={false}
                  axisLine={false}
                  tickFormatter={(value) => stringify(value)}
                />
                <YAxis
                  tick={false}
                  axisLine={false}
                  hide={true}
                />
                <Tooltip
                  labelFormatter={() => ''}
                  formatter={(payload) => {
                    const value = payload.value ?? 0;
                    const datum = barData.find((d) => d.total === value);
                    if (!datum) return '';
                    return `${formatMonth(datum.month)}: ${formatCurrency(value, currency)}`;
                  }}
                  contentStyle={{ backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 8px', borderRadius: '4px' }}
                  separator={': '}
                />
                <Legend verticalAlign="top" height={36} />
                {barData.map((entry) => (
                  <Bar
                    key={entry.month}
                    dataKey="total"
                    barSize={20}
                    fill={getBarFill(entry.month)}
                    opacity={getBarOpacity(entry.month)}
                    onClick={() => setSelectedMonth(entry.month)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Month labels below chart */}
          <div className="mt-2 grid grid-cols-6 gap-2 px-2 text-center text-xs text-muted-foreground sm:gap-4">
            {barData.map((entry) => (
              <span
                key={entry.month}
                className={
                  entry.month === currentMonth
                    ? "font-semibold text-foreground"
                    : ""
                }
              >
                {entry.month === currentMonth ? (
                  <span aria-hidden="true">● </span>
                ) : null}
                {entry.shortMonth}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// Helper to ensure value is string for tickFormatter
function stringify(value: unknown): string {
  return String(value);
}