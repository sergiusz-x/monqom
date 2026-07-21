import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../shared/database/prisma.service'
import { validateMoneyAmountValue } from '../../shared/utils/validation'
import { CurrencyService, normalizeCurrency } from '../../shared/currency/currency.service'
import { WorkspaceService } from '../workspace/workspace.service'
import {
    ListedTransactionRecord,
    ListTransactionsFilters,
    TransactionSortDirection,
    TransactionSortField,
    TransactionWithTags,
    TransactionsPersistenceClient,
    TransactionsRepository,
} from './transactions.repository'

const CATEGORY_NOT_FOUND_MESSAGE = 'Category not found'
const EXPENSE_TRANSACTION_TYPE = 'expense'
const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_TRANSACTION_LIST_LIMIT = 20
const MAX_TAGS_PER_TRANSACTION = 10
const MAX_CATEGORY_FILTERS = 100
const MAX_TRANSACTION_DESCRIPTION_LENGTH = 200
const PAYMENT_SOURCE_NOT_FOUND_MESSAGE = 'Payment source not found'
const TRANSACTION_NOT_FOUND_MESSAGE = 'Transaction not found'

export interface CreateTransactionCommand {
    amount: number
    currency?: string
    date: string
    description: string
    categoryId: string
    notes?: string | null
    tags?: string[]
    paymentSourceId: string
}

export interface CreateTransactionResponse {
    id: string
    workspace_id: string
    category_id: string
    payment_source_id: string
    type: string
    amount: number
    currency: string
    date: string
    description: string
    notes: string | null
    tags: string[]
    created_at: Date
    updated_at: Date
}

export interface ListTransactionsCommand {
    categoryId?: string
    categoryIds?: string[]
    sortBy?: TransactionSortField
    sortDirection?: TransactionSortDirection
    paymentSourceId?: string
    tag?: string
    dateFrom?: string
    dateTo?: string
    limit?: number
    offset?: number
}

export interface ListTransactionsResponse {
    data: CreateTransactionResponse[]
    total: number
    limit: number
    offset: number
}

interface ValidatedListTransactionsInput {
    categoryIds?: string[]
    sortBy: TransactionSortField
    sortDirection: TransactionSortDirection
    paymentSourceId?: string
    tag?: string
    dateFrom?: Date
    dateTo?: Date
    limit: number
    offset: number
    errors: string[]
}

interface ParsedDateFilterOptions {
    fieldName: string
    boundary: 'start' | 'end'
}

interface ValidatedCreateTransactionInput {
    amountCents?: number
    categoryId?: string
    date?: Date
    description?: string
    notes: string | null
    paymentSourceId?: string
    tags: string[]
    errors: string[]
}

