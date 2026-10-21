import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    PreconditionFailedException,
    OnModuleInit,
    OnModuleDestroy,
} from '@nestjs/common'
import { IntegrationIdempotencyRecord, Prisma } from '@prisma/client'
import { createHash } from 'crypto'
import { PrismaService } from '../../shared/database/prisma.service'
import { AuditService } from '../../shared/audit/audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../shared/audit/audit.types'
import { CurrencyService, normalizeCurrency } from '../../shared/currency/currency.service'
import { logger } from '../../shared/utils/logger'
import {
    TransactionWithTags,
    TransactionsRepository,
} from '../transactions/transactions.repository'
import { MachinePrincipal } from './integration-credential.service'
import {
    normalizeExternalTransactionId,
    normalizeIdempotencyKey,
} from './external-transaction-contract'

export const IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
export const IDEMPOTENCY_LEASE_MS = 5 * 60 * 1000

export interface ExternalTransactionCreateCommand {
    externalId?: string | null
    type: 'expense' | 'income'
    amount: number
    currency: string
    // Derived values never participate in request identity or override the authoritative quote.
    baseAmount?: number
    fxRate?: number
    fxRateDate?: Date
    fxSource?: string
    date: Date
    description: string
    notes: string | null
    tags: string[]
    categoryId?: string | null
    paymentSourceId: string
}

export interface ExternalTransactionCreateResult {
    transaction?: TransactionWithTags
    alreadyExists?: { status: 'already_exists'; external_id: string }
    replayed: boolean
    responseStatus: number
    etag?: string
}

interface Claim {
    key: string
    operation: 'create' | 'update' | 'delete'
    targetExternalId: string | null
    fingerprint: string
}

interface References {
    categoryId: string | null
    paymentSourceId: string
    type?: string
}

export class IdempotencyInProgressException extends ConflictException {
    readonly retryAfterSeconds = 1
    constructor() {
        super('Idempotency request is in progress')
    }
}

/** HTTP-free boundary. Locks, finance, tags, audit and replay results share one transaction. */
@Injectable()
export class ExternalTransactionOwnershipService implements OnModuleInit, OnModuleDestroy {
    private cleanupTimer?: ReturnType<typeof setInterval>

    constructor(
        private readonly prisma: PrismaService,
        private readonly transactionsRepository: TransactionsRepository,
        private readonly auditService: AuditService,
        private readonly currencyService: CurrencyService,
    ) {}

    onModuleInit(): void {
        const cleanup = () => {
            void this.cleanupExpiredIdempotency().catch(() => {
                logger.error('Integration replay cleanup failed', {
                    context_name: ExternalTransactionOwnershipService.name,
                })
            })
        }
        cleanup()
        this.cleanupTimer = setInterval(cleanup, 60 * 60 * 1000)
        this.cleanupTimer.unref()
    }

    onModuleDestroy(): void {
        if (this.cleanupTimer) clearInterval(this.cleanupTimer)
    }

