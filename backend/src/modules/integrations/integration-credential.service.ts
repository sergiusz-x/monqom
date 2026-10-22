import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    HttpException,
    Injectable,
    NotFoundException,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { PrismaService } from '../../shared/database/prisma.service'
import { AuditService } from '../../shared/audit/audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../shared/audit/audit.types'
import {
    IntegrationScope,
    areSupportedIntegrationScopes,
    normalizeIntegrationScopes,
} from './integration-scopes'
import {
    isIntegrationIpAllowed,
    normalizeIntegrationCidrs,
    normalizeIntegrationClientIp,
} from './integration-network-policy'

const TOKEN_DIGEST_CONTEXT = 'monqom-integration-credential:v1:'
const AUTHENTICATION_FAILURE_MESSAGE = 'Integration authentication failed'
const MAX_CREDENTIAL_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000
const USAGE_UPDATE_INTERVAL_MS = 5 * 60_000
const policyInclude = {
    integration: true,
    categoryRestrictions: { select: { categoryId: true } },
    paymentSourceRestrictions: { select: { paymentSourceId: true } },
} satisfies Prisma.IntegrationCredentialInclude
type CredentialWithPolicy = Prisma.IntegrationCredentialGetPayload<{
    include: typeof policyInclude
}>

export interface MachinePrincipal {
    integrationId: string
    credentialId: string
    workspaceId: string
    scopes: readonly IntegrationScope[]
    categoryAllowlistEnabled: boolean
    allowedCategoryIds: readonly string[]
    paymentSourceAllowlistEnabled: boolean
    allowedPaymentSourceIds: readonly string[]
    allowedCidrs: readonly string[]
    cidrAllowlistEnabled?: boolean
}

export interface CreateIntegrationInput {
    workspaceId: string
    createdByUserId: string
    name: string
}

export interface CreateIntegrationCredentialInput {
    integrationId: string
    expiresAt: Date
    scopes: readonly string[]
    categoryAllowlistEnabled?: boolean
    allowedCategoryIds?: readonly string[]
    paymentSourceAllowlistEnabled?: boolean
    allowedPaymentSourceIds?: readonly string[]
    cidrAllowlistEnabled?: boolean
    allowedCidrs?: readonly string[]
}

export type IntegrationCredentialPolicyInput = Omit<
    CreateIntegrationCredentialInput,
    'integrationId'
>

export interface IntegrationCredentialTarget {
    workspaceId: string
    integrationId: string
}

export interface CreatedIntegrationCredential {
    credentialId: string
    token: string
    tokenPrefix: string
    expiresAt: Date
}

