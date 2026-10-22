import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../shared/database/prisma.service'
import { normalizeCurrency } from '../../shared/currency/currency.service'
import { parseDateOnly, validateMoneyAmountValue } from '../../shared/utils/validation'
import { MachinePrincipal } from './integration-credential.service'
import { ExternalTransactionBodyDto } from './external-transactions.dto'
import { ExternalTransactionOwnershipService } from './external-transaction-ownership.service'
import { normalizeExternalTransactionId } from './external-transaction-contract'

@Injectable()
export class ExternalTransactionsService {
    constructor(
        private readonly ownership: ExternalTransactionOwnershipService,
        private readonly prisma: PrismaService,
    ) {}

    async create(
        principal: MachinePrincipal,
        idempotencyKey: string | undefined,
        body: ExternalTransactionBodyDto,
    ) {
        const command = this.toCommand(body)
        const result = await this.ownership.createIdempotently(principal, idempotencyKey, command)
        return result.alreadyExists ?? mapTransaction(result.transaction!, result.replayed)
    }

    async get(principal: MachinePrincipal, externalId: string) {
        const transaction = await this.ownership.findOwnedTransaction(
            principal,
            normalizeExternalTransactionId(externalId),
        )
        return mapTransaction(transaction)
    }

    async update(
        principal: MachinePrincipal,
        idempotencyKey: string,
        externalId: string,
        expectedVersion: number,
        body: ExternalTransactionBodyDto,
    ) {
        if (
            body.external_id !== undefined &&
            normalizeExternalTransactionId(body.external_id ?? '') !==
                normalizeExternalTransactionId(externalId)
        ) {
            throw new BadRequestException('External id cannot be changed')
        }
        const command = this.toCommand({
            ...body,
            external_id: normalizeExternalTransactionId(externalId),
        })
        const result = await this.ownership.updateIdempotently(
            principal,
            idempotencyKey,
            expectedVersion,
            command,
        )
        return mapTransaction(result.transaction!, result.replayed)
    }

    async remove(
        principal: MachinePrincipal,
        idempotencyKey: string,
        externalId: string,
        expectedVersion: number,
    ) {
        return this.ownership.deleteIdempotently(
            principal,
            idempotencyKey,
            normalizeExternalTransactionId(externalId),
            expectedVersion,
        )
    }

    async listCategories(principal: MachinePrincipal) {
        const rows = await this.prisma.category.findMany({
            where: {
                workspaceId: principal.workspaceId,
                deletedAt: null,
                ...(principal.categoryAllowlistEnabled
                    ? { id: { in: [...principal.allowedCategoryIds] } }
                    : {}),
            },
            select: {
                id: true,
                name: true,
                type: true,
                systemKey: true,
                parentId: true,
                parent: { select: { id: true, deletedAt: true } },
                icon: true,
                color: true,
                sortOrder: true,
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        })
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            type: row.type,
            system_key: row.systemKey,
            parent_id:
                row.parent &&
                !row.parent.deletedAt &&
                (!principal.categoryAllowlistEnabled ||
                    principal.allowedCategoryIds.includes(row.parent.id))
                    ? row.parentId
                    : null,
            icon: row.icon,
            color: row.color,
            sort_order: row.sortOrder,
        }))
    }

    async listPaymentSources(principal: MachinePrincipal) {
        const rows = await this.prisma.paymentSource.findMany({
            where: {
                workspaceId: principal.workspaceId,
                deletedAt: null,
                ...(principal.paymentSourceAllowlistEnabled
                    ? { id: { in: [...principal.allowedPaymentSourceIds] } }
                    : {}),
            },
            select: { id: true, name: true, type: true, systemKey: true },
            orderBy: { name: 'asc' },
        })
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            type: row.type,
            system_key: row.systemKey,
        }))
    }

    private toCommand(body: ExternalTransactionBodyDto) {
        if (typeof body.amount !== 'string' || !/^\d+\.\d{2}$/.test(body.amount))
            throw new BadRequestException('Amount must be a positive fixed two-decimal string')
        const errors: string[] = []
        const amount = validateMoneyAmountValue(body.amount, errors)
        if (!amount || errors.length) throw new BadRequestException(errors)
        const date = parseDate(body.date)
        const currency = normalizeCurrency(body.currency)
        return {
            externalId:
                body.external_id == null ? null : normalizeExternalTransactionId(body.external_id),
            type: body.type ?? 'expense',
            amount,
            currency,
            date,
            description: body.description,
            notes: body.notes ?? null,
            tags: body.tags ?? [],
            categoryId: body.category_id,
            paymentSourceId: body.payment_source_id,
        } as const
    }
}

function parseDate(value: string): Date {
    const date = parseDateOnly(value)
    if (!date)
        throw new BadRequestException('Date must be a valid calendar date in YYYY-MM-DD format')
    return date
}

function mapTransaction(
    transaction: {
        id: string
        externalId: string | null
        version: number
        categoryId: string | null
        paymentSourceId: string
        type: string
        amount: number
        currency: string
        date: Date
        description: string
        notes: string | null
        tags: Array<{ name: string }>
        createdAt: Date
        updatedAt: Date
    },
    replayed = false,
) {
    return {
        id: transaction.id,
        external_id: transaction.externalId,
        version: transaction.version,
        category_id: transaction.categoryId,
        payment_source_id: transaction.paymentSourceId,
        type: transaction.type,
        amount: (transaction.amount / 100).toFixed(2),
        currency: transaction.currency,
        date: transaction.date.toISOString().slice(0, 10),
        description: transaction.description,
        notes: transaction.notes,
        tags: transaction.tags.map((tag) => tag.name),
        created_at: transaction.createdAt,
        updated_at: transaction.updatedAt,
        replayed,
    }
}
