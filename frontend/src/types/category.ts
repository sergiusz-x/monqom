export interface Category {
  id: string
  name: string
  icon: string | null
  parent_id: string | null
  sort_order: number
  children: Category[]
}
