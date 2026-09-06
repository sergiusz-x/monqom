import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { IntegrationCredential } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'
import { AuthService } from '../auth/auth.service'
import { TwoFactorService } from '../auth/twoFactor.service'
import {
    CreateIntegrationCredentialDto,
    RotateIntegrationCredentialDto,
} from './integration-management.dto'
import { IntegrationCredentialService } from './integration-credential.service'

@Injectable()
export class IntegrationManagementService {
    constructor(
        private readonly authService: AuthService,
        private readonly twoFactorService: TwoFactorService,
        private readonly credentialService: IntegrationCredentialService,
        private readonly prisma: PrismaService,
    ) {}

    async create(workspaceId: string, userId: string, body: CreateIntegrationCredentialDto) {
        const expiresAt = this.parseExpiry(body.expires_at)
        this.requireExplicitResourcePolicies(body)
        await this.authService.verifyCurrentPassword(userId, body.current_password)
        await this.twoFactorService.verifyStepUp(userId, body.two_factor_token)
        await this.validateRestrictions(workspaceId, body)

        const integration = await this.credentialService.createIntegration({
            workspaceId,
            createdByUserId: userId,
            name: body.name,
        })
        const credential = await this.credentialService.createCredential({
            integrationId: integration.id,
            expiresAt,
            scopes: body.scopes,
            categoryAllowlistEnabled: body.category_allowlist_enabled,
            allowedCategoryIds: body.category_ids,
            paymentSourceAllowlistEnabled: body.payment_source_allowlist_enabled,
            allowedPaymentSourceIds: body.payment_source_ids,
            cidrAllowlistEnabled: body.cidr_allowlist_enabled,
            allowedCidrs: body.allowed_cidrs,
        })
        return {
            integration_id: integration.id,
            credential_id: credential.credentialId,
            token: credential.token,
            token_prefix: credential.tokenPrefix,
            expires_at: credential.expiresAt,
        }
    }

