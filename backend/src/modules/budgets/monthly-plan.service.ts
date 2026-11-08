import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../shared/database/prisma.service'
import { WorkspaceService } from '../workspace/workspace.service'
import { AuditService } from '../../shared/audit/audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../shared/audit/audit.types'
import { parseYearMonth } from '../../shared/utils/validation'
import { BudgetsRepository } from './budgets.repository'
import { calculateBudgetProgress } from './budget-progress.calculator'
import { plannedBudgetTotal, remainingGoalCommitment } from './monthly-plan.calculator'
import { ConfirmFundsDto, SaveGoalAllocationsDto } from './monthly-plan.dto'

@Injectable()
export class MonthlyPlanService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly workspaceService: WorkspaceService,
        private readonly budgets: BudgetsRepository,
        private readonly audit: AuditService,
    ) {}

    private parseMonth(month: string): [number, number] {
        const parsed = parseYearMonth(month)
        if (!parsed || parsed[0] < 2000 || parsed[0] > 2100)
            throw new BadRequestException('Invalid month')
        return parsed
    }

    async get(workspaceId: string, month: string) {
        const [year, monthNumber] = this.parseMonth(month)
        const plan = await this.prisma.monthlyPlan.findUnique({
            where: { workspaceId_month: { workspaceId, month } },
            include: {
                goalAllocations: {
                    include: {
                        goal: {
                            select: { id: true, name: true, currency: true, archivedAt: true },
                        },
                    },
                },
            },
        })
        const rule = await this.prisma.monthlyPlanIncomeRule.findFirst({
            where: { workspaceId, effectiveMonth: { lte: month } },
            orderBy: { effectiveMonth: 'desc' },
        })
        if (!plan && !rule) return null
        const current = plan ?? {
            funds: 0,
            incomeMode: 'transactions',
            incomeCategoryIds: rule!.categoryIds,
            incomePlanned: true,
            currency: rule!.currency,
            goalAllocations: [],
            confirmedAt: rule!.updatedAt,
            revision: 0,
        }
        const useRule = Boolean(
            rule && (!plan || !plan.incomePlanned || plan.incomeMode === 'transactions'),
        )
        const incomeMode = useRule ? 'transactions' : current.incomeMode
        const incomeCategoryIds = useRule ? rule!.categoryIds : current.incomeCategoryIds
        const start = new Date(Date.UTC(year, monthNumber - 1, 1))
        const end = new Date(Date.UTC(year, monthNumber, 1))
        const [workspace, categories, budgets, spending, operations] = await Promise.all([
            this.workspaceService.getWorkspaceById(workspaceId),
            this.budgets.listCategoriesForProgress(workspaceId),
            this.budgets.listBudgetsByMonth(workspaceId, year, monthNumber),
            this.budgets.listTransactionSpendByCategory(workspaceId, start, end),
            this.prisma.goalOperation.groupBy({
                by: ['goalId', 'type'],
                where: {
                    workspaceId,
                    date: { gte: start, lt: end },
                    goalId: {
                        in: current.goalAllocations.flatMap((item) =>
                            item.goalId ? [item.goalId] : [],
                        ),
                    },
                },
                _sum: { amount: true },
            }),
        ])
        const progress = calculateBudgetProgress({
            categories,
            budgets: budgets.map((budget) => ({ ...budget, amount: budget.baseAmount })),
            spending,
        })
        const expenseCommitments = plannedBudgetTotal(progress, categories)
        let income = current.funds
        if (incomeMode === 'transactions') {
            const selected = new Set(incomeCategoryIds)
            if (selected.size) {
                let changed = true
                while (changed) {
                    changed = false
                    for (const category of categories) {
                        if (
                            category.parentId &&
                            selected.has(category.parentId) &&
                            !selected.has(category.id)
                        ) {
                            selected.add(category.id)
                            changed = true
                        }
                    }
                }
            }
            const total = await this.prisma.transaction.aggregate({
                where: {
                    workspaceId,
                    type: 'income',
                    deletedAt: null,
                    date: { gte: start, lt: end },
                    ...(selected.size ? { categoryId: { in: [...selected] } } : {}),
                },
                _sum: { baseAmount: true },
            })
            income = total._sum.baseAmount ?? 0
        }
        const allocations = current.goalAllocations.map((allocation) => {
            const deposited =
                operations.find(
                    (operation) =>
                        operation.goalId === allocation.goalId && operation.type === 'deposit',
                )?._sum.amount ?? 0
            const withdrawn =
                operations.find(
                    (operation) =>
                        operation.goalId === allocation.goalId && operation.type === 'withdrawal',
                )?._sum.amount ?? 0
            return {
                id: allocation.id,
                goal_id: allocation.goalId,
                name: allocation.goal?.name ?? allocation.goalName,
                currency: allocation.goal?.currency ?? current.currency,
                archived: !allocation.goal || Boolean(allocation.goal.archivedAt),
                amount_cents: allocation.amount,
                deposited_cents: deposited,
                withdrawn_cents: withdrawn,
                remaining_cents: allocation.goalId
                    ? remainingGoalCommitment(allocation.amount, deposited)
                    : 0,
            }
        })
        const goalPlanned = allocations.reduce(
            (sum, allocation) => sum + allocation.amount_cents,
            0,
        )
        const stale =
            workspace.baseCurrency !== current.currency ||
            (useRule && workspace.baseCurrency !== rule!.currency) ||
            allocations.some((allocation) => allocation.currency !== current.currency)
        return {
            month,
            currency: current.currency,
            funds_cents: income,
            manual_funds_cents: current.funds,
            income_mode: incomeMode,
            category_ids: incomeCategoryIds,
            income_planned: current.incomePlanned || useRule,
            confirmed_at: current.confirmedAt,
            revision: current.revision,
            stale,
            expense_commitments_cents: expenseCommitments.amount,
            goal_commitments_cents: goalPlanned,
            unallocated_cents:
                stale || !(current.incomePlanned || useRule)
                    ? null
                    : income - expenseCommitments.amount - goalPlanned,
            overlaps: expenseCommitments.overlaps,
            allocations,
        }
    }

    async confirmFunds(workspaceId: string, userId: string, month: string, body: ConfirmFundsDto) {
        this.parseMonth(month)
        await this.prisma.$transaction(
            async (tx) => {
                const workspace = await this.workspaceService.getWorkspaceById(workspaceId, tx)
                const confirmedAt = new Date()
                const existing = await tx.monthlyPlan.findUnique({
                    where: { workspaceId_month: { workspaceId, month } },
                })
                if (existing && existing.currency !== workspace.baseCurrency)
                    throw new BadRequestException('Plan currency does not match workspace currency')
                const mode = body.income_mode ?? 'manual'
                const categoryIds = mode === 'transactions' ? (body.category_ids ?? []) : []
                if (categoryIds.length) {
                    const count = await tx.category.count({
                        where: { workspaceId, type: 'income', id: { in: categoryIds } },
                    })
                    if (count !== categoryIds.length)
                        throw new BadRequestException('Invalid income categories')
                }
                if (
                    (existing && existing.revision !== body.expected_revision) ||
                    (!existing && body.expected_revision !== undefined)
                ) {
                    throw new ConflictException('Monthly plan has changed; reload and try again')
                }
                const plan = existing
                    ? await tx.monthlyPlan.update({
                          where: {
                              workspaceId_month: { workspaceId, month },
                              revision: body.expected_revision,
                          },
                          data: {
                              currency: workspace.baseCurrency,
                              funds: body.funds_cents,
                              incomeMode: mode,
                              incomeCategoryIds: categoryIds,
                              incomePlanned: true,
                              confirmedAt,
                              revision: { increment: 1 },
                          },
                      })
                    : await tx.monthlyPlan.create({
                          data: {
                              workspaceId,
                              month,
                              currency: workspace.baseCurrency,
                              funds: body.funds_cents,
                              incomeMode: mode,
                              incomeCategoryIds: categoryIds,
                              incomePlanned: true,
                              confirmedAt,
                          },
                      })
                if (mode === 'transactions') {
                    await tx.monthlyPlanIncomeRule.upsert({
                        where: {
                            workspaceId_effectiveMonth: { workspaceId, effectiveMonth: month },
                        },
                        create: {
                            workspaceId,
                            effectiveMonth: month,
                            currency: workspace.baseCurrency,
                            categoryIds,
                        },
                        update: { currency: workspace.baseCurrency, categoryIds },
                    })
                }
                await this.audit.record(
                    {
                        action: AUDIT_ACTIONS.MONTHLY_PLAN_FUNDS_CONFIRMED,
                        workspaceId,
                        userId,
                        entityType: AUDIT_ENTITY_TYPES.MONTHLY_PLAN,
                        entityId: plan.id,
                        metadata: { month, currency: plan.currency, revision: plan.revision },
                    },
                    tx,
                )
            },
            { isolationLevel: 'Serializable' },
        )
        return this.get(workspaceId, month)
    }

    async saveGoals(
        workspaceId: string,
        userId: string,
        month: string,
        body: SaveGoalAllocationsDto,
    ) {
        this.parseMonth(month)
        await this.prisma.$transaction(
            async (tx) => {
                let plan = await tx.monthlyPlan.findUnique({
                    where: { workspaceId_month: { workspaceId, month } },
                })
                if (plan && body.expected_revision === 0)
                    throw new ConflictException('Monthly plan has changed; reload and try again')
                if (!plan && body.expected_revision === 0) {
                    const rule = await tx.monthlyPlanIncomeRule.findFirst({
                        where: { workspaceId, effectiveMonth: { lte: month } },
                        orderBy: { effectiveMonth: 'desc' },
                    })
                    if (!rule) throw new NotFoundException('Monthly plan not found')
                    const workspace = await this.workspaceService.getWorkspaceById(workspaceId, tx)
                    if (workspace.baseCurrency !== rule.currency)
                        throw new BadRequestException(
                            'Plan currency does not match workspace currency',
                        )
                    plan = await tx.monthlyPlan.create({
                        data: {
                            workspaceId,
                            month,
                            currency: rule.currency,
                            funds: 0,
                            incomeMode: 'transactions',
                            incomeCategoryIds: rule.categoryIds,
                            incomePlanned: true,
                            confirmedAt: new Date(),
                        },
                    })
                }
                if (!plan) throw new NotFoundException('Monthly plan not found')
                const expectedRevision = body.expected_revision === 0 ? 1 : body.expected_revision
                if (plan.revision !== expectedRevision)
                    throw new ConflictException('Monthly plan has changed; reload and try again')
                const ids = body.allocations.map((allocation) => allocation.goal_id)
                const goals = await tx.goal.findMany({
                    where: { workspaceId, id: { in: ids }, currency: plan.currency },
                    select: { id: true, name: true },
                })
                if (goals.length !== ids.length)
                    throw new BadRequestException('Invalid goal or currency')
                const updated = await tx.monthlyPlan.updateMany({
                    where: { workspaceId, id: plan.id, revision: expectedRevision },
                    data: { revision: { increment: 1 } },
                })
                if (updated.count !== 1)
                    throw new ConflictException('Monthly plan has changed; reload and try again')
                await tx.monthlyGoalAllocation.deleteMany({
                    where: { workspaceId, planId: plan.id, goalId: { not: null } },
                })
                if (body.allocations.length)
                    await tx.monthlyGoalAllocation.createMany({
                        data: body.allocations.map((allocation) => ({
                            workspaceId,
                            planId: plan.id,
                            goalId: allocation.goal_id,
                            goalName: goals.find((goal) => goal.id === allocation.goal_id)!.name,
                            amount: allocation.amount_cents,
                        })),
                    })
                await this.audit.record(
                    {
                        action: AUDIT_ACTIONS.MONTHLY_PLAN_GOALS_UPDATED,
                        workspaceId,
                        userId,
                        entityType: AUDIT_ENTITY_TYPES.MONTHLY_PLAN,
                        entityId: plan.id,
                        metadata: {
                            month,
                            revision: expectedRevision + 1,
                            goal_count: ids.length,
                        },
                    },
                    tx,
                )
            },
            { isolationLevel: 'Serializable' },
        )
        return this.get(workspaceId, month)
    }
}
