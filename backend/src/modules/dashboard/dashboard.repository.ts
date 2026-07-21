import { Injectable } from '@nestjs/common'
import { Category, Prisma } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'

export interface CategorySpendRecord {
    categoryId: string
    amount: number
}

export interface MonthlySpendRecord {
    month: string
    amount: number
}

export interface DashboardCategoryRecord extends Pick<
    Category,
    'id' | 'name' | 'color' | 'systemKey'
> {}

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
                baseAmount: true,
            },
        })

        return result._sum.baseAmount ?? 0
    }

    async listMonthlySpendForRange(
        workspaceId: string,
        startDate: Date,
        endDateExclusive: Date,
        prisma: DashboardPersistenceClient = this.prisma,
    ): Promise<MonthlySpendRecord[]> {
        const rows = await prisma.$queryRaw<Array<{ month: string; amount: bigint | number }>>(
            Prisma.sql`
                SELECT
                    TO_CHAR(DATE_TRUNC('month', "date"), 'YYYY-MM') AS "month",
                    COALESCE(SUM("base_amount"), 0)::BIGINT AS "amount"
                FROM "transactions"
                WHERE "workspace_id" = ${workspaceId}
                    AND "deleted_at" IS NULL
                    AND "type" = 'expense'
                    AND "date" >= ${startDate}
                    AND "date" < ${endDateExclusive}
                GROUP BY DATE_TRUNC('month', "date")
                ORDER BY DATE_TRUNC('month', "date") ASC
            `,
        )

        return rows.map((row) => ({
            month: row.month,
            amount: Number(row.amount),
        }))
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
                baseAmount: true,
            },
        })

        return rows.map((row) => ({
            categoryId: row.categoryId,
            amount: row._sum.baseAmount ?? 0,
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
                systemKey: true,
            },
        })
    }
}