@Injectable()
export class TransactionsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly transactionsRepository: TransactionsRepository,
        private readonly currencyService?: CurrencyService,
        private readonly workspaceService?: WorkspaceService,
    ) {}

    async createTransaction(
        input: CreateTransactionCommand,
        workspaceId: string,
        userId: string,
    ): Promise<CreateTransactionResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const normalizedUserId = normalizeRequiredValue(userId, 'User id')
        const validatedInput = validateCreateTransactionInput(input)

        if (
            validatedInput.errors.length > 0 ||
            typeof validatedInput.amountCents !== 'number' ||
            !validatedInput.categoryId ||
            !validatedInput.paymentSourceId ||
            !validatedInput.date ||
            !validatedInput.description
        ) {
            throw new BadRequestException(validatedInput.errors)
        }

        const amountCents = validatedInput.amountCents
        const categoryId = validatedInput.categoryId
        const transactionDate = validatedInput.date
        const description = validatedInput.description
        const currency = normalizeCurrency(input.currency ?? 'USD')
        const workspace = this.workspaceService
            ? await this.workspaceService.getWorkspaceById(normalizedWorkspaceId)
            : ({ baseCurrency: 'USD' } as const)
        const fx = this.currencyService
            ? await this.currencyService.getHistoricalQuote(
                  currency,
                  workspace.baseCurrency,
                  transactionDate,
              )
            : { rate: 1, rateDate: transactionDate, source: 'legacy' as const }
        const baseAmount = Math.round(amountCents * fx.rate)

        return this.prisma.$transaction(async (tx) => {
            await this.assertValidTransactionReferences(
                normalizedWorkspaceId,
                categoryId,
                validatedInput.paymentSourceId!,
                tx,
            )

            const transaction = await this.transactionsRepository.createTransactionWithTags(
                {
                    workspaceId: normalizedWorkspaceId,
                    userId: normalizedUserId,
                    categoryId,
                    paymentSourceId: validatedInput.paymentSourceId!,
                    type: EXPENSE_TRANSACTION_TYPE,
                    amount: amountCents,
                    currency,
                    ...(this.currencyService
                        ? {
                              baseAmount,
                              fxRate: fx.rate,
                              fxRateDate: fx.rateDate,
                              fxSource: fx.source,
                          }
                        : {}),
                    date: transactionDate,
                    description,
                    notes: validatedInput.notes,
                    tags: validatedInput.tags,
                },
                tx,
            )

            return mapCreateTransactionResponse(transaction)
        })
    }

    async getTransactionById(
        transactionId: string,
        workspaceId: string,
    ): Promise<CreateTransactionResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const normalizedTransactionId = normalizeRequiredValue(transactionId, 'Transaction id')
        const transaction = await this.transactionsRepository.findTransactionById(
            normalizedWorkspaceId,
            normalizedTransactionId,
            this.prisma,
        )

        if (!transaction) {
            throw new NotFoundException(TRANSACTION_NOT_FOUND_MESSAGE)
        }

        return mapCreateTransactionResponse(transaction)
    }

    async updateTransaction(
        input: CreateTransactionCommand,
        transactionId: string,
        workspaceId: string,
        userId?: string,
    ): Promise<CreateTransactionResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const normalizedTransactionId = normalizeRequiredValue(transactionId, 'Transaction id')
        const validatedInput = validateCreateTransactionInput(input)

        if (
            validatedInput.errors.length > 0 ||
            typeof validatedInput.amountCents !== 'number' ||
            !validatedInput.categoryId ||
            !validatedInput.paymentSourceId ||
            !validatedInput.date ||
            !validatedInput.description
        ) {
            throw new BadRequestException(validatedInput.errors)
        }

        const amountCents = validatedInput.amountCents
        const categoryId = validatedInput.categoryId
        const transactionDate = validatedInput.date
        const description = validatedInput.description
        const currency = normalizeCurrency(input.currency ?? 'USD')
        const workspace = this.workspaceService
            ? await this.workspaceService.getWorkspaceById(normalizedWorkspaceId)
            : ({ baseCurrency: 'USD' } as const)
        const fx = this.currencyService
            ? await this.currencyService.getHistoricalQuote(
                  currency,
                  workspace.baseCurrency,
                  transactionDate,
              )
            : { rate: 1, rateDate: transactionDate, source: 'legacy' as const }
        const baseAmount = Math.round(amountCents * fx.rate)

        return this.prisma.$transaction(async (tx) => {
            const existingTransaction = await this.transactionsRepository.findTransactionById(
                normalizedWorkspaceId,
                normalizedTransactionId,
                tx,
            )

            if (!existingTransaction) {
                throw new NotFoundException(TRANSACTION_NOT_FOUND_MESSAGE)
            }

            await this.assertValidTransactionReferences(
                normalizedWorkspaceId,
                categoryId,
                validatedInput.paymentSourceId!,
                tx,
                existingTransaction.paymentSourceId,
            )

            const transaction = await this.transactionsRepository.updateTransactionWithTags(
                {
                    workspaceId: normalizedWorkspaceId,
                    transactionId: normalizedTransactionId,
                    ...(userId
                        ? {
                              userId: normalizeRequiredValue(userId, 'User id'),
                              previousTransaction: existingTransaction,
                          }
                        : {}),
                    categoryId,
                    paymentSourceId: validatedInput.paymentSourceId!,
                    type: EXPENSE_TRANSACTION_TYPE,
                    amount: amountCents,
                    currency,
                    ...(this.currencyService
                        ? {
                              baseAmount,
                              fxRate: fx.rate,
                              fxRateDate: fx.rateDate,
                              fxSource: fx.source,
                          }
                        : {}),
                    date: transactionDate,
                    description,
                    notes: validatedInput.notes,
                    tags: validatedInput.tags,
                },
                tx,
            )

            if (!transaction) {
                throw new NotFoundException(TRANSACTION_NOT_FOUND_MESSAGE)
            }

            return mapCreateTransactionResponse(transaction)
        })
    }

    async deleteTransaction(
        transactionId: string,
        workspaceId: string,
        userId: string,
    ): Promise<void> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const normalizedTransactionId = normalizeRequiredValue(transactionId, 'Transaction id')
        const normalizedUserId = normalizeRequiredValue(userId, 'User id')

        await this.prisma.$transaction(async (tx) => {
            const transaction = await this.transactionsRepository.findTransactionById(
                normalizedWorkspaceId,
                normalizedTransactionId,
                tx,
            )

            if (!transaction) {
                throw new NotFoundException(TRANSACTION_NOT_FOUND_MESSAGE)
            }

            const wasDeleted = await this.transactionsRepository.softDeleteTransaction(
                {
                    workspaceId: normalizedWorkspaceId,
                    transactionId: normalizedTransactionId,
                    userId: normalizedUserId,
                    deletedAt: new Date(),
                    transaction,
                },
                tx,
            )

            if (!wasDeleted) {
                throw new NotFoundException(TRANSACTION_NOT_FOUND_MESSAGE)
            }
        })
    }

    async listTransactions(
        input: ListTransactionsCommand,
        workspaceId: string,
    ): Promise<ListTransactionsResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const validatedInput = validateListTransactionsInput(input)

        if (validatedInput.errors.length > 0) {
            throw new BadRequestException(validatedInput.errors)
        }

        const filters: ListTransactionsFilters = {
            workspaceId: normalizedWorkspaceId,
            categoryIds: validatedInput.categoryIds,
            sortBy: validatedInput.sortBy,
            sortDirection: validatedInput.sortDirection,
            paymentSourceId: validatedInput.paymentSourceId!,
            tag: validatedInput.tag,
            dateFrom: validatedInput.dateFrom,
            dateTo: validatedInput.dateTo,
        }

        const [transactions, total] = await Promise.all([
            this.transactionsRepository.listTransactions(
                {
                    ...filters,
                    limit: validatedInput.limit,
                    offset: validatedInput.offset,
                },
                this.prisma,
            ),
            this.transactionsRepository.countTransactions(filters, this.prisma),
        ])

        return {
            data: transactions.map((transaction) => mapListedTransactionResponse(transaction)),
            total,
            limit: validatedInput.limit,
            offset: validatedInput.offset,
        }
    }

    async listWorkspaceTags(workspaceId: string): Promise<string[]> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')

        return this.transactionsRepository.listWorkspaceTags(normalizedWorkspaceId, this.prisma)
    }

    private async assertValidTransactionReferences(
        workspaceId: string,
        categoryId: string,
        paymentSourceId: string,
        prisma: TransactionsPersistenceClient,
        allowArchivedPaymentSourceId?: string,
    ): Promise<void> {
        const category = await this.transactionsRepository.findCategoryById(
            workspaceId,
            categoryId,
            prisma,
        )

        if (!category) {
            throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE)
        }

        if (paymentSourceId === allowArchivedPaymentSourceId) {
            return
        }

        const paymentSource = await this.transactionsRepository.findActivePaymentSourceById(
            workspaceId,
            paymentSourceId,
            prisma,
        )

        if (!paymentSource) {
            throw new NotFoundException(PAYMENT_SOURCE_NOT_FOUND_MESSAGE)
        }
    }
}

