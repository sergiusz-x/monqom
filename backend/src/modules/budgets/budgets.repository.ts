import { Injectable } from '@nestjs/common'
import { Budget, Category, Prisma } from '@prisma/client'
import { AuditService } from '../../shared/audit/audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../shared/audit/audit.types'
import { PrismaService } from '../../shared/database/prisma.service'

export interface BudgetCategoryRecord extends Pick<Category, 'id' | 'parentId'> {}
export interface BudgetProgressCategoryRecord extends Pick<
    Category,
    'id' | 'parentId' | 'name' | 'sortOrder'
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
        return prisma.budget.findMany({
            where: {
                workspaceId,
                year,
                month,
            },
            orderBy: [{ categoryId: 'asc' }, { id: 'asc' }],
        })
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
