import { BadRequestException, Injectable } from '@nestjs/common'
import { DashboardRepository } from './dashboard.repository'
import { WorkspaceService } from '../workspace/workspace.service'
import {
    ListedTransactionRecord,
    TransactionsRepository,
} from '../transactions/transactions.repository'
import type { CreateTransactionResponse } from '../transactions/transactions.service'

export interface DashboardMonthCommand {
    month: string
}

export interface SpendingSummaryResponse {
    month: string
    currency: string
    current_total: number
    previous_total: number
    change_amount: number
    change_percentage: number | null
    direction: 'up' | 'down' | 'flat'
}

export interface CategoryBreakdownItemResponse {
    category_id: string
    category_name: string
    category_system_key: string | null
    category_color: string | null
    amount: number
    percentage: number
}

export interface CategoryBreakdownResponse {
    month: string
    currency: string
    total_spending: number
    categories: CategoryBreakdownItemResponse[]
}

export interface SpendingTrendItemResponse {
    month: string
    total: number
}

export interface DashboardOverviewResponse {
    summary: SpendingSummaryResponse
    category_breakdown: CategoryBreakdownResponse
    spending_trend: SpendingTrendItemResponse[]
    recent_transactions: CreateTransactionResponse[]
}

interface ValidatedDashboardMonth {
    month: string
    startDate: Date
    endDateExclusive: Date
    previousStartDate: Date
    previousEndDateExclusive: Date
}

@Injectable()
export class DashboardService {
    constructor(
        private readonly dashboardRepository: DashboardRepository,
        private readonly workspaceService?: WorkspaceService,
        private readonly transactionsRepository?: TransactionsRepository,
    ) {}

    async getOverview(
        input: DashboardMonthCommand,
        workspaceId: string,
    ): Promise<DashboardOverviewResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const monthRange = validateDashboardMonthInput(input)
        const trendMonths = getMonthSequence(monthRange.month, 6)
        const trendStart = parseMonthStart(trendMonths[0])
        const workspacePromise = this.workspaceService
            ? this.workspaceService.getWorkspaceById(normalizedWorkspaceId)
            : Promise.resolve({ baseCurrency: 'USD' } as const)
        const recentTransactionsPromise = this.transactionsRepository
            ? this.transactionsRepository.listTransactions({
                  workspaceId: normalizedWorkspaceId,
                  limit: 5,
                  offset: 0,
                  sortBy: 'date',
                  sortDirection: 'desc',
              })
            : Promise.resolve([])

        const [workspace, monthlySpend, categorySpend, recentTransactions] = await Promise.all([
            workspacePromise,
            this.dashboardRepository.listMonthlySpendForRange(
                normalizedWorkspaceId,
                trendStart,
                monthRange.endDateExclusive,
            ),
            this.dashboardRepository.listCategorySpendForRange(
                normalizedWorkspaceId,
                monthRange.startDate,
                monthRange.endDateExclusive,
            ),
            recentTransactionsPromise,
        ])
        const totalsByMonth = new Map(monthlySpend.map((item) => [item.month, item.amount]))
        const currentTotalCents = totalsByMonth.get(monthRange.month) ?? 0
        const previousMonth = getMonthSequence(monthRange.month, 2)[0]
        const previousTotalCents = totalsByMonth.get(previousMonth) ?? 0
        const summary = buildSpendingSummary(
            monthRange.month,
            workspace.baseCurrency,
            currentTotalCents,
            previousTotalCents,
        )
        const categoryBreakdown = await this.buildCategoryBreakdown(
            normalizedWorkspaceId,
            monthRange.month,
            workspace.baseCurrency,
            categorySpend,
        )

