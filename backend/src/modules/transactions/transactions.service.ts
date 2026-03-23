import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../shared/database/prisma.service'
import {
    ListedTransactionRecord,
    ListTransactionsFilters,
    TransactionWithTags,
    TransactionsPersistenceClient,
    TransactionsRepository,
} from './transactions.repository'

const CATEGORY_NOT_FOUND_MESSAGE = 'Category not found'
const DEFAULT_TRANSACTION_CURRENCY = 'USD'
const EXPENSE_TRANSACTION_TYPE = 'expense'
const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATE_TIME_REGEX =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/
const DEFAULT_TRANSACTION_LIST_LIMIT = 20
const MAX_TRANSACTION_LIST_LIMIT = 100
const MAX_TAGS_PER_TRANSACTION = 10
const PAYMENT_SOURCE_NOT_FOUND_MESSAGE = 'Payment source not found'
const TRANSACTION_NOT_FOUND_MESSAGE = 'Transaction not found'

export interface CreateTransactionRequestInput {
    amount?: unknown
    date?: unknown
    category_id?: unknown
    notes?: unknown
    tags?: unknown
    payment_source_id?: unknown
}

export interface CreateTransactionResponse {
    id: string
    workspace_id: string
    category_id: string
    payment_source_id: string | null
    type: string
    amount: number
    currency: string
    date: Date
    notes: string | null
    tags: string[]
    created_at: Date
    updated_at: Date
}

export interface ListTransactionsRequestInput {
    category_id?: unknown
    payment_source_id?: unknown
    tag?: unknown
    date_from?: unknown
    date_to?: unknown
    limit?: unknown
    offset?: unknown
}

export interface ListTransactionsResponse {
    data: CreateTransactionResponse[]
    total: number
    limit: number
    offset: number
}

