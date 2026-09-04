import { Injectable, UnauthorizedException } from '@nestjs/common'
import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { isIP } from 'net'
import { PrismaService } from '../../shared/database/prisma.service'
import { AuditService } from '../../shared/audit/audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../shared/audit/audit.types'
import { IntegrationScope, normalizeIntegrationScopes } from './integration-scopes'

const TOKEN_PREFIX_BYTES = 9
const TOKEN_SECRET_BYTES = 32
const TOKEN_DIGEST_CONTEXT = 'monqom-integration-credential:v1:'
const AUTHENTICATION_FAILURE_MESSAGE = 'Integration authentication failed'
const MAX_CREDENTIAL_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000
const MIN_CREDENTIAL_LIFETIME_MS = 60 * 1000

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

export interface CreatedIntegrationCredential {
    credentialId: string
    token: string
    tokenPrefix: string
    expiresAt: Date
}

@Injectable()
export class IntegrationCredentialService {
    private readonly dummyDigest = digestIntegrationToken('mqic_dummy.dummy')

    constructor(
        private readonly prisma: PrismaService,
        private readonly auditService: AuditService,
    ) {}

    async createIntegration(input: CreateIntegrationInput) {
        const workspaceId = requireTrimmed(input.workspaceId, 'Workspace id')
        const createdByUserId = requireTrimmed(input.createdByUserId, 'Creator id')
        const name = requireTrimmed(input.name, 'Integration name')

        return this.prisma.$transaction(async (tx) => {
            const integration = await tx.integration.create({
                data: { workspaceId, createdByUserId, name },
            })
            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.INTEGRATION_CREATED,
                    workspaceId,
                    userId: createdByUserId,
                    entityType: AUDIT_ENTITY_TYPES.INTEGRATION,
                    entityId: integration.id,
                },
                tx,
            )
            return integration
        })
    }

    async createCredential(
        input: CreateIntegrationCredentialInput,
        now = new Date(),
    ): Promise<CreatedIntegrationCredential> {
        const expiresAt = validateExpiry(input.expiresAt, now)
        const scopes = normalizeIntegrationScopes(input.scopes)
        const allowedCidrs = normalizeCidrs(input.allowedCidrs ?? [])
        const tokenMaterial = createIntegrationCredentialToken()

        const credential = await this.prisma.$transaction(async (tx) => {
            const created = await tx.integrationCredential.create({
                data: {
                    integrationId: requireTrimmed(input.integrationId, 'Integration id'),
                    tokenPrefix: tokenMaterial.tokenPrefix,
                    tokenDigest: digestIntegrationToken(tokenMaterial.token),
                    expiresAt,
                    scopes,
                    categoryAllowlistEnabled: input.categoryAllowlistEnabled ?? false,
                    paymentSourceAllowlistEnabled: input.paymentSourceAllowlistEnabled ?? false,
                    cidrAllowlistEnabled: input.cidrAllowlistEnabled ?? false,
                    allowedCidrs,
                    categoryRestrictions: {
                        create: uniqueIds(input.allowedCategoryIds).map((categoryId) => ({
                            categoryId,
                        })),
                    },
                    paymentSourceRestrictions: {
                        create: uniqueIds(input.allowedPaymentSourceIds).map((paymentSourceId) => ({
                            paymentSourceId,
                        })),
                    },
                },
                include: { integration: { select: { workspaceId: true, createdByUserId: true } } },
            })
            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.INTEGRATION_CREDENTIAL_ISSUED,
                    workspaceId: created.integration.workspaceId,
                    userId: created.integration.createdByUserId,
                    entityType: AUDIT_ENTITY_TYPES.INTEGRATION_CREDENTIAL,
                    entityId: created.id,
                    metadata: {
                        integration_id: created.integrationId,
                        token_prefix: created.tokenPrefix,
                        expires_at: created.expiresAt.toISOString(),
                        scopes,
                        category_allowlist_enabled: created.categoryAllowlistEnabled,
                        payment_source_allowlist_enabled: created.paymentSourceAllowlistEnabled,
                        cidr_allowlist_enabled: created.cidrAllowlistEnabled,
                    },
                },
                tx,
            )
            return created
        })

        return {
            credentialId: credential.id,
            token: tokenMaterial.token,
            tokenPrefix: tokenMaterial.tokenPrefix,
            expiresAt: credential.expiresAt,
        }
    }

    async revokeCredential(credentialId: string, now = new Date()): Promise<boolean> {
        return this.prisma.$transaction(async (tx) => {
            const credential = await tx.integrationCredential.findUnique({
                where: { id: requireTrimmed(credentialId, 'Credential id') },
                include: { integration: { select: { workspaceId: true, createdByUserId: true } } },
            })
            if (!credential || credential.status === 'revoked') return false

            const revoked = await tx.integrationCredential.updateMany({
                where: { id: credential.id, status: 'active', revokedAt: null },
                data: { status: 'revoked', revokedAt: now },
            })
            if (revoked.count === 0) return false

            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.INTEGRATION_CREDENTIAL_REVOKED,
                    workspaceId: credential.integration.workspaceId,
                    userId: credential.integration.createdByUserId,
                    entityType: AUDIT_ENTITY_TYPES.INTEGRATION_CREDENTIAL,
                    entityId: credential.id,
                    metadata: {
                        integration_id: credential.integrationId,
                        token_prefix: credential.tokenPrefix,
                    },
                },
                tx,
            )
            return true
        })
    }

    async rotateCredential(
        credentialId: string,
        expiresAt: Date,
        now = new Date(),
    ): Promise<CreatedIntegrationCredential> {
        const expiry = validateExpiry(expiresAt, now)
        const material = createIntegrationCredentialToken()
        return this.prisma.$transaction(async (tx) => {
            const previous = await tx.integrationCredential.findUnique({
                where: { id: requireTrimmed(credentialId, 'Credential id') },
                include: { categoryRestrictions: true, paymentSourceRestrictions: true },
            })
            if (!previous || previous.status !== 'active' || previous.revokedAt) {
                throw new UnauthorizedException('Integration credential cannot be rotated')
            }
            const replacement = await tx.integrationCredential.create({
                data: {
                    integrationId: previous.integrationId,
                    tokenPrefix: material.tokenPrefix,
                    tokenDigest: digestIntegrationToken(material.token),
                    expiresAt: expiry,
                    scopes: previous.scopes,
                    categoryAllowlistEnabled: previous.categoryAllowlistEnabled,
                    paymentSourceAllowlistEnabled: previous.paymentSourceAllowlistEnabled,
                    cidrAllowlistEnabled: previous.cidrAllowlistEnabled,
                    allowedCidrs: previous.allowedCidrs,
                    categoryRestrictions: {
                        create: previous.categoryRestrictions.map(({ categoryId }) => ({
                            categoryId,
                        })),
                    },
                    paymentSourceRestrictions: {
                        create: previous.paymentSourceRestrictions.map(({ paymentSourceId }) => ({
                            paymentSourceId,
                        })),
                    },
                },
            })
            await tx.integrationCredential.update({
                where: { id: previous.id },
                data: { status: 'revoked', revokedAt: now },
            })
            return {
                credentialId: replacement.id,
                token: material.token,
                tokenPrefix: material.tokenPrefix,
                expiresAt: replacement.expiresAt,
            }
        })
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

        const tokenPrefix = token.slice(0, token.indexOf('.'))
        const credential = await this.prisma.integrationCredential.findUnique({
            where: { tokenPrefix },
            include: {
                integration: true,
                categoryRestrictions: { select: { categoryId: true } },
                paymentSourceRestrictions: { select: { paymentSourceId: true } },
            },
        })
        const expectedDigest = credential?.tokenDigest ?? this.dummyDigest
        const tokenMatches = compareDigest(expectedDigest, digestIntegrationToken(token))

        if (
            !credential ||
            !tokenMatches ||
            credential.status !== 'active' ||
            credential.revokedAt !== null ||
            credential.expiresAt <= now ||
            credential.integration.status !== 'active' ||
            !isIpAllowed(clientIp, credential.allowedCidrs, credential.cidrAllowlistEnabled)
        ) {
            throw authenticationFailure()
        }

        // Usage metadata is intentionally best-effort: authentication never succeeds because this
        // bookkeeping write did, and it is throttled to one write per credential per five minutes.
        if (
            !credential.lastUsedAt ||
            now.getTime() - credential.lastUsedAt.getTime() >= 5 * 60_000
        ) {
            await this.prisma.integrationCredential.updateMany({
                where: {
                    id: credential.id,
                    status: 'active',
                    revokedAt: null,
                    expiresAt: { gt: now },
                    OR: [
                        { lastUsedAt: null },
                        { lastUsedAt: { lte: new Date(now.getTime() - 5 * 60_000) } },
                    ],
                },
                data: { lastUsedAt: now },
            })
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
            allowedCidrs: credential.allowedCidrs,
        }
    }
}

