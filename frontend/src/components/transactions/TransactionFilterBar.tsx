import type { Category } from "@/types/category";
import type { PaymentSource } from "@/hooks/usePaymentSources";
import type { TransactionFilters } from "@/types/transaction";

interface TransactionFilterBarProps {
  filters: TransactionFilters;
  categories: Category[];
  tags: string[];
  paymentSources: PaymentSource[];
  onChange: (next: TransactionFilters) => void;
}

export function TransactionFilterBar({
  filters,
  categories,
  tags,
  paymentSources,
  onChange,
}: TransactionFilterBarProps) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-5">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Category</span>
        <select
          value={filters.categoryId}
          onChange={(e) => onChange({ ...filters, categoryId: e.target.value })}
          className="rounded-md border border-input bg-background px-2 py-2"
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <optgroup key={category.id} label={category.name}>
              <option value={category.id}>{category.name}</option>
              {category.children.map((child) => (
                <option key={child.id} value={child.id}>
                  {category.name} / {child.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Tag</span>
        <input
          list="transaction-tags"
          value={filters.tag}
          onChange={(e) => onChange({ ...filters, tag: e.target.value })}
          placeholder="All tags"
          className="rounded-md border border-input bg-background px-2 py-2"
        />
        <datalist id="transaction-tags">
          {tags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Payment source</span>
        <select
          value={filters.paymentSourceId}
          onChange={(e) =>
            onChange({ ...filters, paymentSourceId: e.target.value })
          }
          className="rounded-md border border-input bg-background px-2 py-2"
        >
          <option value="">All sources</option>
          {paymentSources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Date from</span>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })}
          className="rounded-md border border-input bg-background px-2 py-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Date to</span>
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => onChange({ ...filters, dateTo: e.target.value })}
          className="rounded-md border border-input bg-background px-2 py-2"
        />
      </label>
    </div>
  );
}
