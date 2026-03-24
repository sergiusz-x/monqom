import { Injectable } from '@nestjs/common'
import { Budget, Category, Prisma } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'

export interface BudgetCategoryRecord extends Pick<Category, 'id' | 'parentId'> {}

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
    constructor(private readonly prisma: PrismaService) {}

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

        await prisma.auditEvent.create({
            data: {
                action: 'BUDGET_CREATED',
                workspaceId: input.workspaceId,
                userId: input.userId,
                entityType: 'BUDGET',
                entityId: budget.id,
                metadata: mapBudgetAuditMetadata(budget),
            },
        })

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

        await prisma.auditEvent.create({
            data: {
                action: 'BUDGET_UPDATED',
                workspaceId: input.workspaceId,
                userId: input.userId,
                entityType: 'BUDGET',
                entityId: budget.id,
                metadata: {
                    previous: mapBudgetAuditMetadata(input.previousBudget),
                    current: mapBudgetAuditMetadata(budget),
                },
            },
        })

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

        await prisma.auditEvent.create({
            data: {
                action: 'BUDGET_DELETED',
                workspaceId: input.workspaceId,
                userId: input.userId,
                entityType: 'BUDGET',
                entityId: input.budgetId,
                metadata: mapBudgetAuditMetadata(input.budget),
            },
        })

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
