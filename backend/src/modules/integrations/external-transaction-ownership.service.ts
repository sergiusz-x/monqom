import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
    PreconditionFailedException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { createHash } from 'crypto'
import { PrismaService } from '../../shared/database/prisma.service'
import { AuditService } from '../../shared/audit/audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../shared/audit/audit.types'
import {
    TransactionWithTags,
    TransactionsPersistenceClient,
    TransactionsRepository,
} from '../transactions/transactions.repository'
import { MachinePrincipal } from './integration-credential.service'

const IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
const IDEMPOTENCY_KEY_PATTERN = /^[\x21-\x7e]{16,128}$/
const MAX_EXTERNAL_ID_BYTES = 200

export interface ExternalTransactionCreateCommand {
    externalId: string
    type: 'expense' | 'income'
    amount: number
    currency: string
    baseAmount?: number
    fxRate?: number
    fxRateDate?: Date
    fxSource?: string
    date: Date
    description: string
    notes: string | null
    tags: string[]
    categoryId: string
    paymentSourceId: string
}

export interface ExternalTransactionCreateResult {
    transaction: TransactionWithTags
    replayed: boolean
}

interface IdempotencyClaim {
    integrationId: string
    key: string
    operation: 'create' | 'update' | 'delete'
    targetExternalId: string
    fingerprint: string
}

class ExistingIdempotencyClaimError extends Error {}

