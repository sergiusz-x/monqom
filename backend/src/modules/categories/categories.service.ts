import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { CategoriesRepository, CategoryRecord } from './categories.repository'

const CATEGORY_NOT_FOUND_MESSAGE = 'Category not found'

export interface ListCategoriesCommand {
    includeArchived?: boolean
}

export interface CategoryResponse {
    id: string
    name: string
    system_key: string | null
    icon: string | null
    parent_id: string | null
    sort_order: number
    children: CategoryResponse[]
}

@Injectable()
export class CategoriesService {
    constructor(private readonly categoriesRepository: CategoriesRepository) {}

    async listCategories(
        input: ListCategoriesCommand,
        workspaceId: string,
    ): Promise<CategoryResponse[]> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const includeArchived = input.includeArchived ?? false
        const categories = await this.categoriesRepository.listCategoriesByWorkspace(
            normalizedWorkspaceId,
            includeArchived,
        )

        return buildCategoryHierarchy(categories)
    }

    async getCategoryById(
        categoryId: string,
        input: ListCategoriesCommand,
        workspaceId: string,
    ): Promise<CategoryResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const normalizedCategoryId = normalizeRequiredValue(categoryId, 'Category id')
        const includeArchived = input.includeArchived ?? false
        const category = await this.categoriesRepository.findCategoryById(
            normalizedWorkspaceId,
            normalizedCategoryId,
            includeArchived,
        )

        if (!category) {
            throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE)
        }

        if (category.parentId) {
            return {
                ...mapCategoryResponse(category),
                children: [],
            }
        }

        const categories = await this.categoriesRepository.listCategoriesByWorkspace(
            normalizedWorkspaceId,
            includeArchived,
        )
        const nestedCategory = buildCategoryHierarchy(categories).find(
            (entry) => entry.id === normalizedCategoryId,
        )

        if (!nestedCategory) {
            throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE)
        }

        return nestedCategory
    }
}

function buildCategoryHierarchy(categories: CategoryRecord[]): CategoryResponse[] {
    const categoriesByParentId = new Map<string | null, CategoryRecord[]>()

    for (const category of categories) {
        const entries = categoriesByParentId.get(category.parentId) ?? []
        entries.push(category)
        categoriesByParentId.set(category.parentId, entries)
    }

    const buildChildren = (parentId: string | null): CategoryResponse[] => {
        const entries = categoriesByParentId.get(parentId) ?? []

        return [...entries].sort(compareCategoryRecords).map((entry) => ({
            ...mapCategoryResponse(entry),
            children: buildChildren(entry.id),
        }))
    }

    return buildChildren(null)
}

function compareCategoryRecords(left: CategoryRecord, right: CategoryRecord): number {
    if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder
    }

    const nameComparison = left.name.localeCompare(right.name)

    if (nameComparison !== 0) {
        return nameComparison
    }

    return left.id.localeCompare(right.id)
}

function mapCategoryResponse(category: CategoryRecord): Omit<CategoryResponse, 'children'> {
    return {
        id: category.id,
        name: category.name,
        system_key: category.systemKey,
        icon: category.icon,
        parent_id: category.parentId,
        sort_order: category.sortOrder,
    }
}

function normalizeRequiredValue(value: string, fieldName: string): string {
    const normalizedValue = value.trim()

    if (normalizedValue.length === 0) {
        throw new BadRequestException(`${fieldName} is required`)
    }

    return normalizedValue
}
