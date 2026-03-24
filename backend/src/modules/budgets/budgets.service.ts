import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../../shared/database/prisma.service'
import { validateMoneyAmountValue } from '../../shared/utils/validation'
import { Budget } from '@prisma/client'
import { BudgetsPersistenceClient, BudgetsRepository } from './budgets.repository'
import { calculateBudgetProgress } from './budget-progress.calculator'

const BUDGET_ALREADY_EXISTS_MESSAGE = 'Budget already exists for category and month'
const BUDGET_CATEGORY_CHILD_REQUIRED_MESSAGE = 'Budget category must be a child category'
const BUDGET_MAX_AMOUNT_CENTS = 2147483647
const BUDGET_MAX_AMOUNT_MESSAGE = 'Amount must be less than or equal to 21474836.47'
const BUDGET_NOT_FOUND_MESSAGE = 'Budget not found'
const CATEGORY_NOT_FOUND_MESSAGE = 'Category not found'
const DEFAULT_BUDGET_CURRENCY = 'USD'

export interface BudgetRequestInput {
    amount?: unknown
    category_id?: unknown
    year?: unknown
    month?: unknown
}

export interface ListBudgetsRequestInput {
    year?: unknown
    month?: unknown
}

export interface ListBudgetProgressRequestInput {
    month?: unknown
}

export interface BudgetResponse {
    id: string
    workspace_id: string
    category_id: string | null
    amount: number
    currency: string
    year: number
    month: number
    created_at: Date
    updated_at: Date
}

export interface BudgetProgressResponse {
    category_id: string
    category_name: string
    budget_amount: number | null
    limit: number | null
    spent: number
    remaining: number | null
    percentage: number | null
}

interface ValidatedBudgetInput {
    amountCents?: number
    categoryId?: string
    year?: number
    month?: number
    errors: string[]
}

interface ValidatedBudgetProgressMonth {
    year: number
    month: number
    startDate: Date
    endDateExclusive: Date
}

