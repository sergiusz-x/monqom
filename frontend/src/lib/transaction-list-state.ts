import type {
  TransactionFilters,
  TransactionSortField,
} from "@/types/transaction";

export const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = {
  categoryIds: [],
  tag: "",
  paymentSourceId: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "date",
  sortDirection: "desc",
};

const PREFERENCE_VERSION = 1;
const PREFERENCE_KEY_PREFIX = "monqom:transaction-list-preferences:v1:";
const LEGACY_KEY_PREFIX = "monqom:transaction-filters:";
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const FILTER_PARAMS = [
  "category_ids",
  "category_id",
  "tag",
  "payment_source_id",
  "date_from",
  "date_to",
  "sort_by",
  "sort_direction",
] as const;
const SORT_FIELDS = new Set<TransactionSortField>([
  "date",
  "category",
  "amount",
  "description",
  "notes",
  "tags",
  "payment_source",
]);

export function hasTransactionListState(params: URLSearchParams): boolean {
  return params.has("page") || FILTER_PARAMS.some((name) => params.has(name));
}

export function parseTransactionFilters(
  params: URLSearchParams,
): TransactionFilters {
  return normalizeFilters({
    categoryIds: (
      params.get("category_ids") ??
      params.get("category_id") ??
      ""
    ).split(","),
    tag: params.get("tag"),
    paymentSourceId: params.get("payment_source_id"),
    dateFrom: params.get("date_from"),
    dateTo: params.get("date_to"),
    sortBy: params.get("sort_by"),
    sortDirection: params.get("sort_direction"),
  });
}

export function parseTransactionPage(params: URLSearchParams): number {
  const rawPage = params.get("page");
  if (!rawPage || !/^\d+$/.test(rawPage)) return 1;
  const page = Number(rawPage);
  return Number.isSafeInteger(page) && page >= 1 ? page : 1;
}

export function buildTransactionListParams(
  current: URLSearchParams,
  filters: TransactionFilters,
  page = 1,
): URLSearchParams {
  const params = new URLSearchParams(current);
  FILTER_PARAMS.forEach((name) => params.delete(name));
  params.delete("page");

  if (filters.categoryIds.length > 0) {
    params.set("category_ids", filters.categoryIds.join(","));
  }
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.paymentSourceId) {
    params.set("payment_source_id", filters.paymentSourceId);
  }
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.sortBy !== DEFAULT_TRANSACTION_FILTERS.sortBy) {
    params.set("sort_by", filters.sortBy);
  }
  if (filters.sortDirection !== DEFAULT_TRANSACTION_FILTERS.sortDirection) {
    params.set("sort_direction", filters.sortDirection);
  }
  if (page > 1) params.set("page", String(page));

  return params;
}

export function loadTransactionPreferences(
  storage: Storage,
  workspaceId: string,
): TransactionFilters | null {
  const preferenceKey = `${PREFERENCE_KEY_PREFIX}${workspaceId}`;
  const legacyKey = `${LEGACY_KEY_PREFIX}${workspaceId}`;

  try {
    const current = storage.getItem(preferenceKey);
    if (current) {
      const parsed = JSON.parse(current) as unknown;
      if (
        isRecord(parsed) &&
        parsed.version === PREFERENCE_VERSION &&
        isRecord(parsed.filters)
      ) {
        return normalizeFilters(parsed.filters);
      }
      storage.removeItem(preferenceKey);
    }

    const legacy = storage.getItem(legacyKey);
    if (!legacy) return null;
    const parsedLegacy = JSON.parse(legacy) as unknown;
    storage.removeItem(legacyKey);
    if (!isRecord(parsedLegacy)) return null;
    const filters = normalizeFilters(parsedLegacy);
    saveTransactionPreferences(storage, workspaceId, filters);
    return filters;
  } catch {
    storage.removeItem(preferenceKey);
    storage.removeItem(legacyKey);
    return null;
  }
}

export function saveTransactionPreferences(
  storage: Storage,
  workspaceId: string,
  filters: TransactionFilters,
): void {
  try {
    storage.setItem(
      `${PREFERENCE_KEY_PREFIX}${workspaceId}`,
      JSON.stringify({ version: PREFERENCE_VERSION, filters }),
    );
  } catch {
    // Preferences are an enhancement; unavailable storage must not break the list.
  }
}

function normalizeFilters(value: Record<string, unknown>): TransactionFilters {
  const categoryIds = Array.isArray(value.categoryIds)
    ? Array.from(
        new Set(
          value.categoryIds
            .filter(
              (id): id is string =>
                typeof id === "string" && id.trim().length > 0,
            )
            .map((id) => id.trim().slice(0, 128)),
        ),
      ).slice(0, 100)
    : [];
  const sortBy = isSortField(value.sortBy)
    ? value.sortBy
    : DEFAULT_TRANSACTION_FILTERS.sortBy;

  return {
    categoryIds,
    tag: normalizeString(value.tag, 100),
    paymentSourceId: normalizeString(value.paymentSourceId, 128),
    dateFrom: normalizeDate(value.dateFrom),
    dateTo: normalizeDate(value.dateTo),
    sortBy,
    sortDirection: value.sortDirection === "asc" ? "asc" : "desc",
  };
}

function normalizeString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizeDate(value: unknown): string {
  return typeof value === "string" && DATE_ONLY_PATTERN.test(value)
    ? value
    : "";
}

function isSortField(value: unknown): value is TransactionSortField {
  return (
    typeof value === "string" && SORT_FIELDS.has(value as TransactionSortField)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
