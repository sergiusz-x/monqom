import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'
import { AuthService } from '../auth/auth.service'
import { TwoFactorService } from '../auth/twoFactor.service'
import {
    CreateIntegrationCredentialDto,
    CredentialStepUpDto,
    RotateIntegrationCredentialDto,
} from './integration-management.dto'
import {
    IntegrationCredentialService,
    type IntegrationCredentialPolicyInput,
} from './integration-credential.service'

// Management reads never load digests or operational source IPs.
const safeCredentialSelect = {
    id: true,
    tokenPrefix: true,
    status: true,
    createdAt: true,
    expiresAt: true,
    revokedAt: true,
    lastUsedAt: true,
    scopes: true,
    categoryAllowlistEnabled: true,
    paymentSourceAllowlistEnabled: true,
    cidrAllowlistEnabled: true,
    allowedCidrs: true,
    categoryRestrictions: { select: { categoryId: true } },
    paymentSourceRestrictions: { select: { paymentSourceId: true } },
} satisfies Prisma.IntegrationCredentialSelect

const safeIntegrationSelect = {
    id: true,
    name: true,
    status: true,
    createdAt: true,
    creatorReference: true,
    createdBy: { select: { name: true } },
    credentials: {
        where: { deletedAt: null },
        select: safeCredentialSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    },
} satisfies Prisma.IntegrationSelect

type SafeCredential = Prisma.IntegrationCredentialGetPayload<{
    select: typeof safeCredentialSelect
}>
type SafeIntegration = Prisma.IntegrationGetPayload<{ select: typeof safeIntegrationSelect }>

@Injectable()
export class IntegrationManagementService {
    constructor(
        private readonly authService: AuthService,
        private readonly twoFactorService: TwoFactorService,
        private readonly credentialService: IntegrationCredentialService,
        private readonly prisma: PrismaService,
    ) {}

    async create(workspaceId: string, userId: string, body: CreateIntegrationCredentialDto) {
        const policy = this.creationPolicy(body)
        this.credentialService.validateCredentialPolicy(policy)
        await this.validateRestrictions(workspaceId, policy)
        await this.verifyStepUp(userId, body)
        const credential = await this.credentialService.createIntegrationWithCredential({
            workspaceId,
            createdByUserId: userId,
            name: body.name,
            ...policy,
        })
        return {
            integration_id: credential.integrationId,
            credential_id: credential.credentialId,
            token: credential.token,
            token_prefix: credential.tokenPrefix,
            expires_at: credential.expiresAt,
        }
    }

    async list(workspaceId: string) {
        const integrations = await this.prisma.integration.findMany({
            where: {
                workspaceId,
                status: { not: 'deleted' },
                credentials: { some: { deletedAt: null } },
            },
            select: safeIntegrationSelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        })
        return integrations.map(safeIntegration)
    }

    async get(workspaceId: string, integrationId: string) {
        const integration = await this.prisma.integration.findFirst({
            where: {
                id: integrationId,
                workspaceId,
                status: { not: 'deleted' },
                credentials: { some: { deletedAt: null } },
            },
            select: safeIntegrationSelect,
        })
        if (!integration) throw new NotFoundException('Integration not found')
        return safeIntegration(integration)
    }

    async revoke(
        workspaceId: string,
        userId: string,
        integrationId: string,
        credentialId: string,
        body: CredentialStepUpDto,
    ) {
        await this.assertCredential(workspaceId, integrationId, credentialId)
        await this.verifyStepUp(userId, body)
        return {
            revoked: await this.credentialService.revokeCredential(
                credentialId,
                new Date(),
                userId,
                { workspaceId, integrationId },
            ),
        }
    }

    async rotate(
        workspaceId: string,
        userId: string,
        integrationId: string,
        credentialId: string,
        body: RotateIntegrationCredentialDto,
    ) {
        const previous = await this.assertCredential(workspaceId, integrationId, credentialId)
        const policy = this.rotationPolicy(body, previous)
        this.credentialService.validateCredentialPolicy(policy)
        await this.validateRestrictions(workspaceId, policy)
        await this.verifyStepUp(userId, body)
        const replacement = await this.credentialService.rotateCredential(
            credentialId,
            policy.expiresAt,
            new Date(),
            userId,
            { workspaceId, integrationId },
            policy,
        )
        return {
            credential_id: replacement.credentialId,
            token: replacement.token,
            token_prefix: replacement.tokenPrefix,
            expires_at: replacement.expiresAt,
        }
    }

    async remove(workspaceId: string, integrationId: string, credentialId: string, userId: string) {
        await this.credentialService.deleteCredential(credentialId, userId, {
            workspaceId,
            integrationId,
        })
        return { deleted: true }
    }

    private async assertCredential(
        workspaceId: string,
        integrationId: string,
        credentialId: string,
    ) {
        const credential = await this.prisma.integrationCredential.findFirst({
            where: {
                id: credentialId,
                integrationId,
                deletedAt: null,
                integration: { workspaceId, status: { not: 'deleted' } },
            },
            select: safeCredentialSelect,
        })
        if (!credential) throw new NotFoundException('Integration credential not found')
        return credential
    }