@Injectable()
export class BudgetsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly budgetsRepository: BudgetsRepository,
    ) {}

    async listBudgets(
        input: ListBudgetsRequestInput,
        workspaceId: string,
    ): Promise<BudgetResponse[]> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const validatedInput = validateBudgetInput(input)

        if (
            validatedInput.errors.length > 0 ||
            typeof validatedInput.year !== 'number' ||
            typeof validatedInput.month !== 'number'
        ) {
            throw new BadRequestException(validatedInput.errors)
        }

        const budgets = await this.budgetsRepository.listBudgetsByMonth(
            normalizedWorkspaceId,
            validatedInput.year,
            validatedInput.month,
            this.prisma,
        )

        return budgets.map((budget) => mapBudgetResponse(budget))
    }

    async listBudgetProgress(
        input: ListBudgetProgressRequestInput,
        workspaceId: string,
    ): Promise<BudgetProgressResponse[]> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const monthRange = validateBudgetProgressMonthInput(input)

        const [categories, budgets, spending] = await Promise.all([
            this.budgetsRepository.listCategoriesForProgress(normalizedWorkspaceId, this.prisma),
            this.budgetsRepository.listBudgetsByMonth(
                normalizedWorkspaceId,
                monthRange.year,
                monthRange.month,
                this.prisma,
            ),
            this.budgetsRepository.listTransactionSpendByCategory(
                normalizedWorkspaceId,
                monthRange.startDate,
                monthRange.endDateExclusive,
                this.prisma,
            ),
        ])

        return calculateBudgetProgress({
            categories,
            budgets,
            spending,
        }).map((progress) => mapBudgetProgressResponse(progress))
    }

    async createBudget(
        input: BudgetRequestInput,
        workspaceId: string,
        userId: string,
    ): Promise<BudgetResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const normalizedUserId = normalizeRequiredValue(userId, 'User id')
        const validatedInput = validateBudgetInput(input)

        if (
            validatedInput.errors.length > 0 ||
            typeof validatedInput.amountCents !== 'number' ||
            !validatedInput.categoryId ||
            typeof validatedInput.year !== 'number' ||
            typeof validatedInput.month !== 'number'
        ) {
            throw new BadRequestException(validatedInput.errors)
        }

        return this.prisma.$transaction(async (tx) => {
            await this.assertValidBudgetCategory(
                normalizedWorkspaceId,
                validatedInput.categoryId!,
                tx,
            )

            const existingBudget = await this.budgetsRepository.findBudgetByCategoryAndMonth(
                normalizedWorkspaceId,
                validatedInput.categoryId!,
                validatedInput.year!,
                validatedInput.month!,
                tx,
            )

            if (existingBudget) {
                throw new ConflictException(BUDGET_ALREADY_EXISTS_MESSAGE)
            }

            try {
                const budget = await this.budgetsRepository.createBudget(
                    {
                        workspaceId: normalizedWorkspaceId,
                        userId: normalizedUserId,
                        categoryId: validatedInput.categoryId!,
                        amount: validatedInput.amountCents!,
                        currency: DEFAULT_BUDGET_CURRENCY,
                        year: validatedInput.year!,
                        month: validatedInput.month!,
                    },
                    tx,
                )

                return mapBudgetResponse(budget)
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    throw new ConflictException(BUDGET_ALREADY_EXISTS_MESSAGE)
                }

                throw error
            }
        })
    }

    async updateBudget(
        input: BudgetRequestInput,
        budgetId: string,
        workspaceId: string,
        userId: string,
    ): Promise<BudgetResponse> {
        const normalizedBudgetId = normalizeRequiredValue(budgetId, 'Budget id')
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const normalizedUserId = normalizeRequiredValue(userId, 'User id')
        const validatedInput = validateBudgetInput(input)

        if (
            validatedInput.errors.length > 0 ||
            typeof validatedInput.amountCents !== 'number' ||
            !validatedInput.categoryId ||
            typeof validatedInput.year !== 'number' ||
            typeof validatedInput.month !== 'number'
        ) {
            throw new BadRequestException(validatedInput.errors)
        }

        return this.prisma.$transaction(async (tx) => {
            const existingBudget = await this.budgetsRepository.findBudgetById(
                normalizedWorkspaceId,
                normalizedBudgetId,
                tx,
            )

            if (!existingBudget) {
                throw new NotFoundException(BUDGET_NOT_FOUND_MESSAGE)
            }

            await this.assertValidBudgetCategory(
                normalizedWorkspaceId,
                validatedInput.categoryId!,
                tx,
            )

            const duplicateBudget = await this.budgetsRepository.findBudgetByCategoryAndMonth(
                normalizedWorkspaceId,
                validatedInput.categoryId!,
                validatedInput.year!,
                validatedInput.month!,
                tx,
            )

            if (duplicateBudget && duplicateBudget.id !== normalizedBudgetId) {
                throw new ConflictException(BUDGET_ALREADY_EXISTS_MESSAGE)
            }

            try {
                const budget = await this.budgetsRepository.updateBudget(
                    {
                        workspaceId: normalizedWorkspaceId,
                        budgetId: normalizedBudgetId,
                        userId: normalizedUserId,
                        categoryId: validatedInput.categoryId!,
                        amount: validatedInput.amountCents!,
                        currency: DEFAULT_BUDGET_CURRENCY,
                        year: validatedInput.year!,
                        month: validatedInput.month!,
                        previousBudget: existingBudget,
                    },
                    tx,
                )

                if (!budget) {
                    throw new NotFoundException(BUDGET_NOT_FOUND_MESSAGE)
                }

                return mapBudgetResponse(budget)
            } catch (error) {
                if (isUniqueConstraintError(error)) {
                    throw new ConflictException(BUDGET_ALREADY_EXISTS_MESSAGE)
                }

                throw error
            }
        })
    }

    async deleteBudget(budgetId: string, workspaceId: string, userId: string): Promise<void> {
        const normalizedBudgetId = normalizeRequiredValue(budgetId, 'Budget id')
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const normalizedUserId = normalizeRequiredValue(userId, 'User id')

        await this.prisma.$transaction(async (tx) => {
            const existingBudget = await this.budgetsRepository.findBudgetById(
                normalizedWorkspaceId,
                normalizedBudgetId,
                tx,
            )

            if (!existingBudget) {
                throw new NotFoundException(BUDGET_NOT_FOUND_MESSAGE)
            }

            const wasDeleted = await this.budgetsRepository.deleteBudget(
                {
                    workspaceId: normalizedWorkspaceId,
                    budgetId: normalizedBudgetId,
                    userId: normalizedUserId,
                    budget: existingBudget,
                },
                tx,
            )

            if (!wasDeleted) {
                throw new NotFoundException(BUDGET_NOT_FOUND_MESSAGE)
            }
        })
    }

    private async assertValidBudgetCategory(
        workspaceId: string,
        categoryId: string,
        prisma: BudgetsPersistenceClient,
    ): Promise<void> {
        const category = await this.budgetsRepository.findActiveCategoryById(
            workspaceId,
            categoryId,
            prisma,
        )

        if (!category) {
            throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE)
        }

        if (!category.parentId) {
            throw new BadRequestException(BUDGET_CATEGORY_CHILD_REQUIRED_MESSAGE)
        }
    }
}

function validateBudgetInput(
    input: BudgetRequestInput | ListBudgetsRequestInput,
): ValidatedBudgetInput {
    const errors: string[] = []

    return {
        amountCents: 'amount' in input ? validateAmountValue(input.amount, errors) : undefined,
        categoryId:
            'category_id' in input
                ? validateRequiredIdValue(input.category_id, 'Category id', errors)
                : undefined,
        year: validateYearValue(input.year, errors),
        month: validateMonthValue(input.month, errors),
        errors,
    }
}

