import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'
import { AuditService } from '../../shared/audit/audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../shared/audit/audit.types'

const NOT_FOUND = 'Category not found'

export interface CategoryResponse {
    id: string
    name: string
    system_key: string | null
    type: 'expense' | 'income'
    icon: string | null
    parent_id: string | null
    sort_order: number
    is_archived: boolean
    archived_at: Date | null
    children: CategoryResponse[]
}

@Injectable()
export class CategoriesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) {}

    async listCategories(
        input: { includeArchived?: boolean; type?: 'expense' | 'income' },
        workspaceId: string,
    ): Promise<CategoryResponse[]> {
        return this.hierarchy(workspaceId.trim(), input.includeArchived ?? false, input.type)
    }

    async getCategoryById(
        id: string,
        input: { includeArchived?: boolean; type?: 'expense' | 'income' },
        workspaceId: string,
    ): Promise<CategoryResponse> {
        const category = findCategory(
            await this.hierarchy(workspaceId.trim(), input.includeArchived ?? false, input.type),
            id.trim(),
        )
        if (!category) throw new NotFoundException(NOT_FOUND)
        return category
    }

    async createCategory(
        input: {
            name: string
            icon?: string | null
            parent_id?: string | null
            type?: 'expense' | 'income'
        },
        workspaceId: string,
        userId: string,
    ): Promise<CategoryResponse> {
        const value = this.validate(input)
        const type = input.type ?? 'expense'
        try {
            return await this.prisma.$transaction(async (tx) => {
                const parentId = value.parentId
                if (parentId) await this.activeParent(parentId, workspaceId, undefined, type, tx)
                await this.assertUnique(value.name, parentId, workspaceId, undefined, type, tx)
                const sortOrder = await this.nextOrder(parentId, workspaceId, type, tx)
                const category = await tx.category.create({
                    data: {
                        id: `cat_${randomUUID().replace(/-/g, '')}`,
                        workspaceId,
                        parentId,
                        name: value.name,
                        type,
                        icon: value.icon,
                        sortOrder,
                    },
                })
                await this.record(AUDIT_ACTIONS.CATEGORY_CREATED, category, userId, tx)
                return this.map(category, [])
            })
        } catch (error) {
            throw mapUniqueCategoryError(error)
        }
    }

    async updateCategory(
        id: string,
        input: {
            name: string
            icon?: string | null
            parent_id?: string | null
            type?: 'expense' | 'income'
        },
        workspaceId: string,
        userId: string,
    ): Promise<CategoryResponse> {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.category.findFirst({
                    where: { id, workspaceId, deletedAt: null },
                    include: { children: true },
                })
                if (!existing) throw new NotFoundException(NOT_FOUND)
                const value = this.validate(input)
                if (existing.children.length && value.parentId !== null)
                    throw new BadRequestException(
                        'A category with children cannot become a subcategory',
                    )
                if (value.parentId)
                    await this.activeParent(
                        value.parentId,
                        workspaceId,
                        id,
                        existing.type as 'expense' | 'income',
                        tx,
                    )
                await this.assertUnique(
                    value.name,
                    value.parentId,
                    workspaceId,
                    id,
                    existing.type as 'expense' | 'income',
                    tx,
                )
                const category = await tx.category.update({
                    where: { id },
                    data: {
                        name: value.name,
                        icon: value.icon,
                        parentId: value.parentId,
                        ...(value.name !== existing.name ? { systemKey: null } : {}),
                    },
                })
                await this.record(AUDIT_ACTIONS.CATEGORY_UPDATED, category, userId, tx)
                return this.map(category, [])
            })
        } catch (error) {
            throw mapUniqueCategoryError(error)
        }
    }

    async reorderCategories(
        items: Array<{ id: string }>,
        workspaceId: string,
        userId?: string,
    ): Promise<CategoryResponse[]> {
        const ids = items.map((item) => item.id.trim()).filter(Boolean)
        if (!ids.length || new Set(ids).size !== ids.length)
            throw new BadRequestException('Category ids must be unique')
        const categories = await this.prisma.$transaction(async (tx) => {
            const found = await tx.category.findMany({
                where: { workspaceId, id: { in: ids }, deletedAt: null },
            })
            if (found.length !== ids.length || new Set(found.map((c) => c.parentId)).size !== 1)
                throw new BadRequestException('Categories must be active siblings')
            for (const [index, id] of ids.entries())
                await tx.category.update({ where: { id }, data: { sortOrder: index + 1 } })
            if (userId)
                await this.audit.record(
                    {
                        action: AUDIT_ACTIONS.CATEGORY_REORDERED,
                        workspaceId,
                        userId,
                        entityType: AUDIT_ENTITY_TYPES.WORKSPACE,
                        entityId: workspaceId,
                        metadata: { category_ids: ids },
                    },
                    tx,
                )
            return found
        })
        return this.hierarchy(workspaceId, false, categories[0].type as 'expense' | 'income')
    }

    async archiveCategory(
        id: string,
        workspaceId: string,
        userId: string,
    ): Promise<CategoryResponse> {
        return this.prisma.$transaction(async (tx) => {
            const category = await tx.category.findFirst({
                where: { id, workspaceId, deletedAt: null },
            })
            if (!category) throw new NotFoundException(NOT_FOUND)
            const at = new Date()
            await tx.category.updateMany({
                where: { workspaceId, OR: [{ id }, { parentId: id }] },
                data: { deletedAt: at },
            })
            const archived = { ...category, deletedAt: at }
            await this.record(AUDIT_ACTIONS.CATEGORY_ARCHIVED, archived, userId, tx)
            return this.map(archived, [])
        })
    }

    async restoreCategory(
        id: string,
        workspaceId: string,
        userId: string,
    ): Promise<CategoryResponse> {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const category = await tx.category.findFirst({
                    where: { id, workspaceId, deletedAt: { not: null } },
                })
                if (!category) throw new NotFoundException(NOT_FOUND)
                if (category.parentId)
                    await this.activeParent(
                        category.parentId,
                        workspaceId,
                        undefined,
                        undefined,
                        tx,
                    )
                await this.assertUnique(
                    category.name,
                    category.parentId,
                    workspaceId,
                    category.id,
                    category.type as 'expense' | 'income',
                    tx,
                )
                await tx.category.updateMany({
                    where: { workspaceId, OR: [{ id }, { parentId: id }] },
                    data: { deletedAt: null },
                })
                const restored = { ...category, deletedAt: null }
                await this.record(AUDIT_ACTIONS.CATEGORY_RESTORED, restored, userId, tx)
                return this.map(restored, [])
            })
        } catch (error) {
            throw mapUniqueCategoryError(error)
        }
    }

    private async hierarchy(
        workspaceId: string,
        includeArchived: boolean,
        type?: 'expense' | 'income',
        prisma: Prisma.TransactionClient | PrismaService = this.prisma,
    ): Promise<CategoryResponse[]> {
        const rows = await prisma.category.findMany({
            where: {
                workspaceId,
                ...(type ? { type } : {}),
                ...(includeArchived ? {} : { deletedAt: null }),
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        })
        const children = new Map<string | null, typeof rows>()
        for (const row of rows)
            children.set(row.parentId, [...(children.get(row.parentId) ?? []), row])
        const build = (parentId: string | null): CategoryResponse[] =>
            [...(children.get(parentId) ?? [])]
                .sort(
                    (left, right) =>
                        left.sortOrder - right.sortOrder ||
                        left.name.localeCompare(right.name) ||
                        left.id.localeCompare(right.id),
                )
                .map((row) => this.map(row, build(row.id)))
        return build(null)
    }
    private map(
        row: {
            id: string
            name: string
            systemKey: string | null
            type: string
            icon: string | null
            parentId: string | null
            sortOrder: number
            deletedAt: Date | null
        },
        children: CategoryResponse[],
    ): CategoryResponse {
        return {
            id: row.id,
            name: row.name,
            system_key: row.systemKey,
            type: row.type as 'expense' | 'income',
            icon: row.icon,
            parent_id: row.parentId,
            sort_order: row.sortOrder,
            is_archived: row.deletedAt !== null,
            archived_at: row.deletedAt,
            children,
        }
    }
    private validate(input: { name: string; icon?: string | null; parent_id?: string | null }) {
        const name = input.name?.trim()
        if (!name || name.length > 100)
            throw new BadRequestException('Name must contain 1 to 100 characters')
        const icon = input.icon?.trim() || null
        if (icon && icon.length > 32)
            throw new BadRequestException('Icon must be 32 characters or fewer')
        return { name, icon, parentId: input.parent_id?.trim() || null }
    }
    private async activeParent(
        id: string,
        workspaceId: string,
        exceptId?: string,
        type?: 'expense' | 'income',
        prisma: Prisma.TransactionClient | PrismaService = this.prisma,
    ) {
        const parent = await prisma.category.findFirst({
            where: { id, workspaceId, deletedAt: null, ...(type ? { type } : {}) },
        })
        if (!parent || parent.parentId || parent.id === exceptId)
            throw new BadRequestException('Parent category must be an active top-level category')
    }
    private async assertUnique(
        name: string,
        parentId: string | null,
        workspaceId: string,
        exceptId?: string,
        type?: 'expense' | 'income',
        prisma: Prisma.TransactionClient | PrismaService = this.prisma,
    ) {
        const duplicate = await prisma.category.findFirst({
            where: {
                workspaceId,
                parentId,
                deletedAt: null,
                name: { equals: name, mode: 'insensitive' },
                ...(type ? { type } : {}),
                ...(exceptId ? { id: { not: exceptId } } : {}),
            },
        })
        if (duplicate)
            throw new ConflictException(
                'An active category with this name already exists in this group',
            )
    }
    private async nextOrder(
        parentId: string | null,
        workspaceId: string,
        type?: 'expense' | 'income',
        prisma: Prisma.TransactionClient | PrismaService = this.prisma,
    ) {
        const last = await prisma.category.aggregate({
            where: { workspaceId, parentId, deletedAt: null, ...(type ? { type } : {}) },
            _max: { sortOrder: true },
        })
        return (last._max.sortOrder ?? 0) + 1
    }
    private async record(
        action: (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS],
        category: {
            id: string
            workspaceId: string
            name: string
            parentId: string | null
            deletedAt: Date | null
        },
        userId: string,
        prisma: Prisma.TransactionClient | PrismaService = this.prisma,
    ) {
        await this.audit.record(
            {
                action,
                workspaceId: category.workspaceId,
                userId,
                entityType: AUDIT_ENTITY_TYPES.CATEGORY,
                entityId: category.id,
                metadata: {
                    name: category.name,
                    parent_id: category.parentId,
                    archived_at: category.deletedAt?.toISOString() ?? null,
                },
            },
            prisma,
        )
    }
}

function mapUniqueCategoryError(error: unknown): unknown {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        return new ConflictException(
            'An active category with this name already exists in this group',
        )
    return error
}

function findCategory(
    categories: CategoryResponse[],
    categoryId: string,
): CategoryResponse | undefined {
    for (const category of categories) {
        if (category.id === categoryId) return category

        const child = findCategory(category.children, categoryId)
        if (child) return child
    }

    return undefined
}
