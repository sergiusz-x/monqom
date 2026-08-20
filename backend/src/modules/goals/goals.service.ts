import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import { Goal, GoalOperation, Prisma } from '@prisma/client'
import { AuditService } from '../../shared/audit/audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../shared/audit/audit.types'
import { PrismaService } from '../../shared/database/prisma.service'
import { WorkspaceService } from '../workspace/workspace.service'
import { CreateGoalDto, GoalOperationDto, UpdateGoalDto } from './goals.dto'
import {
    addUtcMonthsClamped,
    calculateGoalPlan,
    dateInTimeZone,
    startOfUtcMonth,
} from './goal-plan.calculator'

const GOAL_NOT_FOUND = 'Goal not found'
const GOAL_ARCHIVED = 'Archived goals are read-only'
const NEGATIVE_BALANCE = 'Goal balance cannot be negative'
const DATE_RANGE = 'Target date must be between 1 and 120 months from today'

type GoalWithOperations = Prisma.GoalGetPayload<{ include: { operations: true } }>

@Injectable()
export class GoalsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly workspaceService: WorkspaceService,
        private readonly auditService: AuditService,
    ) {}

    async list(workspaceId: string, includeArchived = false) {
        const context = await this.context(workspaceId)
        const goals = await this.prisma.goal.findMany({
            where: { workspaceId, ...(includeArchived ? {} : { archivedAt: null }) },
            include: { operations: true },
            orderBy: [{ targetDate: 'asc' }, { createdAt: 'asc' }],
        })
        return goals.map((goal) => mapGoal(goal, context.today, false))
    }

    async get(workspaceId: string, goalId: string) {
        const context = await this.context(workspaceId)
        const goal = await this.findGoal(workspaceId, goalId, this.prisma)
        return mapGoal(goal, context.today, true)
    }

    async create(workspaceId: string, userId: string, body: CreateGoalDto) {
        const context = await this.context(workspaceId)
        const targetDate = parseTargetDate(body.target_date, context.today)
        const initialAmount = toCents(body.initial_amount ?? 0)
        const goal = await this.prisma.$transaction(async (tx) => {
            const created = await tx.goal.create({
                data: {
                    workspaceId,
                    name: normalizeName(body.name),
                    targetAmount: toCents(body.target_amount),
                    initialAmount,
                    currency: context.currency,
                    targetDate,
                    planStartMonth: startOfUtcMonth(
                        body.include_current_month
                            ? context.today
                            : addUtcMonthsClamped(context.today, 1),
                    ),
                },
                include: { operations: true },
            })
            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.GOAL_CREATED,
                    workspaceId,
                    userId,
                    entityType: AUDIT_ENTITY_TYPES.GOAL,
                    entityId: created.id,
                    metadata: goalAudit(created),
                },
                tx,
            )
            return created
        })
        return mapGoal(goal, context.today, true)
    }

    async update(workspaceId: string, userId: string, goalId: string, body: UpdateGoalDto) {
        if (Object.keys(body).length === 0)
            throw new BadRequestException('At least one field is required')
        const context = await this.context(workspaceId)
        const goal = await this.prisma.$transaction(async (tx) => {
            const previous = await this.findGoal(workspaceId, goalId, tx)
            assertMutable(previous)
            const initialAmount =
                body.initial_amount === undefined
                    ? previous.initialAmount
                    : toCents(body.initial_amount)
            if (balanceCents(previous.operations, initialAmount) < 0) {
                throw new ConflictException(NEGATIVE_BALANCE)
            }
            const updated = await tx.goal.update({
                where: { workspaceId_id: { workspaceId, id: goalId } },
                data: {
                    ...(body.name === undefined ? {} : { name: normalizeName(body.name) }),
                    ...(body.target_amount === undefined
                        ? {}
                        : { targetAmount: toCents(body.target_amount) }),
                    ...(body.initial_amount === undefined ? {} : { initialAmount }),
                    ...(body.target_date === undefined
                        ? {}
                        : { targetDate: parseTargetDate(body.target_date, context.today) }),
                },
                include: { operations: true },
            })
            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.GOAL_UPDATED,
                    workspaceId,
                    userId,
                    entityType: AUDIT_ENTITY_TYPES.GOAL,
                    entityId: goalId,
                    metadata: { previous: goalAudit(previous), current: goalAudit(updated) },
                },
                tx,
            )
            return updated
        })
        return mapGoal(goal, context.today, true)
    }

    async setArchived(workspaceId: string, userId: string, goalId: string, archived: boolean) {
        const context = await this.context(workspaceId)
        const goal = await this.prisma.$transaction(async (tx) => {
            const previous = await this.findGoal(workspaceId, goalId, tx)
            if (Boolean(previous.archivedAt) === archived) return previous
            const updated = await tx.goal.update({
                where: { workspaceId_id: { workspaceId, id: goalId } },
                data: { archivedAt: archived ? new Date() : null },
                include: { operations: true },
            })
            await this.auditService.record(
                {
                    action: archived ? AUDIT_ACTIONS.GOAL_ARCHIVED : AUDIT_ACTIONS.GOAL_RESTORED,
                    workspaceId,
                    userId,
                    entityType: AUDIT_ENTITY_TYPES.GOAL,
                    entityId: goalId,
                    metadata: goalAudit(updated),
                },
                tx,
            )
            return updated
        })
        return mapGoal(goal, context.today, true)
    }

    async delete(workspaceId: string, userId: string, goalId: string): Promise<void> {
        await this.prisma.$transaction(async (tx) => {
            const goal = await this.findGoal(workspaceId, goalId, tx)
            await tx.goal.delete({ where: { workspaceId_id: { workspaceId, id: goalId } } })
            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.GOAL_DELETED,
                    workspaceId,
                    userId,
                    entityType: AUDIT_ENTITY_TYPES.GOAL,
                    entityId: goalId,
                    metadata: { ...goalAudit(goal), operation_count: goal.operations.length },
                },
                tx,
            )
        })
    }

    async createOperation(
        workspaceId: string,
        userId: string,
        goalId: string,
        body: GoalOperationDto,
    ) {
        const context = await this.context(workspaceId)
        const operation = await this.prisma.$transaction(
            async (tx) => {
                const goal = await this.findGoal(workspaceId, goalId, tx)
                assertMutable(goal)
                const date = parseOperationDate(body.date, context.today)
                const amount = toCents(body.amount)
                if (
                    body.type === 'withdrawal' &&
                    balanceCents(goal.operations, goal.initialAmount) - amount < 0
                ) {
                    throw new ConflictException(NEGATIVE_BALANCE)
                }
                const created = await tx.goalOperation.create({
                    data: {
                        workspaceId,
                        goalId,
                        type: body.type,
                        amount,
                        date,
                        note: normalizeNote(body.note),
                    },
                })
                await this.auditOperation(AUDIT_ACTIONS.GOAL_OPERATION_CREATED, created, userId, tx)
                return created
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        )
        return mapOperation(operation)
    }

    async updateOperation(
        workspaceId: string,
        userId: string,
        goalId: string,
        operationId: string,
        body: GoalOperationDto,
    ) {
        const context = await this.context(workspaceId)
        const operation = await this.prisma.$transaction(
            async (tx) => {
                const goal = await this.findGoal(workspaceId, goalId, tx)
                assertMutable(goal)
                const previous = goal.operations.find((item) => item.id === operationId)
                if (!previous) throw new NotFoundException('Goal operation not found')
                const nextOperations = goal.operations.filter((item) => item.id !== operationId)
                const nextAmount = toCents(body.amount)
                const prospective =
                    balanceCents(nextOperations, goal.initialAmount) +
                    (body.type === 'deposit' ? nextAmount : -nextAmount)
                if (prospective < 0) throw new ConflictException(NEGATIVE_BALANCE)
                const updated = await tx.goalOperation.update({
                    where: { workspaceId_id: { workspaceId, id: operationId } },
                    data: {
                        type: body.type,
                        amount: nextAmount,
                        date: parseOperationDate(body.date, context.today),
                        note: normalizeNote(body.note),
                    },
                })
                await this.auditService.record(
                    {
                        action: AUDIT_ACTIONS.GOAL_OPERATION_UPDATED,
                        workspaceId,
                        userId,
                        entityType: AUDIT_ENTITY_TYPES.GOAL_OPERATION,
                        entityId: operationId,
                        metadata: {
                            previous: operationAudit(previous),
                            current: operationAudit(updated),
                        },
                    },
                    tx,
                )
                return updated
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        )
        return mapOperation(operation)
    }

    async deleteOperation(
        workspaceId: string,
        userId: string,
        goalId: string,
        operationId: string,
    ): Promise<void> {
        await this.prisma.$transaction(
            async (tx) => {
                const goal = await this.findGoal(workspaceId, goalId, tx)
                assertMutable(goal)
                const operation = goal.operations.find((item) => item.id === operationId)
                if (!operation) throw new NotFoundException('Goal operation not found')
                const remaining = goal.operations.filter((item) => item.id !== operationId)
                if (balanceCents(remaining, goal.initialAmount) < 0) {
                    throw new ConflictException(NEGATIVE_BALANCE)
                }
                await tx.goalOperation.delete({
                    where: { workspaceId_id: { workspaceId, id: operationId } },
                })
                await this.auditOperation(
                    AUDIT_ACTIONS.GOAL_OPERATION_DELETED,
                    operation,
                    userId,
                    tx,
                )
            },
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        )
    }

    private async context(workspaceId: string) {
        const workspace = await this.workspaceService.getWorkspaceById(workspaceId)
        return {
            currency: workspace.baseCurrency,
            today: dateInTimeZone(new Date(), workspace.timezone),
        }
    }

    private async findGoal(
        workspaceId: string,
        goalId: string,
        prisma: Prisma.TransactionClient | PrismaService,
    ): Promise<GoalWithOperations> {
        const goal = await prisma.goal.findUnique({
            where: { workspaceId_id: { workspaceId, id: goalId } },
            include: { operations: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }] } },
        })
        if (!goal) throw new NotFoundException(GOAL_NOT_FOUND)
        return goal
    }

    private auditOperation(
        action:
            | typeof AUDIT_ACTIONS.GOAL_OPERATION_CREATED
            | typeof AUDIT_ACTIONS.GOAL_OPERATION_DELETED,
        operation: GoalOperation,
        userId: string,
        prisma: Prisma.TransactionClient,
    ) {
        return this.auditService.record(
            {
                action,
                workspaceId: operation.workspaceId,
                userId,
                entityType: AUDIT_ENTITY_TYPES.GOAL_OPERATION,
                entityId: operation.id,
                metadata: operationAudit(operation),
            },
            prisma,
        )
    }
}