@Injectable()
export class IntegrationCredentialService {
    private readonly dummyDigest = digestIntegrationToken('synthetic-unknown-credential')

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditService: AuditService,
    ) {}

    validateCredentialPolicy(input: IntegrationCredentialPolicyInput, now = new Date()): void {
        normalizePolicy(input, now)
    }

    async createIntegrationWithCredential(
        input: CreateIntegrationInput & IntegrationCredentialPolicyInput,
        now = new Date(),
    ): Promise<CreatedIntegrationCredential & { integrationId: string }> {
        const workspaceId = requireTrimmed(input.workspaceId, 'Workspace id')
        const actor = requireTrimmed(input.createdByUserId, 'Creator id')
        const name = requireTrimmed(input.name, 'Integration name')
        if ([...name].length > 100) throw new BadRequestException('Integration name is too long')
        const policy = normalizePolicy(input, now)
        return this.withTokenMaterial(async (material) =>
            this.prisma.$transaction(async (tx) => {
                await this.lockAuthority(tx, workspaceId, actor)
                await this.requireAdministrator(tx, workspaceId, actor)
                await this.validateResources(tx, workspaceId, policy)
                const integration = await tx.integration.create({
                    data: { workspaceId, createdByUserId: actor, creatorReference: actor, name },
                })
                const credential = await tx.integrationCredential.create({
                    data: {
                        integrationId: integration.id,
                        ...credentialData(policy, material, now),
                    },
                    include: policyInclude,
                })
                await this.auditService.record(
                    {
                        action: AUDIT_ACTIONS.INTEGRATION_CREATED,
                        workspaceId,
                        userId: actor,
                        entityType: AUDIT_ENTITY_TYPES.INTEGRATION,
                        entityId: integration.id,
                        metadata: {
                            integration_id: integration.id,
                            previous_status: null,
                            new_status: 'active',
                            reason: 'CREATED',
                        },
                    },
                    tx,
                )
                await this.recordLifecycle(
                    tx,
                    credential,
                    actor,
                    AUDIT_ACTIONS.INTEGRATION_CREDENTIAL_ISSUED,
                    null,
                    'ISSUED',
                    { previous_policy: null },
                )
                return {
                    integrationId: integration.id,
                    ...issuedCredential(credential, material.token),
                }
            }),
        )
    }

    async createIntegration(input: CreateIntegrationInput) {
        const workspaceId = requireTrimmed(input.workspaceId, 'Workspace id')
        const createdByUserId = requireTrimmed(input.createdByUserId, 'Creator id')
        const name = requireTrimmed(input.name, 'Integration name')
        return this.persistence(async () =>
            this.prisma.$transaction(async (tx) => {
                await this.lockAuthority(tx, workspaceId, createdByUserId)
                await this.requireAdministrator(tx, workspaceId, createdByUserId)
                const integration = await tx.integration.create({
                    data: { workspaceId, createdByUserId, creatorReference: createdByUserId, name },
                })
                await this.auditService.record(
                    {
                        action: AUDIT_ACTIONS.INTEGRATION_CREATED,
                        workspaceId,
                        userId: createdByUserId,
                        entityType: AUDIT_ENTITY_TYPES.INTEGRATION,
                        entityId: integration.id,
                        metadata: {
                            integration_id: integration.id,
                            new_status: 'active',
                            reason: 'CREATED',
                        },
                    },
                    tx,
                )
                return integration
            }),
        )
    }

    async createCredential(
        input: CreateIntegrationCredentialInput,
        now = new Date(),
        actorUserId?: string,
    ): Promise<CreatedIntegrationCredential> {
        const policy = normalizePolicy(input, now)
        return this.withTokenMaterial(async (material) =>
            this.prisma.$transaction(async (tx) => {
                const integration = await tx.integration.findUnique({
                    where: { id: input.integrationId },
                })
                if (!integration) throw new BadRequestException('Integration is unavailable')
                await this.lockManagementAuthority(
                    tx,
                    integration.workspaceId,
                    integration.creatorReference,
                    actorUserId,
                )
                await tx.$queryRaw`SELECT "id" FROM "integrations" WHERE "id" = ${integration.id} FOR UPDATE`
                const current = await tx.integration.findUnique({ where: { id: integration.id } })
                if (!current || current.status !== 'active' || !current.createdByUserId) {
                    throw new BadRequestException('Integration is unavailable')
                }
                await this.requireAdministrator(tx, current.workspaceId, current.createdByUserId)
                const actor = actorUserId ?? current.createdByUserId
                await this.requireAdministrator(tx, current.workspaceId, actor)
                await this.validateResources(tx, current.workspaceId, policy)
                const credential = await tx.integrationCredential.create({
                    data: { integrationId: current.id, ...credentialData(policy, material, now) },
                    include: policyInclude,
                })
                await this.recordLifecycle(
                    tx,
                    credential,
                    actor,
                    AUDIT_ACTIONS.INTEGRATION_CREDENTIAL_ISSUED,
                    null,
                    'ISSUED',
                )
                return issuedCredential(credential, material.token)
            }),
        )
    }

    async revokeCredential(
        credentialId: string,
        now = new Date(),
        actorUserId?: string,
        target?: IntegrationCredentialTarget,
    ): Promise<boolean> {
        return this.persistence(async () =>
            this.prisma.$transaction(async (tx) => {
                const credential = await this.lockCredential(tx, credentialId, actorUserId, target)
                if (target) this.assertTarget(credential, target)
                if (!credential || credential.deletedAt) return false
                const actor = actorUserId ?? credential.integration.createdByUserId
                if (!actor) throw new ForbiddenException('Integration management is unavailable')
                await this.requireAdministrator(tx, credential.integration.workspaceId, actor)
                if (credential.status === 'revoked') {
                    await this.recordLifecycle(
                        tx,
                        credential,
                        actor,
                        AUDIT_ACTIONS.INTEGRATION_CREDENTIAL_REVOKED,
                        'revoked',
                        'ALREADY_REVOKED',
                        { previous_policy: policySnapshot(credential) },
                    )
                    return false
                }
                const changed = await tx.integrationCredential.updateMany({
                    where: { id: credential.id, status: 'active', revokedAt: null },
                    data: { status: 'revoked', revokedAt: now },
                })
                if (changed.count !== 1) {
                    throw new ConflictException('Credential lifecycle conflict')
                }
                await this.recordLifecycle(
                    tx,
                    { ...credential, status: 'revoked', revokedAt: now },
                    actor,
                    AUDIT_ACTIONS.INTEGRATION_CREDENTIAL_REVOKED,
                    'active',
                    'REVOKED',
                    { previous_policy: policySnapshot(credential) },
                )
                return true
            }),
        )
    }

    async rotateCredential(
        credentialId: string,
        expiresAt: Date,
        now = new Date(),
        actorUserId?: string,
        target?: IntegrationCredentialTarget,
        replacementPolicy: Partial<Omit<IntegrationCredentialPolicyInput, 'expiresAt'>> = {},
    ): Promise<CreatedIntegrationCredential> {
        validateExpiry(expiresAt, now)
        return this.withTokenMaterial(async (material) =>
            this.prisma.$transaction(async (tx) => {
                const previous = await this.lockCredential(tx, credentialId, actorUserId, target)
                if (target) this.assertTarget(previous, target)
                if (
                    !previous ||
                    previous.deletedAt ||
                    previous.status !== 'active' ||
                    previous.revokedAt ||
                    previous.expiresAt <= now
                ) {
                    throw new ConflictException('Integration credential cannot be rotated')
                }
                const integration = previous.integration
                if (integration.status !== 'active' || !integration.createdByUserId) {
                    throw new ConflictException('Integration credential cannot be rotated')
                }
                await this.requireAdministrator(
                    tx,
                    integration.workspaceId,
                    integration.createdByUserId,
                )
                const actor = actorUserId ?? integration.createdByUserId
                await this.requireAdministrator(tx, integration.workspaceId, actor)
                const policy = normalizePolicy(
                    {
                        expiresAt,
                        scopes: previous.scopes,
                        categoryAllowlistEnabled: previous.categoryAllowlistEnabled,
                        allowedCategoryIds: previous.categoryRestrictions.map(
                            ({ categoryId }) => categoryId,
                        ),
                        paymentSourceAllowlistEnabled: previous.paymentSourceAllowlistEnabled,
                        allowedPaymentSourceIds: previous.paymentSourceRestrictions.map(
                            ({ paymentSourceId }) => paymentSourceId,
                        ),
                        cidrAllowlistEnabled: previous.cidrAllowlistEnabled,
                        allowedCidrs: previous.allowedCidrs,
                        ...replacementPolicy,
                    },
                    now,
                )
                await this.validateResources(tx, integration.workspaceId, policy)
                const changed = await tx.integrationCredential.updateMany({
                    where: {
                        id: previous.id,
                        status: 'active',
                        revokedAt: null,
                        expiresAt: { gt: now },
                    },
                    data: { status: 'revoked', revokedAt: now },
                })
                if (changed.count !== 1)
                    throw new ConflictException('Credential lifecycle conflict')
                const replacement = await tx.integrationCredential.create({
                    data: {
                        integrationId: integration.id,
                        ...credentialData(policy, material, now),
                    },
                    include: policyInclude,
                })
                await this.recordLifecycle(
                    tx,
                    replacement,
                    actor,
                    AUDIT_ACTIONS.INTEGRATION_CREDENTIAL_ROTATED,
                    'active',
                    'ROTATED',
                    {
                        previous_credential_id: previous.id,
                        previous_token_prefix: previous.tokenPrefix,
                        previous_credential_status: 'revoked',
                        previous_policy: policySnapshot(previous),
                    },
                )
                return issuedCredential(replacement, material.token)
            }),
        )
    }

    async deleteCredential(
        credentialId: string,
        actorUserId: string,
        target: IntegrationCredentialTarget,
        now = new Date(),
    ): Promise<void> {
        await this.persistence(() =>
            this.prisma.$transaction(async (tx) => {
                const credential = await this.lockCredential(tx, credentialId, actorUserId, target)
                this.assertTarget(credential, target)
                await this.requireAdministrator(tx, target.workspaceId, actorUserId)
                if (credential.status !== 'revoked' || !credential.revokedAt) {
                    throw new ConflictException('Credential must be revoked before deletion')
                }
                await tx.integrationCredential.update({
                    where: { id: credential.id },
                    data: { deletedAt: now },
                })
                const remaining = await tx.integrationCredential.count({
                    where: { integrationId: target.integrationId, deletedAt: null },
                })
                if (remaining === 0) {
                    await tx.integration.update({
                        where: { id: target.integrationId },
                        data: { status: 'deleted' },
                    })
                }
                await this.recordLifecycle(
                    tx,
                    { ...credential, deletedAt: now },
                    actorUserId,
                    AUDIT_ACTIONS.INTEGRATION_CREDENTIAL_DELETED,
                    'revoked',
                    'SAFELY_DELETED',
                    { previous_policy: policySnapshot(credential), deleted_at: now.toISOString() },
                )
            }),
        )
    }

    async authenticateAuthorizationHeader(
        authorization: string | undefined,
        clientIp: string | undefined,
        now = new Date(),
    ): Promise<MachinePrincipal> {
        const token = parseBearerToken(authorization)
        if (!token) {
            compareDigest(this.dummyDigest, digestIntegrationToken(''))
            throw authenticationFailure()
        }
        const credential = await this.persistence(() =>
            this.prisma.integrationCredential.findUnique({
                where: { tokenPrefix: token.slice(0, token.indexOf('.')) },
                include: {
                    ...policyInclude,
                    integration: {
                        include: {
                            createdBy: {
                                select: {
                                    memberships: { select: { workspaceId: true, role: true } },
                                },
                            },
                        },
                    },
                },
            }),
        )
        const tokenMatches = compareDigest(
            credential?.tokenDigest ?? this.dummyDigest,
            digestIntegrationToken(token),
        )
        const creatorHasAuthority =
            credential?.integration.createdBy?.memberships.some(
                (membership) =>
                    membership.workspaceId === credential.integration.workspaceId &&
                    isAdministrator(membership.role),
            ) ?? false
        if (
            !credential ||
            !tokenMatches ||
            credential.status !== 'active' ||
            Boolean(credential.deletedAt) ||
            credential.revokedAt !== null ||
            credential.expiresAt <= now ||
            credential.createdAt > now ||
            credential.expiresAt.getTime() - credential.createdAt.getTime() >
                MAX_CREDENTIAL_LIFETIME_MS ||
            credential.integration.status !== 'active' ||
            !creatorHasAuthority ||
            !areSupportedIntegrationScopes(credential.scopes) ||
            !isIntegrationIpAllowed(
                clientIp,
                credential.allowedCidrs,
                credential.cidrAllowlistEnabled,
            )
        ) {
            if (credential && tokenMatches) {
                await this.persistence(() =>
                    this.auditService.record({
                        action: AUDIT_ACTIONS.INTEGRATION_AUTHENTICATION_DENIED,
                        workspaceId: credential.integration.workspaceId,
                        entityType: AUDIT_ENTITY_TYPES.INTEGRATION_CREDENTIAL,
                        entityId: credential.id,
                        metadata: {
                            integration_id: credential.integrationId,
                            credential_id: credential.id,
                            reason: 'AUTHENTICATION_DENIED',
                        },
                    }),
                )
            }
            throw authenticationFailure()
        }
        if (
            !credential.lastUsedAt ||
            now.getTime() - credential.lastUsedAt.getTime() >= USAGE_UPDATE_INTERVAL_MS
        ) {
            try {
                await this.prisma.integrationCredential.updateMany({
                    where: {
                        id: credential.id,
                        status: 'active',
                        revokedAt: null,
                        expiresAt: { gt: now },
                        OR: [
                            { lastUsedAt: null },
                            {
                                lastUsedAt: {
                                    lte: new Date(now.getTime() - USAGE_UPDATE_INTERVAL_MS),
                                },
                            },
                        ],
                    },
                    data: {
                        lastUsedAt: now,
                        lastUsedIp: normalizeIntegrationClientIp(clientIp) ?? null,
                    },
                })
            } catch {
                // Operational metadata is best effort; never log the caught persistence error.
            }
        }
        return {
            integrationId: credential.integrationId,
            credentialId: credential.id,
            workspaceId: credential.integration.workspaceId,
            scopes: credential.scopes as IntegrationScope[],
            categoryAllowlistEnabled: credential.categoryAllowlistEnabled,
            allowedCategoryIds: credential.categoryRestrictions.map(({ categoryId }) => categoryId),
            paymentSourceAllowlistEnabled: credential.paymentSourceAllowlistEnabled,
            allowedPaymentSourceIds: credential.paymentSourceRestrictions.map(
                ({ paymentSourceId }) => paymentSourceId,
            ),
            cidrAllowlistEnabled: credential.cidrAllowlistEnabled,
            allowedCidrs: credential.allowedCidrs,
        }
    }

    async recordDeniedAccess(
        principal: MachinePrincipal,
        reason: 'WORKSPACE_DENIED' | 'SCOPE_DENIED',
    ): Promise<void> {
        await this.persistence(() =>
            this.auditService.record({
                action: AUDIT_ACTIONS.INTEGRATION_ACCESS_DENIED,
                workspaceId: principal.workspaceId,
                entityType: AUDIT_ENTITY_TYPES.INTEGRATION_CREDENTIAL,
                entityId: principal.credentialId,
                metadata: {
                    integration_id: principal.integrationId,
                    credential_id: principal.credentialId,
                    reason,
                },
            }),
        )
    }

    private async lockAuthority(
        tx: Prisma.TransactionClient,
        workspaceId: string,
        creator: string,
    ): Promise<void> {
        const key = `integration-authority:${workspaceId}:${creator}`
        await tx.$queryRaw`SELECT 1::int AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))) AS lock`
    }

    private async lockManagementAuthority(
        tx: Prisma.TransactionClient,
        workspaceId: string,
        creator: string,
        actor?: string,
    ): Promise<void> {
        // Consistent order also protects operations performed by a different administrator.
        for (const userId of [...new Set([creator, ...(actor ? [actor] : [])])].sort()) {
            await this.lockAuthority(tx, workspaceId, userId)
        }
    }

    private async lockCredential(
        tx: Prisma.TransactionClient,
        credentialId: string,
        actorUserId?: string,
        target?: IntegrationCredentialTarget,
    ) {
        const id = requireTrimmed(credentialId, 'Credential id')
        const initial = await tx.integrationCredential.findUnique({
            where: {
                id,
                ...(target
                    ? {
                          integrationId: target.integrationId,
                          integration: { workspaceId: target.workspaceId },
                      }
                    : {}),
            },
            include: { integration: true },
        })
        if (!initial) return null
        await this.lockManagementAuthority(
            tx,
            initial.integration.workspaceId,
            initial.integration.creatorReference,
            actorUserId,
        )
        await tx.$queryRaw`SELECT "id" FROM "integrations" WHERE "id" = ${initial.integrationId} FOR UPDATE`
        await tx.$queryRaw`SELECT "id" FROM "integration_credentials" WHERE "id" = ${id} FOR UPDATE`
        return tx.integrationCredential.findUnique({ where: { id }, include: policyInclude })
    }

    private assertTarget(
        credential: CredentialWithPolicy | null,
        target: IntegrationCredentialTarget,
    ): asserts credential is CredentialWithPolicy {
        if (
            !credential ||
            credential.deletedAt ||
            credential.integrationId !== target.integrationId ||
            credential.integration.workspaceId !== target.workspaceId ||
            credential.integration.status === 'deleted'
        ) {
            throw new NotFoundException('Integration credential not found')
        }
    }

    private async requireAdministrator(
        tx: Prisma.TransactionClient,
        workspaceId: string,
        userId: string,
    ): Promise<void> {
        const membership = await tx.workspaceMembership.findUnique({
            where: { userId_workspaceId: { userId, workspaceId } },
        })
        if (!membership || !isAdministrator(membership.role))
            throw new ForbiddenException('Integration management is unavailable')
    }

    private async validateResources(
        tx: Prisma.TransactionClient,
        workspaceId: string,
        policy: CredentialPolicy,
    ): Promise<void> {
        // Hold resource rows until commit so archival cannot race policy validation.
        const categories = policy.categoryIds.length
            ? await tx.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "categories" WHERE "workspace_id" = ${workspaceId}
            AND "id" IN (${Prisma.join(policy.categoryIds)}) AND "deleted_at" IS NULL
            ORDER BY "id" FOR SHARE`
            : []
        const sources = policy.paymentSourceIds.length
            ? await tx.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "payment_sources" WHERE "workspace_id" = ${workspaceId}
            AND "id" IN (${Prisma.join(policy.paymentSourceIds)}) AND "deleted_at" IS NULL
            ORDER BY "id" FOR SHARE`
            : []
        if (
            categories.length !== policy.categoryIds.length ||
            sources.length !== policy.paymentSourceIds.length
        ) {
            throw new BadRequestException('A resource restriction is invalid or archived')
        }
    }

    private async recordLifecycle(
        tx: Prisma.TransactionClient,
        credential: CredentialWithPolicy,
        actor: string,
        action:
            | typeof AUDIT_ACTIONS.INTEGRATION_CREDENTIAL_ISSUED
            | typeof AUDIT_ACTIONS.INTEGRATION_CREDENTIAL_ROTATED
            | typeof AUDIT_ACTIONS.INTEGRATION_CREDENTIAL_REVOKED
            | typeof AUDIT_ACTIONS.INTEGRATION_CREDENTIAL_DELETED,
        previousStatus: string | null,
        reason: string,
        extra: Prisma.InputJsonObject = {},
    ): Promise<void> {
        await this.auditService.record(
            {
                action,
                workspaceId: credential.integration.workspaceId,
                userId: actor,
                entityType: AUDIT_ENTITY_TYPES.INTEGRATION_CREDENTIAL,
                entityId: credential.id,
                metadata: {
                    integration_id: credential.integrationId,
                    credential_id: credential.id,
                    token_prefix: credential.tokenPrefix,
                    previous_status: previousStatus,
                    new_status: credential.status,
                    expires_at: credential.expiresAt.toISOString(),
                    revoked_at: credential.revokedAt?.toISOString() ?? null,
                    deleted_at: credential.deletedAt?.toISOString() ?? null,
                    scopes: credential.scopes,
                    category_allowlist_enabled: credential.categoryAllowlistEnabled,
                    category_ids: credential.categoryRestrictions.map(
                        ({ categoryId }) => categoryId,
                    ),
                    payment_source_allowlist_enabled: credential.paymentSourceAllowlistEnabled,
                    payment_source_ids: credential.paymentSourceRestrictions.map(
                        ({ paymentSourceId }) => paymentSourceId,
                    ),
                    cidr_allowlist_enabled: credential.cidrAllowlistEnabled,
                    allowed_cidrs: credential.allowedCidrs,
                    new_policy: policySnapshot(credential),
                    reason,
                    ...extra,
                },
            },
            tx,
        )
    }

    private async withTokenMaterial<T>(
        operation: (material: ReturnType<typeof createIntegrationCredentialToken>) => Promise<T>,
    ): Promise<T> {
        return this.persistence(async () => {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    return await operation(createIntegrationCredentialToken())
                } catch (error) {
                    if (
                        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
                        error.code !== 'P2002' ||
                        !String(JSON.stringify(error.meta?.target)).match(
                            /token_prefix|token_digest/,
                        )
                    )
                        throw error
                }
            }
            throw new ServiceUnavailableException('Integration credential issuance is unavailable')
        })
    }

    private async persistence<T>(operation: () => Promise<T>): Promise<T> {
        try {
            return await operation()
        } catch (error) {
            if (error instanceof HttpException) throw error
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
                throw new ConflictException('Credential lifecycle conflict')
            }
            throw new ServiceUnavailableException('Integration authentication is unavailable')
        }
    }
}