    async list(workspaceId: string) {
        const integrations = await this.prisma.integration.findMany({
            where: { workspaceId, status: { not: 'deleted' }, credentials: { some: {} } },
            include: {
                createdBy: { select: { id: true, name: true } },
                credentials: {
                    include: {
                        categoryRestrictions: { select: { categoryId: true } },
                        paymentSourceRestrictions: { select: { paymentSourceId: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        })
        return integrations.map((integration) => ({
            id: integration.id,
            name: integration.name,
            status: integration.status,
            created_at: integration.createdAt,
            created_by: { id: integration.createdBy.id, name: integration.createdBy.name },
            credentials: integration.credentials.map((credential) =>
                this.safeCredential(credential),
            ),
        }))
    }

    async get(workspaceId: string, integrationId: string) {
        const integration = await this.prisma.integration.findFirst({
            where: { id: integrationId, workspaceId },
            include: {
                createdBy: { select: { id: true, name: true } },
                credentials: {
                    include: {
                        categoryRestrictions: { select: { categoryId: true } },
                        paymentSourceRestrictions: { select: { paymentSourceId: true } },
                    },
                },
            },
        })
        if (!integration) throw new NotFoundException('Integration not found')
        return {
            id: integration.id,
            name: integration.name,
            status: integration.status,
            created_at: integration.createdAt,
            created_by: { id: integration.createdBy.id, name: integration.createdBy.name },
            credentials: integration.credentials.map((credential) =>
                this.safeCredential(credential),
            ),
        }
    }

    async revoke(
        workspaceId: string,
        userId: string,
        integrationId: string,
        credentialId: string,
        body: { current_password: string; two_factor_token?: string },
    ) {
        await this.authService.verifyCurrentPassword(userId, body.current_password)
        await this.twoFactorService.verifyStepUp(userId, body.two_factor_token)
        await this.assertCredential(workspaceId, integrationId, credentialId)
        return { revoked: await this.credentialService.revokeCredential(credentialId) }
    }

    async rotate(
        workspaceId: string,
        userId: string,
        integrationId: string,
        credentialId: string,
        body: RotateIntegrationCredentialDto,
    ) {
        const previous = await this.assertCredential(workspaceId, integrationId, credentialId)
        if (previous.status !== 'active') throw new BadRequestException('Credential is not active')
        const expiresAt = this.parseExpiry(body.expires_at)
        await this.authService.verifyCurrentPassword(userId, body.current_password)
        await this.twoFactorService.verifyStepUp(userId, body.two_factor_token)
        const replacement = await this.credentialService.rotateCredential(credentialId, expiresAt)
        return {
            credential_id: replacement.credentialId,
            token: replacement.token,
            token_prefix: replacement.tokenPrefix,
            expires_at: replacement.expiresAt,
        }
    }

    async remove(workspaceId: string, integrationId: string, credentialId: string) {
        const credential = await this.assertCredential(workspaceId, integrationId, credentialId)
        if (credential.status !== 'revoked')
            throw new BadRequestException('Credential must be revoked before deletion')
        await this.prisma.integrationCredential.delete({ where: { id: credentialId } })
        const remainingCredentials = await this.prisma.integrationCredential.count({
            where: { integrationId },
        })
        if (remainingCredentials === 0) {
            await this.prisma.integration.update({
                where: { id: integrationId },
                data: { status: 'deleted' },
            })
        }
        return { deleted: true }
    }

    private async assertCredential(
        workspaceId: string,
        integrationId: string,
        credentialId: string,
    ) {
        const credential = await this.prisma.integrationCredential.findFirst({
            where: { id: credentialId, integrationId, integration: { workspaceId } },
        })
        if (!credential) throw new NotFoundException('Integration credential not found')
        return credential
    }

    private async validateRestrictions(workspaceId: string, body: CreateIntegrationCredentialDto) {
        await this.validateIds(
            'category',
            workspaceId,
            body.category_allowlist_enabled ?? false,
            body.category_ids ?? [],
        )
        await this.validateIds(
            'paymentSource',
            workspaceId,
            body.payment_source_allowlist_enabled ?? false,
            body.payment_source_ids ?? [],
        )
    }

    private async validateIds(
        kind: 'category' | 'paymentSource',
        workspaceId: string,
        enabled: boolean,
        ids: string[],
    ) {
        const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
        if (!enabled && uniqueIds.length)
            throw new BadRequestException('Resource restriction is not enabled')
        if (!uniqueIds.length) return
        const count =
            kind === 'category'
                ? await this.prisma.category.count({
                      where: { workspaceId, id: { in: uniqueIds }, deletedAt: null },
                  })
                : await this.prisma.paymentSource.count({
                      where: { workspaceId, id: { in: uniqueIds }, deletedAt: null },
                  })
        if (count !== uniqueIds.length)
            throw new BadRequestException('A resource restriction is invalid or archived')
    }

    private parseExpiry(value: string): Date {
        const expiresAt = new Date(value)
        if (Number.isNaN(expiresAt.getTime()))
            throw new BadRequestException('Credential expiry is invalid')
        const lifetime = expiresAt.getTime() - Date.now()
        if (lifetime < 60_000 || lifetime > 365 * 24 * 60 * 60 * 1000)
            throw new BadRequestException('Credential expiry is outside the permitted lifetime')
        return expiresAt
    }

    private requireExplicitResourcePolicies(body: CreateIntegrationCredentialDto) {
        if (!body.scopes.includes('transactions:create')) return
        if (body.category_allowlist_enabled === undefined)
            throw new BadRequestException('Category access policy must be selected')
        if (body.payment_source_allowlist_enabled === undefined)
            throw new BadRequestException('Payment source access policy must be selected')
    }

    private safeCredential(
        credential: IntegrationCredential & {
            categoryRestrictions: { categoryId: string }[]
            paymentSourceRestrictions: { paymentSourceId: string }[]
        },
    ) {
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
}