function validateBudgetProgressMonthInput(
    input: ListBudgetProgressRequestInput,
): ValidatedBudgetProgressMonth {
    if (typeof input.month !== 'string' || input.month.trim().length === 0) {
        throw new BadRequestException(['Month is required'])
    }

    const normalizedMonth = input.month.trim()
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(normalizedMonth)

    if (!match) {
        throw new BadRequestException(['Month must use YYYY-MM format'])
    }

    const year = Number.parseInt(match[1], 10)
    const month = Number.parseInt(match[2], 10)

    return {
        year,
        month,
        startDate: new Date(Date.UTC(year, month - 1, 1)),
        endDateExclusive: new Date(Date.UTC(year, month, 1)),
    }
}

function validateAmountValue(value: unknown, errors: string[]): number | undefined {
    return validateMoneyAmountValue(value, errors, {
        maxAmountCents: BUDGET_MAX_AMOUNT_CENTS,
        maxAmountMessage: BUDGET_MAX_AMOUNT_MESSAGE,
    })
}

function validateRequiredIdValue(
    value: unknown,
    fieldName: string,
    errors: string[],
): string | undefined {
    if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push(`${fieldName} is required`)
        return undefined
    }

    return value.trim()
}

function validateYearValue(value: unknown, errors: string[]): number | undefined {
    if (value === undefined || value === null) {
        errors.push('Year is required')
        return undefined
    }

    const normalizedValue = normalizeNumericValue(value)

    if (!normalizedValue || !/^\d+$/.test(normalizedValue)) {
        errors.push('Year must be an integer between 1 and 9999')
        return undefined
    }

    const year = Number.parseInt(normalizedValue, 10)

    if (year < 1 || year > 9999) {
        errors.push('Year must be an integer between 1 and 9999')
        return undefined
    }

    return year
}

function validateMonthValue(value: unknown, errors: string[]): number | undefined {
    if (value === undefined || value === null) {
        errors.push('Month is required')
        return undefined
    }

    const normalizedValue = normalizeNumericValue(value)

    if (!normalizedValue || !/^\d+$/.test(normalizedValue)) {
        errors.push('Month must be an integer between 1 and 12')
        return undefined
    }

    const month = Number.parseInt(normalizedValue, 10)

    if (month < 1 || month > 12) {
        errors.push('Month must be an integer between 1 and 12')
        return undefined
    }

    return month
}

function normalizeNumericValue(value: unknown): string | null {
    if (typeof value === 'number') {
        if (!Number.isFinite(value) || !Number.isInteger(value)) {
            return null
        }

        return value.toString()
    }

    if (typeof value !== 'string') {
        return null
    }

    const normalizedValue = value.trim()

    return normalizedValue.length > 0 ? normalizedValue : null
}

function normalizeRequiredValue(value: string, fieldName: string): string {
    const normalizedValue = value.trim()

    if (normalizedValue.length === 0) {
        throw new BadRequestException(`${fieldName} is required`)
    }

    return normalizedValue
}

function mapBudgetResponse(budget: Budget): BudgetResponse {
    return {
        id: budget.id,
        workspace_id: budget.workspaceId,
        category_id: budget.categoryId,
        amount: convertAmountToDisplayValue(budget.amount),
        currency: budget.currency,
        year: budget.year,
        month: budget.month,
        created_at: budget.createdAt,
        updated_at: budget.updatedAt,
    }
}

function mapBudgetProgressResponse(progress: {
    categoryId: string
    categoryName: string
    budgetAmountCents: number | null
    spentCents: number
    remainingCents: number | null
    percentageBasisPoints: number | null
}): BudgetProgressResponse {
    const budgetAmount =
        progress.budgetAmountCents === null
            ? null
            : convertAmountToDisplayValue(progress.budgetAmountCents)

    return {
        category_id: progress.categoryId,
        category_name: progress.categoryName,
        budget_amount: budgetAmount,
        limit: budgetAmount,
        spent: convertAmountToDisplayValue(progress.spentCents),
        remaining:
            progress.remainingCents === null
                ? null
                : convertAmountToDisplayValue(progress.remainingCents),
        percentage:
            progress.percentageBasisPoints === null
                ? null
                : convertBasisPointsToDisplayValue(progress.percentageBasisPoints),
    }
}

function convertAmountToDisplayValue(amountInCents: number): number {
    return Number((amountInCents / 100).toFixed(2))
}

function convertBasisPointsToDisplayValue(basisPoints: number): number {
    const sign = basisPoints < 0 ? '-' : ''
    const absoluteBasisPoints = Math.abs(basisPoints)
    const wholePart = Math.trunc(absoluteBasisPoints / 100)
    const fractionalPart = absoluteBasisPoints % 100

    if (fractionalPart === 0) {
        return Number(`${sign}${wholePart}`)
    }

    return Number(
        `${sign}${wholePart}.${fractionalPart.toString().padStart(2, '0').replace(/0+$/, '')}`,
    )
}

function isUniqueConstraintError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
    )
}