    async createIdempotently(
        principal: MachinePrincipal,
        idempotencyKey: string | undefined,
        input: ExternalTransactionCreateCommand,
    ): Promise<ExternalTransactionCreateResult> {
        this.assertScope(principal, 'create')
        const command = normalizeCreateCommand(input)
        const claim =
            idempotencyKey === undefined
                ? undefined
                : {
                      key: normalizeIdempotencyKey(idempotencyKey),
                      operation: 'create' as const,
                      targetExternalId: command.externalId ?? null,
                      fingerprint: fingerprintExternalTransactionCreate(command),
                  }
        const create = () =>
            this.execute(principal, claim, async (tx) => {
                await this.assertReferences(principal, command as References, tx, false)
                if (command.externalId) {
                    // Different keys and keyless creates also serialize by durable source identity.
                    await this.lock(
                        tx,
                        `external:${principal.workspaceId}:${principal.integrationId}:${command.externalId}`,
                    )
                    const existing = await this.findOwned(principal, command.externalId, tx, true)
                    if (existing) {
                        await this.assertReferences(principal, existing, tx, true)
                        return {
                            result: {
                                alreadyExists: {
                                    status: 'already_exists' as const,
                                    external_id: command.externalId,
                                },
                                replayed: false,
                                responseStatus: 200,
                            },
                            target: existing,
                        }
                    }
                }
                const financials = await this.resolveFinancials(principal.workspaceId, command, tx)
                const transaction = await this.transactionsRepository.createTransactionWithTags(
                    {
                        ...command,
                        ...financials,
                        categoryId: command.categoryId ?? null,
                        workspaceId: principal.workspaceId,
                        integrationId: principal.integrationId,
                        auditMetadata: machineAuditMetadata(principal),
                    },
                    tx,
                )
                return { result: transactionResult(transaction, 201), target: transaction }
            })
        try {
            return await create()
        } catch (error) {
            // The constraint is authoritative even for inserts made outside this service.
            if (command.externalId && isUniqueConstraint(error)) return create()
            throw error
        }
    }