function mapGoal(goal: GoalWithOperations, today: Date, includeOperations: boolean) {
    const deposited = sumOperations(goal.operations, 'deposit')
    const withdrawn = sumOperations(goal.operations, 'withdrawal')
    const plan = calculateGoalPlan({
        targetAmountCents: goal.targetAmount,
        initialAmountCents: goal.initialAmount,
        depositedAmountCents: deposited,
        withdrawnAmountCents: withdrawn,
        targetDate: goal.targetDate,
        planStartMonth: goal.planStartMonth,
        today,
    })
    return {
        id: goal.id,
        workspace_id: goal.workspaceId,
        name: goal.name,
        target_amount: fromCents(goal.targetAmount),
        initial_amount: fromCents(goal.initialAmount),
        currency: goal.currency,
        target_date: dateString(goal.targetDate),
        plan_start_month: dateString(goal.planStartMonth).slice(0, 7),
        archived_at: goal.archivedAt,
        current_amount: fromCents(plan.currentAmountCents),
        remaining_amount: fromCents(plan.remainingAmountCents),
        progress_percentage: plan.progressPercentage,
        remaining_months: plan.remainingMonths,
        recommended_monthly_amount:
            plan.recommendedMonthlyAmountCents === null
                ? null
                : fromCents(plan.recommendedMonthlyAmountCents),
        status: plan.status,
        ...(includeOperations ? { operations: goal.operations.map(mapOperation) } : {}),
        created_at: goal.createdAt,
        updated_at: goal.updatedAt,
    }
}

