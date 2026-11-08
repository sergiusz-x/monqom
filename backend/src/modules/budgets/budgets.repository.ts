import { Injectable } from '@nestjs/common'
import { Budget, Category, Prisma } from '@prisma/client'
import { AuditService } from '../../shared/audit/audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../shared/audit/audit.types'
import { PrismaService } from '../../shared/database/prisma.service'
import { resolveRecurringBudgets } from './recurring-budget.resolver'

export interface BudgetCategoryRecord extends Pick<Category, 'id' | 'parentId'> {}
export interface BudgetProgressCategoryRecord extends Pick<
    Category,
    'id' | 'parentId' | 'name' | 'sortOrder' | 'systemKey'
> {}
export interface BudgetProgressSpendingRecord {
    categoryId: string
    amount: number
}

export interface CreateBudgetRecordInput {
    workspaceId: string
    userId: string
    categoryId: string
    amount: number
    currency: string
    baseAmount?: number
    fxRate?: number
    fxRateDate?: Date
    fxSource?: string
    year: number
    month: number
}

export interface UpdateBudgetRecordInput {
    workspaceId: string
    budgetId: string
    userId: string
    categoryId: string
    amount: number
    currency: string
    baseAmount?: number
    fxRate?: number
    fxRateDate?: Date
    fxSource?: string
    year: number
    month: number
    previousBudget: Budget
}

export interface DeleteBudgetRecordInput {
    workspaceId: string
    budgetId: string
    userId: string
    budget: Budget
}

export type BudgetsPersistenceClient = Prisma.TransactionClient | PrismaService