    private creationPolicy(body: CreateIntegrationCredentialDto): IntegrationCredentialPolicyInput {
        return {
            expiresAt: this.parseExpiry(body.expires_at),
            scopes: body.scopes,
            categoryAllowlistEnabled: body.category_allowlist_enabled,
            allowedCategoryIds: body.category_ids,
            paymentSourceAllowlistEnabled: body.payment_source_allowlist_enabled,
            allowedPaymentSourceIds: body.payment_source_ids,
            cidrAllowlistEnabled: body.cidr_allowlist_enabled,
            allowedCidrs: body.allowed_cidrs,
        }
    }

    private rotationPolicy(
        body: RotateIntegrationCredentialDto,
        previous: SafeCredential,
    ): IntegrationCredentialPolicyInput {
        if (body.category_ids !== undefined && body.category_allowlist_enabled === undefined)
            throw new BadRequestException('Category access policy must accompany category ids')
        if (
            body.payment_source_ids !== undefined &&
            body.payment_source_allowlist_enabled === undefined
        )
            throw new BadRequestException(
                'Payment source access policy must accompany payment source ids',
            )
        if (body.allowed_cidrs !== undefined && body.cidr_allowlist_enabled === undefined)
            throw new BadRequestException('CIDR access policy must accompany allowed CIDRs')
        return {
            expiresAt: this.parseExpiry(body.expires_at),
            scopes: body.scopes ?? previous.scopes,
            categoryAllowlistEnabled:
                body.category_allowlist_enabled ?? previous.categoryAllowlistEnabled,
            allowedCategoryIds:
                body.category_allowlist_enabled === undefined
                    ? previous.categoryRestrictions.map(({ categoryId }) => categoryId)
                    : (body.category_ids ?? []),
            paymentSourceAllowlistEnabled:
                body.payment_source_allowlist_enabled ?? previous.paymentSourceAllowlistEnabled,
            allowedPaymentSourceIds:
                body.payment_source_allowlist_enabled === undefined
                    ? previous.paymentSourceRestrictions.map(
                          ({ paymentSourceId }) => paymentSourceId,
                      )
                    : (body.payment_source_ids ?? []),
            cidrAllowlistEnabled: body.cidr_allowlist_enabled ?? previous.cidrAllowlistEnabled,
            allowedCidrs:
                body.cidr_allowlist_enabled === undefined
                    ? previous.allowedCidrs
                    : (body.allowed_cidrs ?? []),
        }
    }

    private async verifyStepUp(userId: string, body: CredentialStepUpDto): Promise<void> {
        // Verify on every high-risk request; no reusable client-supplied timestamp or proof.
        const startedAt = Date.now()
        await this.authService.verifyCurrentPassword(userId, body.current_password)
        await this.twoFactorService.verifyStepUp(userId, body.two_factor_token)
        if (Date.now() - startedAt > 5 * 60_000)
            throw new UnauthorizedException('Recent authentication is required')
    }

    private async validateRestrictions(
        workspaceId: string,
        policy: IntegrationCredentialPolicyInput,
    ) {
        const categoryIds = [...new Set(policy.allowedCategoryIds ?? [])]
        const paymentSourceIds = [...new Set(policy.allowedPaymentSourceIds ?? [])]
        const [categories, sources] = await Promise.all([
            this.prisma.category.count({
                where: { workspaceId, id: { in: categoryIds }, deletedAt: null },
            }),
            this.prisma.paymentSource.count({
                where: { workspaceId, id: { in: paymentSourceIds }, deletedAt: null },
            }),
        ])
        if (categories !== categoryIds.length || sources !== paymentSourceIds.length)
            throw new BadRequestException('A resource restriction is invalid or archived')
    }

    private parseExpiry(value: string): Date {
        const expiresAt = new Date(value)
        const lifetime = expiresAt.getTime() - Date.now()
        if (!Number.isFinite(lifetime) || lifetime <= 0 || lifetime > 365 * 24 * 60 * 60 * 1000)
            throw new BadRequestException('Credential expiry is outside the permitted lifetime')
        return expiresAt
    }
}

function safeIntegration(integration: SafeIntegration) {
    return {
        id: integration.id,
        name: integration.name,
        status: integration.status,
        created_at: integration.createdAt,
        created_by: {
            id: integration.creatorReference,
            name: integration.createdBy?.name ?? 'Deleted user',
        },
        credentials: integration.credentials.map(safeCredential),
    }
}

function safeCredential(credential: SafeCredential) {
    return {
        id: credential.id,
        token_prefix: credential.tokenPrefix,
        status: credential.status,
        created_at: credential.createdAt,
        expires_at: credential.expiresAt,
        revoked_at: credential.revokedAt,
        last_used_at: credential.lastUsedAt,
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