function mapOperation(operation: GoalOperation) {
    return {
        id: operation.id,
        goal_id: operation.goalId,
        type: operation.type,
        amount: fromCents(operation.amount),
        date: dateString(operation.date),
        note: operation.note,
        created_at: operation.createdAt,
        updated_at: operation.updatedAt,
    }
}

function parseTargetDate(value: string, today: Date): Date {
    const date = parseDate(value, 'Target date')
    const min = addUtcMonthsClamped(today, 1)
    const max = addUtcMonthsClamped(today, 120)
    if (date < min || date > max) throw new BadRequestException(DATE_RANGE)
    return date
}

function parseOperationDate(value: string, today: Date): Date {
    const date = parseDate(value, 'Operation date')
    if (date > today) throw new BadRequestException('Operation date cannot be in the future')
    return date
}

function parseDate(value: string, field: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match) throw new BadRequestException(`${field} must use YYYY-MM-DD format`)
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
    if (dateString(date) !== value) throw new BadRequestException(`${field} must be a valid date`)
    return date
}

function normalizeName(value: string): string {
    const name = value.trim()
    if (!name) throw new BadRequestException('Goal name is required')
    return name
}

function normalizeNote(value?: string): string | null {
    const note = value?.trim()
    return note ? note : null
}

function assertMutable(goal: Goal): void {
    if (goal.archivedAt) throw new ConflictException(GOAL_ARCHIVED)
}

function balanceCents(operations: GoalOperation[], initialAmount: number): number {
    return (
        initialAmount +
        sumOperations(operations, 'deposit') -
        sumOperations(operations, 'withdrawal')
    )
}

function sumOperations(operations: GoalOperation[], type: string): number {
    return operations.reduce(
        (sum, operation) => sum + (operation.type === type ? operation.amount : 0),
        0,
    )
}

function toCents(value: number): number {
    return Math.round(value * 100)
}

function fromCents(value: number): number {
    return Number((value / 100).toFixed(2))
}

function dateString(date: Date): string {
    return date.toISOString().slice(0, 10)
}

function goalAudit(goal: Goal) {
    return {
        id: goal.id,
        workspace_id: goal.workspaceId,
        name: goal.name,
        target_amount: goal.targetAmount,
        initial_amount: goal.initialAmount,
        currency: goal.currency,
        target_date: dateString(goal.targetDate),
        plan_start_month: dateString(goal.planStartMonth),
        archived_at: goal.archivedAt?.toISOString() ?? null,
    }
}

function operationAudit(operation: GoalOperation) {
    return {
        id: operation.id,
        goal_id: operation.goalId,
        type: operation.type,
        amount: operation.amount,
        date: dateString(operation.date),
        note: operation.note,
    }
}