    async updateIdempotently(
        principal: MachinePrincipal,
        idempotencyKey: string,
        expectedVersion: number,
        input: ExternalTransactionCreateCommand,
    ): Promise<ExternalTransactionCreateResult> {
        this.assertScope(principal, 'update')
        assertVersion(expectedVersion)
        const command = normalizeCreateCommand(input)
        const externalId = normalizeExternalTransactionId(command.externalId ?? '')
        const claim: Claim = {
            key: normalizeIdempotencyKey(idempotencyKey),
            operation: 'update',
            targetExternalId: externalId,
            fingerprint: fingerprintExternalTransactionUpdate(command, expectedVersion),
        }
        return this.execute(principal, claim, async (tx) => {
            const existing = await this.requireOwned(principal, externalId, tx)
            await this.assertReferences(principal, existing, tx, true)
            await this.assertReferences(principal, command as References, tx, false)
            if (existing.version !== expectedVersion)
                throw new PreconditionFailedException('Transaction version does not match')
            const financials = await this.resolveFinancials(principal.workspaceId, command, tx)
            const transaction = await this.transactionsRepository.updateTransactionWithTags(
                {
                    ...command,
                    ...financials,
                    externalId,
                    categoryId: command.categoryId ?? null,
                    workspaceId: principal.workspaceId,
                    integrationId: principal.integrationId,
                    transactionId: existing.id,
                    expectedVersion,
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
                        previous_version: existing.version,
                        version: transaction.version,
                    },
                },
                tx,
            )
            return { result: transactionResult(transaction, 200), target: transaction }
        })
    }

    async deleteIdempotently(
        principal: MachinePrincipal,
        idempotencyKey: string,
        externalId: string,
        expectedVersion: number,
    ): Promise<ExternalTransactionCreateResult> {
        this.assertScope(principal, 'delete')
        assertVersion(expectedVersion)
        const normalizedId = normalizeExternalTransactionId(externalId)
        const claim: Claim = {
            key: normalizeIdempotencyKey(idempotencyKey),
            operation: 'delete',
            targetExternalId: normalizedId,
            fingerprint: fingerprintExternalTransactionDelete(normalizedId, expectedVersion),
        }
        return this.execute(principal, claim, async (tx) => {
            const existing = await this.requireOwned(principal, normalizedId, tx)
            await this.assertReferences(principal, existing, tx, true)
            const deleted = await tx.transaction.updateMany({
                where: {
                    id: existing.id,
                    workspaceId: principal.workspaceId,
                    integrationId: principal.integrationId,
                    externalId: normalizedId,
                    version: expectedVersion,
                    deletedAt: null,
                },
                data: { deletedAt: new Date(), version: { increment: 1 } },
            })
            if (deleted.count !== 1)
                throw new PreconditionFailedException('Transaction version does not match')
            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.TRANSACTION_DELETED,
                    workspaceId: principal.workspaceId,
                    entityType: AUDIT_ENTITY_TYPES.TRANSACTION,
                    entityId: existing.id,
                    metadata: { ...machineAuditMetadata(principal), version: expectedVersion + 1 },
                },
                tx,
            )
            return { result: { replayed: false, responseStatus: 204 }, target: existing }
        })
    }

    async findOwnedTransaction(
        principal: MachinePrincipal,
        externalId: string,
    ): Promise<TransactionWithTags> {
        this.assertScope(principal, 'read')
        return this.prisma.$transaction(async (tx) => {
            await this.assertIdentity(principal, tx)
            const transaction = await this.requireOwned(
                principal,
                normalizeExternalTransactionId(externalId),
                tx,
            )
            await this.assertReferences(principal, transaction, tx, true)
            return transaction
        })
    }

    async cleanupExpiredIdempotency(now = new Date()): Promise<number> {
        const result = await this.prisma.integrationIdempotencyRecord.deleteMany({
            where: {
                status: 'completed',
                completedAt: { lte: new Date(now.getTime() - IDEMPOTENCY_RETENTION_MS) },
                expiresAt: { lte: now },
            },
        })
        return result.count
    }

    private async execute(
        principal: MachinePrincipal,
        claim: Claim | undefined,
        mutate: (
            tx: Prisma.TransactionClient,
        ) => Promise<{ result: ExternalTransactionCreateResult; target: TransactionWithTags }>,
    ): Promise<ExternalTransactionCreateResult> {
        return this.prisma.$transaction(
            async (tx) => {
                await this.assertIdentity(principal, tx)
                let record: IntegrationIdempotencyRecord | undefined
                if (claim) {
                    // Held until commit/rollback, including lease recovery. An old worker cannot
                    // outlive this exclusive ownership and later commit a second financial effect.
                    await this.lock(
                        tx,
                        `idempotency:${principal.integrationId}:${digestIdempotencyKey(claim.key)}`,
                    )
                    const existing = await tx.integrationIdempotencyRecord.findUnique({
                        where: {
                            integrationId_keyDigest: {
                                integrationId: principal.integrationId,
                                keyDigest: digestIdempotencyKey(claim.key),
                            },
                        },
                    })
                    const now = new Date()
                    if (existing && (existing.status !== 'completed' || existing.expiresAt > now)) {
                        if (
                            existing.workspaceId !== principal.workspaceId ||
                            existing.operation !== claim.operation ||
                            existing.targetExternalId !== claim.targetExternalId ||
                            existing.requestFingerprint !== claim.fingerprint
                        )
                            throw new ConflictException(
                                'Idempotency key conflicts with a different request',
                            )
                        if (existing.status === 'completed')
                            return this.replay(principal, existing, tx)
                        if (!existing.leaseExpiresAt || existing.leaseExpiresAt > now)
                            throw new IdempotencyInProgressException()
                    }
                    if (existing)
                        await tx.integrationIdempotencyRecord.delete({ where: { id: existing.id } })
                    record = await tx.integrationIdempotencyRecord.create({
                        data: {
                            workspaceId: principal.workspaceId,
                            integrationId: principal.integrationId,
                            keyDigest: digestIdempotencyKey(claim.key),
                            operation: claim.operation,
                            targetExternalId: claim.targetExternalId,
                            requestFingerprint: claim.fingerprint,
                            status: 'in_progress',
                            leaseExpiresAt: new Date(now.getTime() + IDEMPOTENCY_LEASE_MS),
                            expiresAt: new Date(now.getTime() + IDEMPOTENCY_LEASE_MS),
                        },
                    })
                }
                const { result, target } = await mutate(tx)
                if (record) {
                    const completedAt = new Date()
                    await tx.integrationIdempotencyRecord.update({
                        where: { id: record.id },
                        data: {
                            status: 'completed',
                            responseStatus: result.responseStatus,
                            responseBody: result.transaction
                                ? serializeTransaction(result.transaction)
                                : (result.alreadyExists ?? Prisma.JsonNull),
                            responseEtag: result.etag ?? null,
                            targetTransactionId: target.id,
                            retainedCategoryId: target.categoryId,
                            retainedPaymentSourceId: target.paymentSourceId,
                            leaseExpiresAt: null,
                            completedAt,
                            expiresAt: new Date(completedAt.getTime() + IDEMPOTENCY_RETENTION_MS),
                        },
                    })
                }
                return result
            },
            { maxWait: 10_000, timeout: 30_000 },
        )
    }

    private async replay(
        principal: MachinePrincipal,
        record: IntegrationIdempotencyRecord,
        tx: Prisma.TransactionClient,
    ): Promise<ExternalTransactionCreateResult> {
        if (record.targetTransactionId)
            await tx.$queryRaw(Prisma.sql`SELECT id FROM transactions
            WHERE id = ${record.targetTransactionId} AND workspace_id = ${principal.workspaceId}
            AND integration_id = ${principal.integrationId} FOR SHARE`)
        const target = record.targetTransactionId
            ? await tx.transaction.findFirst({
                  where: {
                      id: record.targetTransactionId,
                      workspaceId: principal.workspaceId,
                      integrationId: principal.integrationId,
                  },
              })
            : null
        if (!target) throw new NotFoundException('Transaction not found')
        await this.assertReferences(principal, target, tx, true)
        if (!record.retainedPaymentSourceId) throw new NotFoundException('Transaction not found')
        await this.assertReferences(
            principal,
            {
                categoryId: record.retainedCategoryId,
                paymentSourceId: record.retainedPaymentSourceId,
            },
            tx,
            true,
        )
        if (record.responseStatus === 204) return { replayed: true, responseStatus: 204 }
        if (record.operation === 'create' && record.responseStatus === 200) {
            return {
                alreadyExists: { status: 'already_exists', external_id: record.targetExternalId! },
                replayed: true,
                responseStatus: 200,
            }
        }
        return {
            transaction: deserializeTransaction(record.responseBody),
            replayed: true,
            responseStatus: record.responseStatus!,
            etag: record.responseEtag ?? undefined,
        }
    }

    private async lock(tx: Prisma.TransactionClient, key: string): Promise<void> {
        await tx.$queryRaw(
            Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`,
        )
    }

    private async assertIdentity(
        principal: MachinePrincipal,
        tx: Prisma.TransactionClient,
    ): Promise<void> {
        const identity = await tx.integration.findFirst({
            where: { id: principal.integrationId, workspaceId: principal.workspaceId },
        })
        if (!identity) throw new NotFoundException('Transaction not found')
    }

    private assertScope(
        principal: MachinePrincipal,
        operation: 'create' | 'read' | 'update' | 'delete',
    ): void {
        const scope =
            operation === 'create'
                ? 'transactions:create'
                : (`transactions:${operation}-own` as const)
        if (!principal.scopes.includes(scope))
            throw new ForbiddenException('Integration scope is required')
    }

    private async findOwned(
        principal: MachinePrincipal,
        externalId: string,
        tx: Prisma.TransactionClient,
        includeDeleted = false,
    ) {
        await tx.$queryRaw(Prisma.sql`SELECT id FROM transactions WHERE workspace_id = ${principal.workspaceId}
            AND integration_id = ${principal.integrationId} AND external_id = ${externalId}
            ${includeDeleted ? Prisma.empty : Prisma.sql`AND deleted_at IS NULL`} FOR UPDATE`)
        return tx.transaction.findFirst({
            where: {
                workspaceId: principal.workspaceId,
                integrationId: principal.integrationId,
                externalId,
                ...(includeDeleted ? {} : { deletedAt: null }),
            },
            include: { tags: { orderBy: { name: 'asc' } } },
        })
    }

    private async requireOwned(
        principal: MachinePrincipal,
        externalId: string,
        tx: Prisma.TransactionClient,
    ) {
        const target = await this.findOwned(principal, externalId, tx)
        if (!target) throw new NotFoundException('Transaction not found')
        return target
    }

    private async assertReferences(
        principal: MachinePrincipal,
        refs: References,
        tx: Prisma.TransactionClient,
        stored: boolean,
    ): Promise<void> {
        const deny = () => {
            throw stored
                ? new NotFoundException('Transaction not found')
                : new BadRequestException('Transaction references are invalid')
        }
        if (
            (principal.categoryAllowlistEnabled &&
                (!refs.categoryId || !principal.allowedCategoryIds.includes(refs.categoryId))) ||
            (principal.paymentSourceAllowlistEnabled &&
                !principal.allowedPaymentSourceIds.includes(refs.paymentSourceId))
        )
            deny()
        // Share locks prevent an archive/delete from invalidating a checked reference before commit.
        if (refs.categoryId) {
            const categories = await tx.$queryRaw<Array<{ type: string }>>(Prisma.sql`
                SELECT type FROM categories WHERE workspace_id = ${principal.workspaceId}
                AND id = ${refs.categoryId} AND deleted_at IS NULL FOR SHARE`)
            if (!categories[0] || (refs.type && categories[0].type !== refs.type)) deny()
        }
        const sources = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
            SELECT id FROM payment_sources WHERE workspace_id = ${principal.workspaceId}
            AND id = ${refs.paymentSourceId} AND deleted_at IS NULL FOR SHARE`)
        if (!sources[0]) deny()
    }

    private async resolveFinancials(
        workspaceId: string,
        command: ExternalTransactionCreateCommand,
        tx: Prisma.TransactionClient,
    ) {
        const workspace = await tx.workspace.findUniqueOrThrow({
            where: { id: workspaceId },
            select: { baseCurrency: true },
        })
        const quote = await this.currencyService.getHistoricalQuote(
            command.currency,
            workspace.baseCurrency,
            command.date,
        )
        const baseAmount = Math.round(command.amount * quote.rate)
        if (!Number.isSafeInteger(baseAmount) || baseAmount <= 0 || baseAmount > 2_147_483_647)
            throw new BadRequestException('Converted amount is out of range')
        return {
            baseAmount,
            fxRate: quote.rate,
            fxRateDate: quote.rateDate,
            fxSource: quote.source,
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
    return fingerprint({ operation: 'create', ...stableIntent(input) })
}

export function fingerprintExternalTransactionUpdate(
    input: ExternalTransactionCreateCommand,
    expectedVersion: number,
): string {
    return fingerprint({ operation: 'update', ...stableIntent(input), expectedVersion })
}

export function fingerprintExternalTransactionDelete(
    externalId: string,
    expectedVersion: number,
): string {
    return fingerprint({
        operation: 'delete',
        externalId: normalizeExternalTransactionId(externalId),
        expectedVersion,
    })
}

function stableIntent(input: ExternalTransactionCreateCommand) {
    const command = normalizeCreateCommand(input)
    return {
        externalId: command.externalId,
        type: command.type,
        amount: command.amount,
        currency: command.currency,
        date: command.date.toISOString(),
        description: command.description,
        notes: command.notes,
        tags: command.tags.map((tag) => tag.toLowerCase()),
        categoryId: command.categoryId,
        paymentSourceId: command.paymentSourceId,
    }
}

function fingerprint(value: Record<string, unknown>): string {
    return createHash('sha256')
        .update(JSON.stringify(value, Object.keys(value).sort()), 'utf8')
        .digest('hex')
}

function normalizeCreateCommand(
    input: ExternalTransactionCreateCommand,
): ExternalTransactionCreateCommand {
    const externalId =
        input.externalId == null ? null : normalizeExternalTransactionId(input.externalId)
    if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > 2_147_483_647)
        throw new BadRequestException('Amount must be a positive integer in minor units')
    if (input.type !== 'expense' && input.type !== 'income')
        throw new BadRequestException('Transaction type is invalid')
    if (
        !(input.date instanceof Date) ||
        Number.isNaN(input.date.getTime()) ||
        input.date.toISOString().slice(11) !== '00:00:00.000Z'
    )
        throw new BadRequestException('Transaction date is invalid')
    const categoryId = input.categoryId == null ? null : input.categoryId.trim()
    const paymentSourceId = input.paymentSourceId?.trim()
    const description = input.description?.trim()
    if (
        (categoryId !== null && !categoryId) ||
        !paymentSourceId ||
        !description ||
        description.length > 200
    )
        throw new BadRequestException('Transaction fields are invalid')
    if (input.notes != null && (typeof input.notes !== 'string' || input.notes.length > 2000))
        throw new BadRequestException('Transaction notes are invalid')
    if (
        !Array.isArray(input.tags) ||
        input.tags.length > 10 ||
        input.tags.some((tag) => typeof tag !== 'string' || tag.length > 100)
    )
        throw new BadRequestException('Transaction tags are invalid')
    const tags = new Map<string, string>()
    for (const tag of input.tags) {
        const trimmed = tag.trim()
        if (trimmed && !tags.has(trimmed.toLowerCase())) tags.set(trimmed.toLowerCase(), trimmed)
    }
    return {
        ...input,
        externalId,
        categoryId,
        paymentSourceId,
        description,
        currency: normalizeCurrency(input.currency),
        notes: input.notes?.trim() || null,
        tags: [...tags.entries()]
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([, value]) => value),
    }
}

