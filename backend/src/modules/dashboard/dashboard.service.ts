import { BadRequestException, Injectable } from '@nestjs/common'
import { DashboardRepository } from './dashboard.repository'

export interface DashboardMonthRequestInput {
    month?: unknown
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

interface ValidatedDashboardMonth {
    month: string
    startDate: Date
    endDateExclusive: Date
    previousStartDate: Date
    previousEndDateExclusive: Date
}

const DEFAULT_DASHBOARD_CURRENCY = 'USD'

@Injectable()
export class DashboardService {
    constructor(private readonly dashboardRepository: DashboardRepository) {}

    async getSpendingSummary(
        input: DashboardMonthRequestInput,
        workspaceId: string,
    ): Promise<SpendingSummaryResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const monthRange = validateDashboardMonthInput(input)

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

        const changeAmountCents = currentTotalCents - previousTotalCents

        return {
            month: monthRange.month,
            currency: DEFAULT_DASHBOARD_CURRENCY,
            current_total: convertAmountToDisplayValue(currentTotalCents),
            previous_total: convertAmountToDisplayValue(previousTotalCents),
            change_amount: convertAmountToDisplayValue(changeAmountCents),
            change_percentage: calculateChangePercentage(currentTotalCents, previousTotalCents),
            direction: determineDirection(changeAmountCents),
        }
    }

    async getCategoryBreakdown(
        input: DashboardMonthRequestInput,
        workspaceId: string,
    ): Promise<CategoryBreakdownResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const monthRange = validateDashboardMonthInput(input)
        const categorySpend = await this.dashboardRepository.listCategorySpendForRange(
            normalizedWorkspaceId,
            monthRange.startDate,
            monthRange.endDateExclusive,
        )

        const totalSpendingCents = categorySpend.reduce((sum, category) => sum + category.amount, 0)

        if (totalSpendingCents === 0) {
            return {
                month: monthRange.month,
                currency: DEFAULT_DASHBOARD_CURRENCY,
                total_spending: 0,
                categories: [],
            }
        }

        const categories = await this.dashboardRepository.listCategoriesByIds(
            normalizedWorkspaceId,
            categorySpend.map((entry) => entry.categoryId),
        )
        const categoriesById = new Map(categories.map((category) => [category.id, category]))

        return {
            month: monthRange.month,
            currency: DEFAULT_DASHBOARD_CURRENCY,
            total_spending: convertAmountToDisplayValue(totalSpendingCents),
            categories: categorySpend
                .map((entry) => {
                    const category = categoriesById.get(entry.categoryId)

                    return {
                        category_id: entry.categoryId,
                        category_name: category?.name ?? 'Unknown category',
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

function validateDashboardMonthInput(input: DashboardMonthRequestInput): ValidatedDashboardMonth {
    if (typeof input.month !== 'string' || input.month.trim().length === 0) {
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