interface CredentialPolicy {
    expiresAt: Date
    scopes: IntegrationScope[]
    categoryAllowlistEnabled: boolean
    categoryIds: string[]
    paymentSourceAllowlistEnabled: boolean
    paymentSourceIds: string[]
    cidrAllowlistEnabled: boolean
    allowedCidrs: string[]
}

function normalizePolicy(input: IntegrationCredentialPolicyInput, now: Date): CredentialPolicy {
    if (
        typeof input.categoryAllowlistEnabled !== 'boolean' ||
        typeof input.paymentSourceAllowlistEnabled !== 'boolean'
    ) {
        throw new BadRequestException('Resource access policies must be selected')
    }
    const categoryIds = uniqueIds(input.allowedCategoryIds)
    const paymentSourceIds = uniqueIds(input.allowedPaymentSourceIds)
    const allowedCidrs = normalizeIntegrationCidrs(input.allowedCidrs ?? [])
    const cidrAllowlistEnabled = input.cidrAllowlistEnabled ?? false
    if (
        (!input.categoryAllowlistEnabled && categoryIds.length) ||
        (!input.paymentSourceAllowlistEnabled && paymentSourceIds.length) ||
        (!cidrAllowlistEnabled && allowedCidrs.length)
    ) {
        throw new BadRequestException('Resource restriction is not enabled')
    }
    return {
        expiresAt: validateExpiry(input.expiresAt, now),
        scopes: normalizeIntegrationScopes(input.scopes),
        categoryAllowlistEnabled: input.categoryAllowlistEnabled,
        categoryIds,
        paymentSourceAllowlistEnabled: input.paymentSourceAllowlistEnabled,
        paymentSourceIds,
        cidrAllowlistEnabled,
        allowedCidrs,
    }
}

