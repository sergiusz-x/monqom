import { Injectable } from '@nestjs/common'
import { Category, Prisma } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'

export interface CategorySpendRecord {
    categoryId: string
    amount: number
}

export interface DashboardCategoryRecord extends Pick<Category, 'id' | 'name' | 'color'> {}

export type DashboardPersistenceClient = Prisma.TransactionClient | PrismaService

@Injectable()
export class DashboardRepository {
    constructor(private readonly prisma: PrismaService) {}

    async getTotalSpendForRange(
        workspaceId: string,
        startDate: Date,
        endDateExclusive: Date,
        prisma: DashboardPersistenceClient = this.prisma,
    ): Promise<number> {
        const result = await prisma.transaction.aggregate({
            where: {
                workspaceId,
                deletedAt: null,
                type: 'expense',
                date: {
                    gte: startDate,
                    lt: endDateExclusive,
                },
            },
            _sum: {
                amount: true,
            },
        })

        return result._sum.amount ?? 0
    }

    async listCategorySpendForRange(
        workspaceId: string,
        startDate: Date,
        endDateExclusive: Date,
        prisma: DashboardPersistenceClient = this.prisma,
    ): Promise<CategorySpendRecord[]> {
        const rows = await prisma.transaction.groupBy({
            by: ['categoryId'],
            where: {
                workspaceId,
                deletedAt: null,
                type: 'expense',
                date: {
                    gte: startDate,
                    lt: endDateExclusive,
                },
            },
            _sum: {
                amount: true,
            },
        })

        return rows.map((row) => ({
            categoryId: row.categoryId,
            amount: row._sum.amount ?? 0,
        }))
    }

    async listCategoriesByIds(
        workspaceId: string,
        categoryIds: string[],
        prisma: DashboardPersistenceClient = this.prisma,
    ): Promise<DashboardCategoryRecord[]> {
        if (categoryIds.length === 0) {
            return []
        }

        return prisma.category.findMany({
            where: {
                workspaceId,
                id: {
                    in: categoryIds,
                },
            },
            select: {
                id: true,
                name: true,
                color: true,
            },
        })
    }
}