/** HTTP-free persistence boundary for durable integration-owned transactions. */
@Injectable()
export class ExternalTransactionOwnershipService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly transactionsRepository: TransactionsRepository,
        private readonly auditService: AuditService,
    ) {}

    async createIdempotently(
        principal: MachinePrincipal,
        idempotencyKey: string,
        input: ExternalTransactionCreateCommand,
        now = new Date(),
    ): Promise<ExternalTransactionCreateResult> {
        const command = normalizeCreateCommand(input)
        const claim: IdempotencyClaim = {
            integrationId: principal.integrationId,
            key: normalizeIdempotencyKey(idempotencyKey),
            operation: 'create',
            targetExternalId: command.externalId,
            fingerprint: fingerprintExternalTransactionCreate(command),
        }

        try {
            return await this.prisma.$transaction(async (tx) => {
                const record = await this.createIdempotencyClaim(tx, claim, now)
                await this.assertAllowedReferences(principal, command, tx)
                const transaction = await this.transactionsRepository.createTransactionWithTags(
                    {
                        workspaceId: principal.workspaceId,
                        integrationId: principal.integrationId,
                        externalId: command.externalId,
                        categoryId: command.categoryId,
                        paymentSourceId: command.paymentSourceId,
                        type: command.type,
                        amount: command.amount,
                        currency: command.currency,
                        baseAmount: command.baseAmount,
                        fxRate: command.fxRate,
                        fxRateDate: command.fxRateDate,
                        fxSource: command.fxSource,
                        date: command.date,
                        description: command.description,
                        notes: command.notes,
                        tags: command.tags,
                        auditMetadata: machineAuditMetadata(principal),
                    },
                    tx,
                )
                await tx.integrationIdempotencyRecord.update({
                    where: { id: record.id },
                    data: {
                        status: 'completed',
                        responseStatus: 201,
                        responseBody: serializeTransaction(transaction),
                    },
                })
                return { transaction, replayed: false }
            })
        } catch (error) {
            if (error instanceof ExistingIdempotencyClaimError)
                return this.replayCompletedClaim(claim)
            if (isUniqueConstraint(error))
                throw new ConflictException('External transaction already exists')
            throw error
        }
    }

    async updateIdempotently(
        principal: MachinePrincipal,
        idempotencyKey: string,
        expectedVersion: number,
        input: ExternalTransactionCreateCommand,
        now = new Date(),
    ): Promise<ExternalTransactionCreateResult> {
        const command = normalizeCreateCommand(input)
        const claim: IdempotencyClaim = {
            integrationId: principal.integrationId,
            key: normalizeIdempotencyKey(idempotencyKey),
            operation: 'update',
            targetExternalId: command.externalId,
            fingerprint: fingerprintExternalTransactionUpdate(command, expectedVersion),
        }
        try {
            return await this.prisma.$transaction(async (tx) => {
                const record = await this.createIdempotencyClaim(tx, claim, now)
                const existing = await this.findOwnedTransaction(
                    principal.workspaceId,
                    principal.integrationId,
                    command.externalId,
                    tx,
                )
                if (existing.version !== expectedVersion)
                    throw new PreconditionFailedException('Transaction version does not match')
                await this.assertAllowedReferences(principal, command, tx)
                const transaction = await this.transactionsRepository.updateTransactionWithTags(
                    {
                        workspaceId: principal.workspaceId,
                        transactionId: existing.id,
                        expectedVersion,
                        categoryId: command.categoryId,
                        paymentSourceId: command.paymentSourceId,
                        type: command.type,
                        amount: command.amount,
                        currency: command.currency,
                        baseAmount: command.baseAmount,
                        fxRate: command.fxRate,
                        fxRateDate: command.fxRateDate,
                        fxSource: command.fxSource,
                        date: command.date,
                        description: command.description,
                        notes: command.notes,
                        tags: command.tags,
                    },
                    tx,
                )
                if (!transaction)
                    throw new PreconditionFailedException('Transaction version does not match')
                await this.auditService.record(
                    {
                        action: AUDIT_ACTIONS.TRANSACTION_UPDATED,
                        workspaceId: principal.workspaceId,
                        entityType: AUDIT_ENTITY_TYPES.TRANSACTION,
                        entityId: transaction.id,
                        metadata: {
                            ...machineAuditMetadata(principal),
                            external_id: command.externalId,
                            previous_version: existing.version,
                            version: transaction.version,
                        },
                    },
                    tx,
                )
                await tx.integrationIdempotencyRecord.update({
                    where: { id: record.id },
                    data: {
                        status: 'completed',
                        responseStatus: 200,
                        responseBody: serializeTransaction(transaction),
                    },
                })
                return { transaction, replayed: false }
            })
        } catch (error) {
            if (error instanceof ExistingIdempotencyClaimError)
                return this.replayCompletedClaim(claim)
            throw error
        }
    }

    async deleteIdempotently(
        principal: MachinePrincipal,
        idempotencyKey: string,
        externalId: string,
        expectedVersion: number,
        now = new Date(),
    ): Promise<{ replayed: boolean }> {
        const normalizedExternalId = normalizeExternalId(externalId)
        const claim: IdempotencyClaim = {
            integrationId: principal.integrationId,
            key: normalizeIdempotencyKey(idempotencyKey),
            operation: 'delete',
            targetExternalId: normalizedExternalId,
            fingerprint: fingerprintExternalTransactionDelete(
                normalizedExternalId,
                expectedVersion,
            ),
        }
        try {
            return await this.prisma.$transaction(async (tx) => {
                const record = await this.createIdempotencyClaim(tx, claim, now)
                const existing = await this.findOwnedTransaction(
                    principal.workspaceId,
                    principal.integrationId,
                    normalizedExternalId,
                    tx,
                )
                if (existing.version !== expectedVersion)
                    throw new PreconditionFailedException('Transaction version does not match')
                const deleted = await tx.transaction.updateMany({
                    where: {
                        id: existing.id,
                        workspaceId: principal.workspaceId,
                        integrationId: principal.integrationId,
                        externalId: normalizedExternalId,
                        version: expectedVersion,
                        deletedAt: null,
                    },
                    data: { deletedAt: now, version: { increment: 1 } },
                })
                if (deleted.count !== 1)
                    throw new PreconditionFailedException('Transaction version does not match')
                await this.auditService.record(
                    {
                        action: AUDIT_ACTIONS.TRANSACTION_DELETED,
                        workspaceId: principal.workspaceId,
                        entityType: AUDIT_ENTITY_TYPES.TRANSACTION,
                        entityId: existing.id,
                        metadata: {
                            ...machineAuditMetadata(principal),
                            external_id: normalizedExternalId,
                            version: expectedVersion,
                        },
                    },
                    tx,
                )
                await tx.integrationIdempotencyRecord.update({
                    where: { id: record.id },
                    data: {
                        status: 'completed',
                        responseStatus: 204,
                        responseBody: { deleted: true },
                    },
                })
                return { replayed: false }
            })
        } catch (error) {
            if (error instanceof ExistingIdempotencyClaimError) {
                await this.assertCompletedReplay(claim)
                return { replayed: true }
            }
            throw error
        }
    }

    async findOwnedTransaction(
        workspaceId: string,
        integrationId: string,
        externalId: string,
        prisma: TransactionsPersistenceClient = this.prisma,
    ): Promise<TransactionWithTags> {
        const transaction = await prisma.transaction.findFirst({
            where: { workspaceId, integrationId, externalId, deletedAt: null },
            include: { tags: { orderBy: { name: 'asc' } } },
        })
        if (!transaction) throw new NotFoundException('Transaction not found')
        return transaction
    }

    /** Future update endpoint seam; this predicate cannot target manual or foreign rows. */
    async updateOwnedTransaction(
        workspaceId: string,
        integrationId: string,
        externalId: string,
        data: Prisma.TransactionUpdateManyMutationInput,
        prisma: TransactionsPersistenceClient = this.prisma,
    ): Promise<boolean> {
        const result = await prisma.transaction.updateMany({
            where: { workspaceId, integrationId, externalId, deletedAt: null },
            data,
        })
        return result.count === 1
    }

    /** Future delete endpoint seam; soft deletion intentionally does not release the external id. */
    async softDeleteOwnedTransaction(
        workspaceId: string,
        integrationId: string,
        externalId: string,
        now = new Date(),
        prisma: TransactionsPersistenceClient = this.prisma,
    ): Promise<boolean> {
        const result = await prisma.transaction.updateMany({
            where: { workspaceId, integrationId, externalId, deletedAt: null },
            data: { deletedAt: now },
        })
        return result.count === 1
    }

    async cleanupExpiredIdempotency(now = new Date()): Promise<number> {
        const result = await this.prisma.integrationIdempotencyRecord.deleteMany({
            where: { status: 'completed', expiresAt: { lte: now } },
        })
        return result.count
    }

    private async createIdempotencyClaim(
        tx: Prisma.TransactionClient,
        claim: IdempotencyClaim,
        now: Date,
    ) {
        try {
            return await tx.integrationIdempotencyRecord.create({
                data: {
                    integrationId: claim.integrationId,
                    keyDigest: digestIdempotencyKey(claim.key),
                    operation: claim.operation,
                    targetExternalId: claim.targetExternalId,
                    requestFingerprint: claim.fingerprint,
                    status: 'in_progress',
                    expiresAt: new Date(now.getTime() + IDEMPOTENCY_RETENTION_MS),
                },
            })
        } catch (error) {
            if (isUniqueConstraint(error)) throw new ExistingIdempotencyClaimError()
            throw error
        }
    }

    private async replayCompletedClaim(
        claim: IdempotencyClaim,
    ): Promise<ExternalTransactionCreateResult> {
        const record = await this.assertCompletedReplay(claim)
        return { transaction: deserializeTransaction(record.responseBody), replayed: true }
    }

    private async assertCompletedReplay(claim: IdempotencyClaim) {
        const record = await this.prisma.integrationIdempotencyRecord.findUnique({
            where: {
                integrationId_keyDigest: {
                    integrationId: claim.integrationId,
                    keyDigest: digestIdempotencyKey(claim.key),
                },
            },
        })
        if (
            !record ||
            record.operation !== claim.operation ||
            record.targetExternalId !== claim.targetExternalId ||
            record.requestFingerprint !== claim.fingerprint
        ) {
            throw new ConflictException('Idempotency key conflicts with a different request')
        }
        if (record.status !== 'completed')
            throw new ConflictException('Idempotency request is in progress')
        return record
    }

    private async assertAllowedReferences(
        principal: MachinePrincipal,
        command: ExternalTransactionCreateCommand,
        tx: Prisma.TransactionClient,
    ): Promise<void> {
        const category = await this.transactionsRepository.findCategoryById(
            principal.workspaceId,
            command.categoryId,
            tx,
        )
        if (!category || category.type !== command.type)
            throw new NotFoundException('Category not found')
        const paymentSource = await this.transactionsRepository.findActivePaymentSourceById(
            principal.workspaceId,
            command.paymentSourceId,
            tx,
        )
        if (!paymentSource) throw new NotFoundException('Payment source not found')
        if (
            (principal.categoryAllowlistEnabled &&
                !principal.allowedCategoryIds.includes(command.categoryId)) ||
            (principal.paymentSourceAllowlistEnabled &&
                !principal.allowedPaymentSourceIds.includes(command.paymentSourceId))
        ) {
            throw new NotFoundException('Transaction reference not found')
        }
    }
}