interface ValidatedListTransactionsInput {
    categoryId?: string
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
    ) {}

    async createTransaction(
        input: CreateTransactionRequestInput,
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
            !validatedInput.date
        ) {
            throw new BadRequestException(validatedInput.errors)
        }

        const amountCents = validatedInput.amountCents
        const categoryId = validatedInput.categoryId
        const transactionDate = validatedInput.date

        return this.prisma.$transaction(async (tx) => {
            await this.assertValidTransactionReferences(
                normalizedWorkspaceId,
                categoryId,
                validatedInput.paymentSourceId,
                tx,
            )

            const transaction = await this.transactionsRepository.createTransactionWithTags(
                {
                    workspaceId: normalizedWorkspaceId,
                    userId: normalizedUserId,
                    categoryId,
                    paymentSourceId: validatedInput.paymentSourceId,
                    type: EXPENSE_TRANSACTION_TYPE,
                    amount: amountCents,
                    currency: DEFAULT_TRANSACTION_CURRENCY,
                    date: transactionDate,
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
        input: CreateTransactionRequestInput,
        transactionId: string,
        workspaceId: string,
    ): Promise<CreateTransactionResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const normalizedTransactionId = normalizeRequiredValue(transactionId, 'Transaction id')
        const validatedInput = validateCreateTransactionInput(input)

        if (
            validatedInput.errors.length > 0 ||
            typeof validatedInput.amountCents !== 'number' ||
            !validatedInput.categoryId ||
            !validatedInput.date
        ) {
            throw new BadRequestException(validatedInput.errors)
        }

        const amountCents = validatedInput.amountCents
        const categoryId = validatedInput.categoryId
        const transactionDate = validatedInput.date

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
                validatedInput.paymentSourceId,
                tx,
            )

            const transaction = await this.transactionsRepository.updateTransactionWithTags(
                {
                    workspaceId: normalizedWorkspaceId,
                    transactionId: normalizedTransactionId,
                    categoryId,
                    paymentSourceId: validatedInput.paymentSourceId,
                    type: EXPENSE_TRANSACTION_TYPE,
                    amount: amountCents,
                    currency: DEFAULT_TRANSACTION_CURRENCY,
                    date: transactionDate,
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
        input: ListTransactionsRequestInput,
        workspaceId: string,
    ): Promise<ListTransactionsResponse> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const validatedInput = validateListTransactionsInput(input)

        if (validatedInput.errors.length > 0) {
            throw new BadRequestException(validatedInput.errors)
        }

        const filters: ListTransactionsFilters = {
            workspaceId: normalizedWorkspaceId,
            categoryId: validatedInput.categoryId,
            paymentSourceId: validatedInput.paymentSourceId,
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
        paymentSourceId: string | undefined,
        prisma: TransactionsPersistenceClient,
    ): Promise<void> {
        const category = await this.transactionsRepository.findCategoryById(
            workspaceId,
            categoryId,
            prisma,
        )

        if (!category) {
            throw new NotFoundException(CATEGORY_NOT_FOUND_MESSAGE)
        }

        if (!paymentSourceId) {
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
    input: CreateTransactionRequestInput,
): ValidatedCreateTransactionInput {
    const errors: string[] = []
    const notesValidation = validateNotesValue(input.notes)

    if (notesValidation.error) {
        errors.push(notesValidation.error)
    }

    return {
        amountCents: validateAmountValue(input.amount, errors),
        categoryId: validateRequiredIdValue(input.category_id, 'Category id', errors),
        date: validateDateValue(input.date, errors),
        notes: notesValidation.notes,
        paymentSourceId: validateOptionalIdValue(
            input.payment_source_id,
            'Payment source id',
            errors,
        ),
        tags: validateTagsValue(input.tags, errors),
        errors,
    }
}

function validateListTransactionsInput(
    input: ListTransactionsRequestInput,
): ValidatedListTransactionsInput {
    const errors: string[] = []
    const dateFrom = validateDateFilterValue(input.date_from, errors, {
        fieldName: 'Date from',
        boundary: 'start',
    })
    const dateTo = validateDateFilterValue(input.date_to, errors, {
        fieldName: 'Date to',
        boundary: 'end',
    })

    if (dateFrom && dateTo && dateFrom.getTime() > dateTo.getTime()) {
        errors.push('Date from must be less than or equal to date to')
    }

    return {
        categoryId: validateOptionalIdValue(input.category_id, 'Category id', errors),
        paymentSourceId: validateOptionalIdValue(
            input.payment_source_id,
            'Payment source id',
            errors,
        ),
        tag: validateOptionalFilterValue(input.tag, 'Tag', errors),
        dateFrom,
        dateTo,
        limit: validateLimitValue(input.limit, errors),
        offset: validateOffsetValue(input.offset, errors),
        errors,
    }
}

function validateAmountValue(value: unknown, errors: string[]): number | undefined {
    if (value === undefined || value === null) {
        errors.push('Amount is required')
        return undefined
    }

    let normalizedValue: string

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            errors.push('Amount must be a valid number')
            return undefined
        }

        normalizedValue = value.toString()
    } else if (typeof value === 'string') {
        normalizedValue = value.trim()

        if (normalizedValue.length === 0) {
            errors.push('Amount is required')
            return undefined
        }
    } else {
        errors.push('Amount must be a positive number with up to 2 decimal places')
        return undefined
    }

    if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedValue)) {
        errors.push('Amount must be a positive number with up to 2 decimal places')
        return undefined
    }

    const [wholePart, fractionalPart = ''] = normalizedValue.split('.')
    const amountCents =
        Number.parseInt(wholePart, 10) * 100 +
        Number.parseInt(fractionalPart.padEnd(2, '0') || '0', 10)

    if (amountCents <= 0) {
        errors.push('Amount must be greater than 0')
        return undefined
    }

    return amountCents
}

function validateDateValue(value: unknown, errors: string[]): Date | undefined {
    if (typeof value !== 'string' || value.trim().length === 0) {
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
            errors.push('Date must be a valid ISO 8601 value')
            return undefined
        }

        return date
    }

    if (!ISO_DATE_TIME_REGEX.test(normalizedValue)) {
        errors.push('Date must be a valid ISO 8601 value')
        return undefined
    }

    const date = new Date(normalizedValue)

    if (Number.isNaN(date.getTime())) {
        errors.push('Date must be a valid ISO 8601 value')
        return undefined
    }

    return date
}