function policySnapshot(credential: CredentialWithPolicy): Prisma.InputJsonObject {
    return {
        expires_at: credential.expiresAt.toISOString(),
        scopes: credential.scopes,
        category_allowlist_enabled: credential.categoryAllowlistEnabled,
        category_ids: credential.categoryRestrictions.map(({ categoryId }) => categoryId),
        payment_source_allowlist_enabled: credential.paymentSourceAllowlistEnabled,
        payment_source_ids: credential.paymentSourceRestrictions.map(
            ({ paymentSourceId }) => paymentSourceId,
        ),
        cidr_allowlist_enabled: credential.cidrAllowlistEnabled,
        allowed_cidrs: credential.allowedCidrs,
    }
}

function credentialData(
    policy: CredentialPolicy,
    material: ReturnType<typeof createIntegrationCredentialToken>,
    now: Date,
) {
    return {
        tokenPrefix: material.tokenPrefix,
        tokenDigest: digestIntegrationToken(material.token),
        createdAt: now,
        expiresAt: policy.expiresAt,
        scopes: policy.scopes,
        categoryAllowlistEnabled: policy.categoryAllowlistEnabled,
        paymentSourceAllowlistEnabled: policy.paymentSourceAllowlistEnabled,
        cidrAllowlistEnabled: policy.cidrAllowlistEnabled,
        allowedCidrs: policy.allowedCidrs,
        categoryRestrictions: { create: policy.categoryIds.map((categoryId) => ({ categoryId })) },
        paymentSourceRestrictions: {
            create: policy.paymentSourceIds.map((paymentSourceId) => ({ paymentSourceId })),
        },
    }
}