export function createIntegrationCredentialToken(): { token: string; tokenPrefix: string } {
    const tokenPrefix = randomBytes(TOKEN_PREFIX_BYTES).toString('base64url')
    const secret = randomBytes(TOKEN_SECRET_BYTES).toString('base64url')
    return { token: `mqic_${tokenPrefix}.${secret}`, tokenPrefix: `mqic_${tokenPrefix}` }
}

export function digestIntegrationToken(token: string): string {
    return createHash('sha256').update(`${TOKEN_DIGEST_CONTEXT}${token}`, 'utf8').digest('hex')
}

function parseBearerToken(authorization: string | undefined): string | null {
    if (typeof authorization !== 'string') return null
    const match = /^Bearer (mqic_[A-Za-z0-9_-]{12}\.[A-Za-z0-9_-]{43})$/.exec(authorization)
    return match?.[1] ?? null
}

function compareDigest(expectedDigest: string, actualDigest: string): boolean {
    const expected = Buffer.from(expectedDigest, 'hex')
    const actual = Buffer.from(actualDigest, 'hex')
    return expected.length === actual.length && timingSafeEqual(expected, actual)
}

function authenticationFailure(): UnauthorizedException {
    return new UnauthorizedException(AUTHENTICATION_FAILURE_MESSAGE)
}