@Injectable()
export class BudgetsRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditService: AuditService,
    ) {}

    async listBudgetsByMonth(
        workspaceId: string,
        year: number,
        month: number,
        prisma: BudgetsPersistenceClient = this.prisma,
    ): Promise<Budget[]> {
        const selectedMonth = `${year}-${String(month).padStart(2, '0')}`
        const [monthly, versions, exclusions] = await Promise.all([
            prisma.budget.findMany({
                where: { workspaceId, year, month },
                orderBy: [{ categoryId: 'asc' }, { id: 'asc' }],
            }),
            prisma.recurringBudgetVersion.findMany({
                where: { workspaceId, effectiveMonth: { lte: selectedMonth } },
            }),
            prisma.budgetMonthExclusion.findMany({ where: { workspaceId, month: selectedMonth } }),
        ])
        const inherited = resolveRecurringBudgets(
            selectedMonth,
            versions.map((version) => ({
                categoryId: version.categoryId,
                effectiveMonth: version.effectiveMonth,
                value: version.active ? version : null,
            })),
            exclusions.map((exclusion) => ({ categoryId: exclusion.categoryId, value: null })),
        )
        const explicitCategories = new Set(monthly.map((budget) => budget.categoryId))
        const recurring = inherited
            .filter((item) => !explicitCategories.has(item.categoryId))
            .map(({ value }) => ({
                id: `recurring:${value.id}:${selectedMonth}`,
                workspaceId,
                categoryId: value.categoryId,
                amount: value.amount,
                currency: value.currency,
                baseAmount: value.baseAmount,
                fxRate: new Prisma.Decimal(1),
                fxRateDate: new Date(Date.UTC(year, month - 1, 1)),
                fxSource: 'recurring',
                year,
                month,
                createdAt: value.createdAt,
                updatedAt: value.updatedAt,
            }))
        return [...monthly, ...recurring]
    }

    async findBudgetById(
        workspaceId: string,
        budgetId: string,
        prisma: BudgetsPersistenceClient = this.prisma,
    ): Promise<Budget | null> {
        return prisma.budget.findFirst({
            where: {
                workspaceId,
                id: budgetId,
            },
        })
    }

    async findBudgetByCategoryAndMonth(
        workspaceId: string,
        categoryId: string,
        year: number,
        month: number,
        prisma: BudgetsPersistenceClient = this.prisma,
    ): Promise<Budget | null> {
        return prisma.budget.findFirst({
            where: {
                workspaceId,
                categoryId,
                year,
                month,
            },
        })
    }

    async findActiveCategoryById(
        workspaceId: string,
        categoryId: string,
        prisma: BudgetsPersistenceClient = this.prisma,
    ): Promise<BudgetCategoryRecord | null> {
        return prisma.category.findFirst({
            where: {
                workspaceId,
                id: categoryId,
                deletedAt: null,
            },
            select: {
                id: true,
                parentId: true,
            },
        })
    }

    async listCategoriesForProgress(
        workspaceId: string,
        prisma: BudgetsPersistenceClient = this.prisma,
    ): Promise<BudgetProgressCategoryRecord[]> {
        return prisma.category.findMany({
            where: {
                workspaceId,
            },
            select: {
                id: true,
                parentId: true,
                name: true,
                systemKey: true,
                sortOrder: true,
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }, { id: 'asc' }],
        })
    }

    async listTransactionSpendByCategory(
        workspaceId: string,
        startDate: Date,
        endDateExclusive: Date,
        prisma: BudgetsPersistenceClient = this.prisma,
    ): Promise<BudgetProgressSpendingRecord[]> {
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

        return rows.flatMap((row) =>
            row.categoryId === null
                ? []
                : [
                      {
                          categoryId: row.categoryId,
                          amount: row._sum.baseAmount ?? 0,
                      },
                  ],
        )
    }

    async saveRecurringVersion(
        input: {
            workspaceId: string
            categoryId: string
            userId: string
            effectiveMonth: string
            active: boolean
            amount: number
            currency: string
            baseAmount: number
        },
        prisma: BudgetsPersistenceClient = this.prisma,
    ) {
        const key = {
            workspaceId: input.workspaceId,
            categoryId: input.categoryId,
            effectiveMonth: input.effectiveMonth,
        }
        const previous = await prisma.recurringBudgetVersion.findUnique({
            where: { workspaceId_categoryId_effectiveMonth: key },
        })
        const current = await prisma.recurringBudgetVersion.upsert({
            where: { workspaceId_categoryId_effectiveMonth: key },
            create: {
                ...key,
                active: input.active,
                amount: input.amount,
                currency: input.currency,
                baseAmount: input.baseAmount,
            },
            update: {
                active: input.active,
                amount: input.amount,
                currency: input.currency,
                baseAmount: input.baseAmount,
            },
        })
        await this.auditService.record(
            {
                action: previous ? AUDIT_ACTIONS.BUDGET_UPDATED : AUDIT_ACTIONS.BUDGET_CREATED,
                workspaceId: input.workspaceId,
                userId: input.userId,
                entityType: AUDIT_ENTITY_TYPES.BUDGET,
                entityId: current.id,
                metadata: {
                    category_id: input.categoryId,
                    effective_month: input.effectiveMonth,
                    active: input.active,
                    amount: input.amount,
                    currency: input.currency,
                    previous_amount: previous?.amount ?? null,
                    previous_active: previous?.active ?? null,
                },
            },
            prisma,
        )
        return current
    }

    async clearLaterRecurringVersions(
        input: { workspaceId: string; categoryId: string; userId: string; effectiveMonth: string },
        prisma: BudgetsPersistenceClient = this.prisma,
    ) {
        const where = {
            workspaceId: input.workspaceId,
            categoryId: input.categoryId,
            effectiveMonth: { gt: input.effectiveMonth },
        }
        const later = await prisma.recurringBudgetVersion.findMany({ where })
        await prisma.recurringBudgetVersion.deleteMany({ where })
        for (const version of later) {
            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.BUDGET_DELETED,
                    workspaceId: input.workspaceId,
                    userId: input.userId,
                    entityType: AUDIT_ENTITY_TYPES.BUDGET,
                    entityId: version.id,
                    metadata: {
                        category_id: version.categoryId,
                        effective_month: version.effectiveMonth,
                        amount: version.amount,
                        currency: version.currency,
                        active: version.active,
                    },
                },
                prisma,
            )
        }
    }

    async excludeRecurringMonth(
        input: { workspaceId: string; categoryId: string; userId: string; month: string },
        prisma: BudgetsPersistenceClient = this.prisma,
    ) {
        const key = {
            workspaceId: input.workspaceId,
            categoryId: input.categoryId,
            month: input.month,
        }
        const exclusion = await prisma.budgetMonthExclusion.upsert({
            where: { workspaceId_categoryId_month: key },
            create: key,
            update: {},
        })
        await this.auditService.record(
            {
                action: AUDIT_ACTIONS.BUDGET_DELETED,
                workspaceId: input.workspaceId,
                userId: input.userId,
                entityType: AUDIT_ENTITY_TYPES.BUDGET,
                entityId: exclusion.id,
                metadata: { category_id: input.categoryId, month: input.month, scope: 'month' },
            },
            prisma,
        )
    }

    async clearMonthExclusion(
        workspaceId: string,
        categoryId: string,
        month: string,
        prisma: BudgetsPersistenceClient = this.prisma,
    ) {
        await prisma.budgetMonthExclusion.deleteMany({ where: { workspaceId, categoryId, month } })
    }

    async createBudget(
        input: CreateBudgetRecordInput,
        prisma: BudgetsPersistenceClient = this.prisma,
    ): Promise<Budget> {
        const budget = await prisma.budget.create({
            data: {
                workspaceId: input.workspaceId,
                categoryId: input.categoryId,
                amount: input.amount,
                currency: input.currency,
                baseAmount: input.baseAmount ?? input.amount,
                fxRate: input.fxRate ?? 1,
                fxRateDate: input.fxRateDate ?? new Date(Date.UTC(input.year, input.month - 1, 1)),
                fxSource: input.fxSource ?? 'legacy',
                year: input.year,
                month: input.month,
            },
        })

        await this.auditService.record(
            {
                action: AUDIT_ACTIONS.BUDGET_CREATED,
                workspaceId: input.workspaceId,
                userId: input.userId,
                entityType: AUDIT_ENTITY_TYPES.BUDGET,
                entityId: budget.id,
                metadata: mapBudgetAuditMetadata(budget),
            },
            prisma,
        )

        return budget
    }

    async updateBudget(
        input: UpdateBudgetRecordInput,
        prisma: BudgetsPersistenceClient = this.prisma,
    ): Promise<Budget | null> {
        const updatedBudget = await prisma.budget.updateMany({
            where: {
                workspaceId: input.workspaceId,
                id: input.budgetId,
            },
            data: {
                categoryId: input.categoryId,
                amount: input.amount,
                currency: input.currency,
                baseAmount: input.baseAmount ?? input.amount,
                fxRate: input.fxRate ?? 1,
                fxRateDate: input.fxRateDate ?? new Date(Date.UTC(input.year, input.month - 1, 1)),
                fxSource: input.fxSource ?? 'legacy',
                year: input.year,
                month: input.month,
            },
        })

        if (updatedBudget.count === 0) {
            return null
        }

        const budget = await this.findBudgetById(input.workspaceId, input.budgetId, prisma)

        if (!budget) {
            return null
        }

        await this.auditService.record(
            {
                action: AUDIT_ACTIONS.BUDGET_UPDATED,
                workspaceId: input.workspaceId,
                userId: input.userId,
                entityType: AUDIT_ENTITY_TYPES.BUDGET,
                entityId: budget.id,
                metadata: {
                    previous: mapBudgetAuditMetadata(input.previousBudget),
                    current: mapBudgetAuditMetadata(budget),
                },
            },
            prisma,
        )

        return budget
    }

    async deleteBudget(
        input: DeleteBudgetRecordInput,
        prisma: BudgetsPersistenceClient = this.prisma,
    ): Promise<boolean> {
        const deletedBudget = await prisma.budget.deleteMany({
            where: {
                workspaceId: input.workspaceId,
                id: input.budgetId,
            },
        })

        if (deletedBudget.count === 0) {
            return false
        }

        await this.auditService.record(
            {
                action: AUDIT_ACTIONS.BUDGET_DELETED,
                workspaceId: input.workspaceId,
                userId: input.userId,
                entityType: AUDIT_ENTITY_TYPES.BUDGET,
                entityId: input.budgetId,
                metadata: mapBudgetAuditMetadata(input.budget),
            },
            prisma,
        )

        return true
    }
}

function mapBudgetAuditMetadata(budget: Budget) {
    return {
        id: budget.id,
        workspace_id: budget.workspaceId,
        category_id: budget.categoryId,
        amount: budget.amount,
        currency: budget.currency,
        year: budget.year,
        month: budget.month,
        created_at: budget.createdAt.toISOString(),
        updated_at: budget.updatedAt.toISOString(),
    }
}