function validateCreateTransactionInput(
    input: CreateTransactionCommand,
): ValidatedCreateTransactionInput {
    const errors: string[] = []
    return {
        amountCents: validateAmountValue(input.amount, errors),
        categoryId: validateRequiredIdValue(input.categoryId, 'Category id', errors),
        date: validateDateValue(input.date, errors),
        description: validateDescriptionValue(input.description, errors),
        notes: normalizeNotes(input.notes),
        paymentSourceId: validateRequiredIdValue(
            input.paymentSourceId,
            'Payment source id',
            errors,
        ),
        tags: validateTagsValue(input.tags, errors),
        errors,
    }
}

function validateListTransactionsInput(
    input: ListTransactionsCommand,
): ValidatedListTransactionsInput {
    const errors: string[] = []
    const dateFrom = validateDateFilterValue(input.dateFrom, errors, {
        fieldName: 'Date from',
        boundary: 'start',
    })
    const dateTo = validateDateFilterValue(input.dateTo, errors, {
        fieldName: 'Date to',
        boundary: 'end',
    })

    if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
        errors.push('Date from must be less than or equal to date to')
    }

    const categoryIds = validateCategoryIdsValue(input.categoryIds ?? input.categoryId, errors)
    const sortBy = validateSortField(input.sortBy)

    return {
        categoryIds,
        sortBy,
        sortDirection: getSortDirection(input.sortDirection, sortBy),
        paymentSourceId: validateOptionalIdValue(
            input.paymentSourceId,
            'Payment source id',
            errors,
        ),
        tag: validateOptionalFilterValue(input.tag, 'Tag', errors),
        dateFrom,
        dateTo,
        limit: input.limit ?? DEFAULT_TRANSACTION_LIST_LIMIT,
        offset: input.offset ?? 0,
        errors,
    }
}