function validateExpiry(expiresAt: Date, now: Date): Date {
    if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
        throw new Error('Credential expiry must be a valid date')
    }
    const lifetime = expiresAt.getTime() - now.getTime()
    if (lifetime < MIN_CREDENTIAL_LIFETIME_MS || lifetime > MAX_CREDENTIAL_LIFETIME_MS) {
        throw new Error('Credential expiry is outside the permitted lifetime')
    }
    return expiresAt
}

function requireTrimmed(value: string, label: string): string {
    const normalized = value.trim()
    if (!normalized) throw new Error(`${label} is required`)
    return normalized
}

function uniqueIds(ids: readonly string[] | undefined): string[] {
    return [...new Set((ids ?? []).map((id) => requireTrimmed(id, 'Restriction id')))]
}

function normalizeCidrs(cidrs: readonly string[]): string[] {
    return [...new Set(cidrs.map((cidr) => cidr.trim()))].map((cidr) => {
        if (!isValidCidr(cidr)) throw new Error('Credential CIDR restriction is invalid')
        return cidr
    })
}

function isIpAllowed(
    clientIp: string | undefined,
    allowedCidrs: readonly string[],
    allowlistEnabled: boolean,
): boolean {
    if (!allowlistEnabled) return true
    if (!clientIp) return false
    return allowedCidrs.some((cidr) => cidrContains(cidr, clientIp))
}

function isValidCidr(cidr: string): boolean {
    const [address, prefix, ...extra] = cidr.split('/')
    if (!address || !prefix || extra.length > 0 || !isIP(address)) return false
    const parsedPrefix = Number(prefix)
    const maxPrefix = isIP(address) === 4 ? 32 : 128
    return Number.isInteger(parsedPrefix) && parsedPrefix >= 0 && parsedPrefix <= maxPrefix
}

function cidrContains(cidr: string, ip: string): boolean {
    const [network, prefixText] = cidr.split('/') as [string, string]
    const family = isIP(network)
    if (!family || family !== isIP(ip)) return false
    const prefix = Number(prefixText)
    const networkValue = ipToBigInt(network, family)
    const clientValue = ipToBigInt(ip, family)
    const bits = family === 4 ? 32n : 128n
    const mask = prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << (bits - BigInt(prefix))
    return (networkValue & mask) === (clientValue & mask)
}

function ipToBigInt(ip: string, family: number): bigint {
    if (family === 4) {
        return ip.split('.').reduce((value, part) => (value << 8n) + BigInt(Number(part)), 0n)
    }
    const [head, tail = ''] = ip.toLowerCase().split('::')
    const headParts = head ? head.split(':').filter(Boolean) : []
    const tailParts = tail ? tail.split(':').filter(Boolean) : []
    const missing = 8 - headParts.length - tailParts.length
    const parts = [...headParts, ...Array(Math.max(0, missing)).fill('0'), ...tailParts]
    return parts.reduce((value, part) => (value << 16n) + BigInt(`0x${part}`), 0n)
}