function issuedCredential(
    credential: { id: string; tokenPrefix: string; expiresAt: Date },
    token: string,
): CreatedIntegrationCredential {
    return {
        credentialId: credential.id,
        token,
        tokenPrefix: credential.tokenPrefix,
        expiresAt: credential.expiresAt,
    }
}

export function createIntegrationCredentialToken(): { token: string; tokenPrefix: string } {
    const prefix = `mqic_${randomBytes(9).toString('base64url')}`
    return { token: `${prefix}.${randomBytes(32).toString('base64url')}`, tokenPrefix: prefix }
}

export function digestIntegrationToken(token: string): string {
    return createHash('sha256').update(`${TOKEN_DIGEST_CONTEXT}${token}`, 'utf8').digest('hex')
}

function parseBearerToken(authorization: string | undefined): string | null {
    if (typeof authorization !== 'string') return null
    return /^Bearer (mqic_[A-Za-z0-9_-]{12}\.[A-Za-z0-9_-]{43})$/i.exec(authorization)?.[1] ?? null
}

function compareDigest(expectedDigest: string, actualDigest: string): boolean {
    const valid = /^[0-9a-f]{64}$/.test(expectedDigest)
    const expected = valid ? Buffer.from(expectedDigest, 'hex') : Buffer.alloc(32)
    const matches = timingSafeEqual(expected, Buffer.from(actualDigest, 'hex'))
    return valid && matches
}

function authenticationFailure(): UnauthorizedException {
    return new UnauthorizedException(AUTHENTICATION_FAILURE_MESSAGE)
}
function isAdministrator(role: string): boolean {
    return role === 'owner' || role === 'admin'
}

function validateExpiry(expiresAt: Date, now: Date): Date {
    const lifetime = expiresAt instanceof Date ? expiresAt.getTime() - now.getTime() : NaN
    if (!Number.isFinite(lifetime) || lifetime <= 0 || lifetime > MAX_CREDENTIAL_LIFETIME_MS) {
        throw new BadRequestException('Credential expiry is outside the permitted lifetime')
    }
    return expiresAt
}

function requireTrimmed(value: string, label: string): string {
    const normalized = value.trim()
    if (!normalized) throw new BadRequestException(`${label} is required`)
    return normalized
}

function uniqueIds(ids: readonly string[] | undefined): string[] {
    return [...new Set((ids ?? []).map((id) => requireTrimmed(id, 'Restriction id')))]
}