function validateAmountValue(value: number, errors: string[]): number | undefined {
    return validateMoneyAmountValue(value, errors)
}

function validateDateValue(value: string, errors: string[]): Date | undefined {
    if (value.trim().length === 0) {
        errors.push('Date is required')
        return undefined
    }

    const normalizedValue = value.trim()

    if (ISO_DATE_ONLY_REGEX.test(normalizedValue)) {
        const [year, month, day] = normalizedValue
            .split('-')
            .map((part) => Number.parseInt(part, 10))
        const date = new Date(Date.UTC(year, month - 1, day))

        if (
            Number.isNaN(date.getTime()) ||
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
        ) {
            errors.push('Date must be a valid calendar date in YYYY-MM-DD format')
            return undefined
        }

        return date
    }

    errors.push('Date must be a valid calendar date in YYYY-MM-DD format')
    return undefined
}

function validateDateFilterValue(
    value: string | undefined,
    errors: string[],
    options: ParsedDateFilterOptions,
): Date | undefined {
    if (value === undefined || value === null) {
        return undefined
    }

    if (value.trim().length === 0) {
        errors.push(`${options.fieldName} must be a valid date in YYYY-MM-DD format`)
        return undefined
    }

    const normalizedValue = value.trim()

    if (ISO_DATE_ONLY_REGEX.test(normalizedValue)) {
        const [year, month, day] = normalizedValue
            .split('-')
            .map((part) => Number.parseInt(part, 10))

        const date = new Date(Date.UTC(year, month - 1, day))

        if (
            Number.isNaN(date.getTime()) ||
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
        ) {
            errors.push(`${options.fieldName} must be a valid date in YYYY-MM-DD format`)
            return undefined
        }

        return date
    }

    errors.push(`${options.fieldName} must be a valid date in YYYY-MM-DD format`)
    return undefined
}

function validateRequiredIdValue(
    value: string,
    fieldName: string,
    errors: string[],
): string | undefined {
    if (value.trim().length === 0) {
        errors.push(`${fieldName} is required`)
        return undefined
    }

    return value.trim()
}

