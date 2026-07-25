import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { CategoryBreakdown } from '@/types/dashboard';
import { formatCurrency } from '@/lib/money';
import { useTranslation } from 'react-i18next';
import { translateSystemLabel } from '@/i18n/translate-system-label';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

function monthDateRange(month: string): { dateFrom: string; dateTo: string } {
  const [yearPart, monthPart] = month.split('-');
  const year = Number(yearPart);
  const monthIndex = Number(monthPart) - 1;
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return {
    dateFrom: `${month}-01`,
    dateTo: `${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function SpendingByCategoryChart({ breakdown, month }: { breakdown: CategoryBreakdown; month: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { dateFrom, dateTo } = monthDateRange(month);
  const categories = [...breakdown.categories].sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount;
    return a.categoryName.localeCompare(b.categoryName);
  });

  const FALLBACK_COLORS = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
    'var(--chart-6)',
    'var(--chart-7)',
    'var(--chart-8)',
  ];

  function colorForCategory(categoryId: string, color: string | null): string {
    if (color) return color;
    let hash = 0;
    for (let i = 0; i < categoryId.length; i++) {
      hash = (hash + categoryId.charCodeAt(i) * (i + 1)) % 997;
    }
    return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={categories.map((c) => ({
          name: translateSystemLabel(t, c.categorySystemKey, c.categoryName),
          value: c.amount,
          ...c,
        }))}
        margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
      >
        <XAxis dataKey="name" tickLine={false} tick={false} axisLine={false} />
        <YAxis
          tick={false}
          axisLine={false}
          hide={true}
        />
        <Tooltip
          labelFormatter={() => ''}
          formatter={(payload) => formatCurrency(payload.value ?? 0, breakdown.currency)}
          contentStyle={{ backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', padding: '4px 8px', borderRadius: '4px' }}
          separator={': '}
        />
        <Legend verticalAlign="top" height={36} />
        {categories.map((c) => (
          <Bar
            key={c.categoryId}
            dataKey="value"
            barSize={20}
            fill={colorForCategory(c.categoryId, c.categoryColor)}
            onClick={() => {
              navigate(`/transactions?category_id=${c.categoryId}&date_from=${dateFrom}&date_to=${dateTo}`);
            }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}