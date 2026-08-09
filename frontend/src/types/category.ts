export interface Category {
  id: string;
  name: string;
  systemKey?: string | null;
  type?: "expense" | "income";
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  isArchived?: boolean;
  archivedAt?: string | null;
  children: Category[];
}