function validateDateFilterValue(
    value: unknown,
    errors: string[],
    options: ParsedDateFilterOptions,
): Date | undefined {
    if (value === undefined || value === null) {
        return undefined
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push(`${options.fieldName} must be a valid ISO 8601 value`)
        return undefined
    }

    const normalizedValue = value.trim()

    if (ISO_DATE_ONLY_REGEX.test(normalizedValue)) {
        const [year, month, day] = normalizedValue
            .split('-')
            .map((part) => Number.parseInt(part, 10))

        const hour = options.boundary === 'end' ? 23 : 0
        const minute = options.boundary === 'end' ? 59 : 0
        const second = options.boundary === 'end' ? 59 : 0
        const millisecond = options.boundary === 'end' ? 999 : 0
        const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond))

        if (
            Number.isNaN(date.getTime()) ||
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
        ) {
            errors.push(`${options.fieldName} must be a valid ISO 8601 value`)
            return undefined
        }

        return date
    }

    if (!ISO_DATE_TIME_REGEX.test(normalizedValue)) {
        errors.push(`${options.fieldName} must be a valid ISO 8601 value`)
        return undefined
    }

    const date = new Date(normalizedValue)

    if (Number.isNaN(date.getTime())) {
        errors.push(`${options.fieldName} must be a valid ISO 8601 value`)
        return undefined
    }

    return date
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

function validateOptionalIdValue(
    value: unknown,
    fieldName: string,
    errors: string[],
): string | undefined {
    if (value === undefined || value === null) {
        return undefined
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push(`${fieldName} must be a non-empty string`)
        return undefined
    }

    return value.trim()
}

function validateOptionalFilterValue(
    value: unknown,
    fieldName: string,
    errors: string[],
): string | undefined {
    if (value === undefined || value === null) {
        return undefined
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
        errors.push(`${fieldName} must be a non-empty string`)
        return undefined
    }

    return value.trim()
}

function validateLimitValue(value: unknown, errors: string[]): number {
    if (value === undefined || value === null) {
        return DEFAULT_TRANSACTION_LIST_LIMIT
    }

    const normalizedValue = normalizeNumericQueryValue(value)

    if (!normalizedValue || !/^\d+$/.test(normalizedValue)) {
        errors.push(`Limit must be an integer between 1 and ${MAX_TRANSACTION_LIST_LIMIT}`)
        return DEFAULT_TRANSACTION_LIST_LIMIT
    }

    const limit = Number.parseInt(normalizedValue, 10)

    if (limit < 1 || limit > MAX_TRANSACTION_LIST_LIMIT) {
        errors.push(`Limit must be an integer between 1 and ${MAX_TRANSACTION_LIST_LIMIT}`)
        return DEFAULT_TRANSACTION_LIST_LIMIT
    }

    return limit
}

function validateOffsetValue(value: unknown, errors: string[]): number {
    if (value === undefined || value === null) {
        return 0
    }

    const normalizedValue = normalizeNumericQueryValue(value)

    if (!normalizedValue || !/^\d+$/.test(normalizedValue)) {
        errors.push('Offset must be a non-negative integer')
        return 0
    }

    return Number.parseInt(normalizedValue, 10)
}

function normalizeNumericQueryValue(value: unknown): string | null {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value.toString() : null
    }

    if (typeof value !== 'string') {
        return null
    }

    const normalizedValue = value.trim()

    return normalizedValue.length > 0 ? normalizedValue : null
}

function validateNotesValue(value: unknown): { notes: string | null; error?: string } {
    if (value === undefined || value === null) {
        return {
            notes: null,
        }
    }

    if (typeof value !== 'string') {
        return {
            notes: null,
            error: 'Notes must be a string',
        }
    }

    const normalizedValue = value.trim()

    return {
        notes: normalizedValue.length > 0 ? normalizedValue : null,
    }
}

function validateTagsValue(value: unknown, errors: string[]): string[] {
    if (value === undefined || value === null) {
        return []
    }

    if (!Array.isArray(value)) {
        errors.push('Tags must be an array of strings')
        return []
    }

    if (value.length > MAX_TAGS_PER_TRANSACTION) {
        errors.push(`Tags cannot contain more than ${MAX_TAGS_PER_TRANSACTION} items`)
    }

    const normalizedTags: string[] = []

    for (const entry of value) {
        if (typeof entry !== 'string') {
            errors.push('Tags must be an array of strings')
            continue
        }

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
        date: transaction.date,
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
        payment_source_id: transaction.payment_source_id,
        type: transaction.type,
        amount: convertAmountToDisplayValue(transaction.amount),
        currency: transaction.currency,
        date: transaction.date,
        notes: transaction.notes,
        tags: transaction.tags,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
    }
}

function convertAmountToDisplayValue(amountInCents: number): number {
    return Number((amountInCents / 100).toFixed(2))
}