export function digestIdempotencyKey(key: string): string {
    return createHash('sha256')
        .update(`monqom-integration-idempotency:v1:${key}`, 'utf8')
        .digest('hex')
}

export function fingerprintExternalTransactionCreate(
    input: ExternalTransactionCreateCommand,
): string {
    return createHash('sha256')
        .update(stableJson(normalizeCreateCommand(input)), 'utf8')
        .digest('hex')
}

export function fingerprintExternalTransactionUpdate(
    input: ExternalTransactionCreateCommand,
    expectedVersion: number,
): string {
    return createHash('sha256')
        .update(stableJson({ ...normalizeCreateCommand(input), expectedVersion }), 'utf8')
        .digest('hex')
}

export function fingerprintExternalTransactionDelete(
    externalId: string,
    expectedVersion: number,
): string {
    return createHash('sha256')
        .update(stableJson({ externalId, expectedVersion }), 'utf8')
        .digest('hex')
}

function normalizeIdempotencyKey(value: string): string {
    if (typeof value !== 'string' || !IDEMPOTENCY_KEY_PATTERN.test(value)) {
        throw new BadRequestException(
            'Idempotency-Key must contain 16 to 128 visible ASCII characters',
        )
    }
    return value
}

function normalizeCreateCommand(
    input: ExternalTransactionCreateCommand,
): ExternalTransactionCreateCommand {
    const externalId = input.externalId?.trim()
    if (!externalId || Buffer.byteLength(externalId, 'utf8') > MAX_EXTERNAL_ID_BYTES)
        throw new BadRequestException('External id must contain between 1 and 200 UTF-8 bytes')
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
        throw new BadRequestException('Amount must be a positive integer in minor units')
    if (input.type !== 'expense' && input.type !== 'income')
        throw new BadRequestException('Transaction type is invalid')
    if (!(input.date instanceof Date) || Number.isNaN(input.date.getTime()))
        throw new BadRequestException('Transaction date is invalid')
    const categoryId = input.categoryId?.trim()
    const paymentSourceId = input.paymentSourceId?.trim()
    const description = input.description?.trim()
    const currency = input.currency?.trim().toUpperCase()
    if (!categoryId || !paymentSourceId || !description || !/^[A-Z]{3}$/.test(currency))
        throw new BadRequestException('Transaction fields are invalid')
    return {
        ...input,
        externalId,
        categoryId,
        paymentSourceId,
        description,
        currency,
        notes: input.notes?.trim() || null,
        tags: [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))].sort(),
    }
}

