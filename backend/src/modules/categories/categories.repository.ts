import { Injectable } from '@nestjs/common'
import { Category } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'

export type CategoryRecord = Pick<
    Category,
    'id' | 'parentId' | 'name' | 'systemKey' | 'icon' | 'sortOrder' | 'deletedAt'
>

@Injectable()
export class CategoriesRepository {
    constructor(private readonly prisma: PrismaService) {}

    async listCategoriesByWorkspace(
        workspaceId: string,
        includeArchived = false,
    ): Promise<CategoryRecord[]> {
        return this.prisma.category.findMany({
            where: {
                workspaceId,
                ...(includeArchived ? {} : { deletedAt: null }),
            },
            select: {
                id: true,
                parentId: true,
                name: true,
                systemKey: true,
                icon: true,
                sortOrder: true,
                deletedAt: true,
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        })
    }

    async findCategoryById(
        workspaceId: string,
        categoryId: string,
        includeArchived = false,
    ): Promise<CategoryRecord | null> {
        return this.prisma.category.findFirst({
            where: {
                workspaceId,
                id: categoryId,
                ...(includeArchived ? {} : { deletedAt: null }),
            },
            select: {
                id: true,
                parentId: true,
                name: true,
                systemKey: true,
                icon: true,
                sortOrder: true,
                deletedAt: true,
            },
        })
    }
}