function validateCategoryIdsValue(
    value: string | string[] | undefined,
    errors: string[],
): string[] | undefined {
    if (value === undefined || value === null) return undefined

    const values = Array.isArray(value) ? value : [value]
    const normalizedValues = Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)))

    if (normalizedValues.length === 0 || normalizedValues.length > MAX_CATEGORY_FILTERS) {
        errors.push(`Category ids must contain between 1 and ${MAX_CATEGORY_FILTERS} values`)
        return undefined
    }

    return normalizedValues
}

function validateSortField(value: TransactionSortField | undefined): TransactionSortField {
    return value ?? 'date'
}

function getSortDirection(
    value: TransactionSortDirection | undefined,
    sortBy: TransactionSortField,
): TransactionSortDirection {
    return value ?? (sortBy === 'date' ? 'desc' : 'asc')
}
function validateOptionalIdValue(
    value: string | undefined,
    fieldName: string,
    errors: string[],
): string | undefined {
    if (value === undefined || value === null) {
        return undefined
    }

    if (value.trim().length === 0) {
        errors.push(`${fieldName} must be a non-empty string`)
        return undefined
    }

    return value.trim()
}

function validateOptionalFilterValue(
    value: string | undefined,
    fieldName: string,
    errors: string[],
): string | undefined {
    if (value === undefined || value === null) {
        return undefined
    }

    if (value.trim().length === 0) {
        errors.push(`${fieldName} must be a non-empty string`)
        return undefined
    }

    return value.trim()
}

function normalizeNotes(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
        return null
    }

    const normalizedValue = value.trim()

    return normalizedValue.length > 0 ? normalizedValue : null
}

function validateDescriptionValue(value: string, errors: string[]): string | undefined {
    const normalizedValue = value.trim()

    if (normalizedValue.length === 0) {
        errors.push('Description is required')
        return undefined
    }

    if (normalizedValue.length > MAX_TRANSACTION_DESCRIPTION_LENGTH) {
        errors.push(
            `Description cannot be longer than ${MAX_TRANSACTION_DESCRIPTION_LENGTH} characters`,
        )
        return undefined
    }

    return normalizedValue
}

function validateTagsValue(value: string[] | undefined, errors: string[]): string[] {
    if (value === undefined || value === null) {
        return []
    }

    if (value.length > MAX_TAGS_PER_TRANSACTION) {
        errors.push(`Tags cannot contain more than ${MAX_TAGS_PER_TRANSACTION} items`)
    }

    const normalizedTags: string[] = []

    for (const entry of value) {
        const normalizedValue = entry.trim()

        if (normalizedValue.length === 0) {
            errors.push('Tags cannot contain empty values')
            continue
        }

        normalizedTags.push(normalizedValue)
    }

    return normalizedTags
}

function normalizeRequiredValue(value: string, fieldName: string): string {
    const normalizedValue = value.trim()

    if (normalizedValue.length === 0) {
        throw new BadRequestException(`${fieldName} is required`)
    }

    return normalizedValue
}

function mapCreateTransactionResponse(transaction: TransactionWithTags): CreateTransactionResponse {
    return {
        id: transaction.id,
        workspace_id: transaction.workspaceId,
        category_id: transaction.categoryId,
        payment_source_id: transaction.paymentSourceId,
        type: transaction.type,
        amount: convertAmountToDisplayValue(transaction.amount),
        currency: transaction.currency,
        date: transaction.date.toISOString().slice(0, 10),
        description: transaction.description,
        notes: transaction.notes,
        tags: transaction.tags.map((tag) => tag.name),
        created_at: transaction.createdAt,
        updated_at: transaction.updatedAt,
    }
}

function mapListedTransactionResponse(
    transaction: ListedTransactionRecord,
): CreateTransactionResponse {
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

function convertAmountToDisplayValue(amountInCents: number): number {
    return Number((amountInCents / 100).toFixed(2))
}