        return {
            summary,
            category_breakdown: categoryBreakdown,
            spending_trend: trendMonths.map((month) => ({
                month,
                total: convertAmountToDisplayValue(totalsByMonth.get(month) ?? 0),
            })),
            recent_transactions: recentTransactions.map(mapRecentTransaction),
        }
    }

    async getSpendingSummary(
        input: DashboardMonthCommand,
        workspaceId: string,
    ): Promise<SpendingSummaryResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const monthRange = validateDashboardMonthInput(input)
        const workspace = this.workspaceService
            ? await this.workspaceService.getWorkspaceById(normalizedWorkspaceId)
            : ({ baseCurrency: 'USD' } as const)

        const [currentTotalCents, previousTotalCents] = await Promise.all([
            this.dashboardRepository.getTotalSpendForRange(
                normalizedWorkspaceId,
                monthRange.startDate,
                monthRange.endDateExclusive,
            ),
            this.dashboardRepository.getTotalSpendForRange(
                normalizedWorkspaceId,
                monthRange.previousStartDate,
                monthRange.previousEndDateExclusive,
            ),
        ])

        return buildSpendingSummary(
            monthRange.month,
            workspace.baseCurrency,
            currentTotalCents,
            previousTotalCents,
        )
    }

    async getCategoryBreakdown(
        input: DashboardMonthCommand,
        workspaceId: string,
    ): Promise<CategoryBreakdownResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const monthRange = validateDashboardMonthInput(input)
        const workspace = this.workspaceService
            ? await this.workspaceService.getWorkspaceById(normalizedWorkspaceId)
            : ({ baseCurrency: 'USD' } as const)
        const categorySpend = await this.dashboardRepository.listCategorySpendForRange(
            normalizedWorkspaceId,
            monthRange.startDate,
            monthRange.endDateExclusive,
        )

        return this.buildCategoryBreakdown(
            normalizedWorkspaceId,
            monthRange.month,
            workspace.baseCurrency,
            categorySpend,
        )
    }

    private async buildCategoryBreakdown(
        workspaceId: string,
        month: string,
        currency: string,
        categorySpend: Array<{ categoryId: string; amount: number }>,
    ): Promise<CategoryBreakdownResponse> {
        const totalSpendingCents = categorySpend.reduce((sum, category) => sum + category.amount, 0)

        if (totalSpendingCents === 0) {
            return {
                month,
                currency,
                total_spending: 0,
                categories: [],
            }
        }

        const categories = await this.dashboardRepository.listCategoriesByIds(
            workspaceId,
            categorySpend.map((entry) => entry.categoryId),
        )
        const categoriesById = new Map(categories.map((category) => [category.id, category]))

        return {
            month,
            currency,
            total_spending: convertAmountToDisplayValue(totalSpendingCents),
            categories: categorySpend
                .map((entry) => {
                    const category = categoriesById.get(entry.categoryId)

                    return {
                        category_id: entry.categoryId,
                        category_name: category?.name ?? 'Unknown category',
                        category_system_key: category?.systemKey ?? null,
                        category_color: category?.color ?? null,
                        amount: convertAmountToDisplayValue(entry.amount),
                        percentage: convertBasisPointsToDisplayValue(
                            calculatePercentageBasisPoints(entry.amount, totalSpendingCents),
                        ),
                    }
                })
                .sort((left, right) => {
                    if (right.amount !== left.amount) {
                        return right.amount - left.amount
                    }

                    const nameComparison = left.category_name.localeCompare(right.category_name)

                    if (nameComparison !== 0) {
                        return nameComparison
                    }

                    return left.category_id.localeCompare(right.category_id)
                }),
        }
    }
}

function buildSpendingSummary(
    month: string,
    currency: string,
    currentTotalCents: number,
    previousTotalCents: number,
): SpendingSummaryResponse {
    const changeAmountCents = currentTotalCents - previousTotalCents

    return {
        month,
        currency,
        current_total: convertAmountToDisplayValue(currentTotalCents),
        previous_total: convertAmountToDisplayValue(previousTotalCents),
        change_amount: convertAmountToDisplayValue(changeAmountCents),
        change_percentage: calculateChangePercentage(currentTotalCents, previousTotalCents),
        direction: determineDirection(changeAmountCents),
    }
}

function parseMonthStart(month: string): Date {
    const [year, monthPart] = month.split('-').map(Number)
    return new Date(Date.UTC(year, monthPart - 1, 1))
}

function getMonthSequence(endMonth: string, count: number): string[] {
    const end = parseMonthStart(endMonth)

    return Array.from({ length: count }, (_, index) => {
        const value = new Date(
            Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - count + 1 + index, 1),
        )
        return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`
    })
}

function mapRecentTransaction(transaction: ListedTransactionRecord): CreateTransactionResponse {
    return {
        id: transaction.id,
        workspace_id: transaction.workspace_id,
        category_id: transaction.category_id,
        payment_source_id: transaction.payment_source_id!,
        type: transaction.type,
        amount: convertAmountToDisplayValue(transaction.amount),
        currency: transaction.currency,
        date: transaction.date.toISOString().slice(0, 10),
        description: transaction.description,
        notes: transaction.notes,
        tags: transaction.tags,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
    }
}

function validateDashboardMonthInput(input: DashboardMonthCommand): ValidatedDashboardMonth {
    if (input.month.trim().length === 0) {
        throw new BadRequestException(['Month is required'])
    }

    const normalizedMonth = input.month.trim()
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(normalizedMonth)

    if (!match) {
        throw new BadRequestException(['Month must use YYYY-MM format'])
    }

    const year = Number.parseInt(match[1], 10)
    const monthIndex = Number.parseInt(match[2], 10) - 1

    return {
        month: normalizedMonth,
        startDate: new Date(Date.UTC(year, monthIndex, 1)),
        endDateExclusive: new Date(Date.UTC(year, monthIndex + 1, 1)),
        previousStartDate: new Date(Date.UTC(year, monthIndex - 1, 1)),
        previousEndDateExclusive: new Date(Date.UTC(year, monthIndex, 1)),
    }
}

function normalizeRequiredValue(value: string, fieldName: string): string {
    const normalizedValue = value.trim()

    if (normalizedValue.length === 0) {
        throw new BadRequestException(`${fieldName} is required`)
    }

    return normalizedValue
}

function determineDirection(changeAmountCents: number): 'up' | 'down' | 'flat' {
    if (changeAmountCents > 0) {
        return 'up'
    }

    if (changeAmountCents < 0) {
        return 'down'
    }

    return 'flat'
}

function calculateChangePercentage(
    currentTotalCents: number,
    previousTotalCents: number,
): number | null {
    if (previousTotalCents === 0) {
        return currentTotalCents === 0 ? 0 : null
    }

    const basisPoints = Math.round(
        ((currentTotalCents - previousTotalCents) * 10000) / previousTotalCents,
    )

    return convertBasisPointsToDisplayValue(basisPoints)
}

function calculatePercentageBasisPoints(amountCents: number, totalAmountCents: number): number {
    return Math.round((amountCents * 10000) / totalAmountCents)
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
