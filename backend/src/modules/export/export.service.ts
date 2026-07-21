import { BadRequestException, Injectable } from '@nestjs/common'
import {
    ExportTransactionRecord,
    ListTransactionsForExportQuery,
    TransactionsRepository,
} from '../transactions/transactions.repository'

const DEFAULT_EXPORT_BATCH_SIZE = 500
const ISO_DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/

export const SUPPORTED_EXPORT_FORMATS = ['csv', 'json'] as const

export type ExportFormat = (typeof SUPPORTED_EXPORT_FORMATS)[number]

interface ParsedDateFilterOptions {
    fieldName: string
    boundary: 'start' | 'end'
}

interface ValidatedExportTransactionsInput {
    format: ExportFormat
    dateFrom?: Date
    dateTo?: Date
    errors: string[]
}

export interface ExportTransactionsCommand {
    format: ExportFormat
    dateFrom?: string
    dateTo?: string
}

export interface ExportedTransaction {
    date: string
    amount: string
    currency: string
    base_amount: string
    base_currency: string
    fx_rate: string
    fx_rate_date: string
    fx_source: string
    category: string
    description: string
    notes: string | null
    tags: string[]
    payment_source: string | null
}

export interface TransactionExportFile {
    contentType: string
    contentDisposition: string
    chunks: AsyncIterable<string>
}

@Injectable()
export class ExportService {
    constructor(private readonly transactionsRepository: TransactionsRepository) {}

    async exportTransactions(
        input: ExportTransactionsCommand,
        workspaceId: string,
    ): Promise<TransactionExportFile> {
        const normalizedWorkspaceId = normalizeRequiredValue(workspaceId, 'Workspace id')
        const validatedInput = validateExportTransactionsInput(input)

        if (validatedInput.errors.length > 0 || !validatedInput.format) {
            throw new BadRequestException(validatedInput.errors)
        }

        const filters: ListTransactionsForExportQuery = {
            workspaceId: normalizedWorkspaceId,
            dateFrom: validatedInput.dateFrom,
            dateTo: validatedInput.dateTo,
            limit: DEFAULT_EXPORT_BATCH_SIZE,
            offset: 0,
        }
        const fileName = buildExportFileName(validatedInput.format)

        return {
            contentType: getContentType(validatedInput.format),
            contentDisposition: `attachment; filename="${fileName}"`,
            chunks:
                validatedInput.format === 'csv'
                    ? this.createCsvExportChunks(filters)
                    : this.createJsonExportChunks(filters),
        }
    }

    private async *createCsvExportChunks(
        filters: ListTransactionsForExportQuery,
    ): AsyncIterable<string> {
        yield 'date,amount,currency,base_amount,base_currency,fx_rate,fx_rate_date,fx_source,category,description,notes,tags,payment_source\n'

        for await (const transaction of this.streamTransactions(filters)) {
            yield `${serializeCsvRow(transaction)}\n`
        }
    }

    private async *createJsonExportChunks(
        filters: ListTransactionsForExportQuery,
    ): AsyncIterable<string> {
        let hasTransactions = false

        yield '['

        for await (const transaction of this.streamTransactions(filters)) {
            yield `${hasTransactions ? ',' : ''}${JSON.stringify(transaction)}`
            hasTransactions = true
        }

        yield ']'
    }

    private async *streamTransactions(
        filters: ListTransactionsForExportQuery,
    ): AsyncIterable<ExportedTransaction> {
        let offset = filters.offset

        while (true) {
            const batch = await this.transactionsRepository.listTransactionsForExport({
                ...filters,
                offset,
            })

            if (batch.length === 0) {
                return
            }

            for (const transaction of batch) {
                yield mapExportTransaction(transaction)
            }

            if (batch.length < filters.limit) {
                return
            }

            offset += batch.length
        }
    }
}

function validateExportTransactionsInput(
    input: ExportTransactionsCommand,
): ValidatedExportTransactionsInput {
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

    return {
        format: input.format,
        dateFrom,
        dateTo,
        errors,
    }
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

function normalizeRequiredValue(value: string, fieldName: string): string {
    const normalizedValue = value.trim()

    if (normalizedValue.length === 0) {
        throw new BadRequestException(`${fieldName} is required`)
    }

    return normalizedValue
}

function getContentType(format: ExportFormat): string {
    return format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8'
}

function buildExportFileName(format: ExportFormat): string {
    const datePart = new Date().toISOString().slice(0, 10)

    return `transactions-export-${datePart}.${format}`
}

function mapExportTransaction(transaction: ExportTransactionRecord): ExportedTransaction {
    return {
        date: transaction.date.toISOString().slice(0, 10),
        amount: formatAmountFromCents(transaction.amount),
        currency: transaction.currency,
        base_amount: formatAmountFromCents(transaction.base_amount),
        base_currency: transaction.base_currency,
        fx_rate: transaction.fx_rate.toString(),
        fx_rate_date: transaction.fx_rate_date.toISOString().slice(0, 10),
        fx_source: transaction.fx_source,
        category: transaction.category ?? '',
        description: transaction.description,
        notes: transaction.notes,
        tags: transaction.tags,
        payment_source: transaction.payment_source,
    }
}

function serializeCsvRow(transaction: ExportedTransaction): string {
    return [
        transaction.date,
        transaction.amount,
        transaction.currency,
        transaction.base_amount,
        transaction.base_currency,
        transaction.fx_rate,
        transaction.fx_rate_date,
        transaction.fx_source,
        transaction.category,
        transaction.description,
        transaction.notes ?? '',
        transaction.tags.join(', '),
        transaction.payment_source ?? '',
    ]
        .map((value) => escapeCsvValue(value))
        .join(',')
}

function escapeCsvValue(value: string): string {
    const normalizedValue = sanitizeSpreadsheetFormula(value)
    const escapedValue = normalizedValue.replace(/"/g, '""')

    if (normalizedValue !== value || /[",\r\n]/.test(normalizedValue)) {
        return `"${escapedValue}"`
    }

    return escapedValue
}

function sanitizeSpreadsheetFormula(value: string): string {
    const trimmedLeadingValue = value.trimStart()

    if (trimmedLeadingValue.length > 0 && /^[=+\-@]/.test(trimmedLeadingValue)) {
        return `'${value}`
    }

    return value
}

function formatAmountFromCents(amountInCents: number): string {
    const sign = amountInCents < 0 ? '-' : ''
    const absoluteAmount = Math.abs(amountInCents)
    const wholeUnits = Math.floor(absoluteAmount / 100)
    const fractionalUnits = (absoluteAmount % 100).toString().padStart(2, '0')

    return `${sign}${wholeUnits}.${fractionalUnits}`
}
