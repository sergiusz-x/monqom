export interface Category {
  id: string;
  name: string;
  systemKey?: string | null;
  icon: string | null;
  parentId: string | null;
  sortOrder: number;
  children: Category[];
}