function normalizeExternalId(value: string): string {
    const normalized = value.trim()
    if (!normalized || Buffer.byteLength(normalized, 'utf8') > MAX_EXTERNAL_ID_BYTES)
        throw new BadRequestException('External id must contain between 1 and 200 UTF-8 bytes')
    return normalized
}

function machineAuditMetadata(principal: MachinePrincipal): Prisma.InputJsonObject {
    return { integration_id: principal.integrationId, credential_id: principal.credentialId }
}

function serializeTransaction(transaction: TransactionWithTags): Prisma.InputJsonObject {
    return {
        id: transaction.id,
        workspaceId: transaction.workspaceId,
        categoryId: transaction.categoryId,
        paymentSourceId: transaction.paymentSourceId,
        integrationId: transaction.integrationId,
        externalId: transaction.externalId,
        type: transaction.type,
        version: transaction.version,
        amount: transaction.amount,
        currency: transaction.currency,
        baseAmount: transaction.baseAmount,
        fxRate: transaction.fxRate.toString(),
        fxRateDate: transaction.fxRateDate.toISOString(),
        fxSource: transaction.fxSource,
        date: transaction.date.toISOString(),
        description: transaction.description,
        notes: transaction.notes,
        tags: transaction.tags.map((tag) => tag.name),
        createdAt: transaction.createdAt.toISOString(),
        updatedAt: transaction.updatedAt.toISOString(),
    }
}

function deserializeTransaction(value: Prisma.JsonValue | null): TransactionWithTags {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new ConflictException('Idempotency response is unavailable')
    const body = value as Record<string, unknown>
    if (typeof body.id !== 'string' || !Array.isArray(body.tags))
        throw new ConflictException('Idempotency response is unavailable')
    const createdAt = new Date(String(body.createdAt))
    return {
        id: body.id,
        workspaceId: String(body.workspaceId),
        categoryId: String(body.categoryId),
        paymentSourceId: String(body.paymentSourceId),
        integrationId: typeof body.integrationId === 'string' ? body.integrationId : null,
        externalId: typeof body.externalId === 'string' ? body.externalId : null,
        type: String(body.type),
        version: Number(body.version),
        amount: Number(body.amount),
        currency: String(body.currency),
        baseAmount: Number(body.baseAmount),
        fxRate: new Prisma.Decimal(String(body.fxRate)),
        fxRateDate: new Date(String(body.fxRateDate)),
        fxSource: String(body.fxSource),
        date: new Date(String(body.date)),
        description: String(body.description),
        notes: typeof body.notes === 'string' ? body.notes : null,
        createdAt,
        updatedAt: new Date(String(body.updatedAt)),
        deletedAt: null,
        tags: body.tags
            .filter((tag): tag is string => typeof tag === 'string')
            .map((name, index) => ({
                id: `replay-${index}`,
                workspaceId: String(body.workspaceId),
                transactionId: body.id,
                name,
                createdAt,
                updatedAt: new Date(String(body.updatedAt)),
            })),
    } as TransactionWithTags
}

function stableJson(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value)
    if (value instanceof Date) return JSON.stringify(value.toISOString())
    if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
        .join(',')}}`
}

function isUniqueConstraint(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
    )
}