function assertVersion(version: number): void {
    if (!Number.isSafeInteger(version) || version < 1 || version >= 2_147_483_647)
        throw new BadRequestException('Transaction version is invalid')
}

function machineAuditMetadata(principal: MachinePrincipal): Prisma.InputJsonObject {
    return { integration_id: principal.integrationId, credential_id: principal.credentialId }
}

function transactionResult(
    transaction: TransactionWithTags,
    responseStatus: number,
): ExternalTransactionCreateResult {
    return { transaction, responseStatus, replayed: false, etag: `"tx-v${transaction.version}"` }
}

function serializeTransaction(transaction: TransactionWithTags): Prisma.InputJsonObject {
    return {
        ...transaction,
        fxRate: transaction.fxRate.toString(),
        fxRateDate: transaction.fxRateDate.toISOString(),
        date: transaction.date.toISOString(),
        createdAt: transaction.createdAt.toISOString(),
        updatedAt: transaction.updatedAt.toISOString(),
        deletedAt: transaction.deletedAt?.toISOString() ?? null,
        tags: transaction.tags.map((tag) => ({
            ...tag,
            createdAt: tag.createdAt.toISOString(),
            updatedAt: tag.updatedAt.toISOString(),
        })),
    }
}

function deserializeTransaction(value: Prisma.JsonValue | null): TransactionWithTags {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new ConflictException('Idempotency response is unavailable')
    const body = value as Record<string, unknown>
    if (typeof body.id !== 'string' || !Array.isArray(body.tags))
        throw new ConflictException('Idempotency response is unavailable')
    const createdAt = new Date(String(body.createdAt))
    const updatedAt = new Date(String(body.updatedAt))
    return {
        ...body,
        fxRate: new Prisma.Decimal(String(body.fxRate)),
        fxRateDate: new Date(String(body.fxRateDate)),
        date: new Date(String(body.date)),
        createdAt,
        updatedAt,
        deletedAt: body.deletedAt ? new Date(String(body.deletedAt)) : null,
        tags: body.tags.map((tag, index) =>
            typeof tag === 'string'
                ? {
                      id: `replay-${index}`,
                      workspaceId: body.workspaceId,
                      transactionId: body.id,
                      name: tag,
                      createdAt,
                      updatedAt,
                  }
                : {
                      ...tag,
                      createdAt: new Date(String(tag.createdAt)),
                      updatedAt: new Date(String(tag.updatedAt)),
                  },
        ),
    } as TransactionWithTags
}

function isUniqueConstraint(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002'
}
