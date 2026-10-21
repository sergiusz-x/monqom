import { HttpException, Injectable, ServiceUnavailableException, SetMetadata } from '@nestjs/common'
import type { ExecutionContext } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { AuditService } from '../../shared/audit/audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../shared/audit/audit.types'
import { PrismaService } from '../../shared/database/prisma.service'

export type ManagementOperation = 'create' | 'list' | 'get' | 'rotate' | 'revoke' | 'delete'
const MANAGEMENT_OPERATION = 'integration-management-operation'
export const IntegrationManagementAction = (operation: ManagementOperation) =>
    SetMetadata(MANAGEMENT_OPERATION, operation)

export function managementOperation(
    reflector: Reflector,
    context: ExecutionContext,
): ManagementOperation {
    return reflector.get<ManagementOperation>(MANAGEMENT_OPERATION, context.getHandler())
}

interface VerifiedActor {
    userId?: string
    workspaceId?: string
}

interface ManagementTarget {
    integrationId?: string
    credentialId?: string
}

@Injectable()
export class IntegrationManagementAuditService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly audit: AuditService,
    ) {}

    async denied(
        request: Request,
        operation: ManagementOperation,
        actor: VerifiedActor,
        status: number,
        phase: 'AUTHORIZATION' | 'REQUEST' | 'CSRF',
        resolveTarget = false,
        target?: ManagementTarget,
    ): Promise<void> {
        await this.record(
            request,
            operation,
            actor,
            {
                outcome: 'denied',
                status,
                reason: phase === 'CSRF' ? 'CSRF_DENIED' : denialReason(status, phase),
            },
            resolveTarget,
            target,
        )
    }

    async read(request: Request, operation: 'list' | 'get', actor: VerifiedActor): Promise<void> {
        await this.record(
            request,
            operation,
            actor,
            { outcome: 'succeeded', status: 200, reason: 'METADATA_READ' },
            true,
        )
    }

    async csrfDenied(request: Request): Promise<void> {
        // CSRF middleware runs before controller guards. Resolve only authoritative session data.
        const path = request.path
        const createPath = /^\/api\/v1\/workspaces\/([^/]+)\/integrations\/?$/i.exec(path)
        const lifecyclePath =
            /^\/api\/v1\/workspaces\/([^/]+)\/integrations\/([^/]+)\/credentials\/([^/]+)\/(rotate|revoke)\/?$/i.exec(
                path,
            )
        const deletePath =
            /^\/api\/v1\/workspaces\/([^/]+)\/integrations\/([^/]+)\/credentials\/([^/]+)\/?$/i.exec(
                path,
            )
        const target = createPath ?? lifecyclePath ?? deletePath
        if (!target) return
        if (request.method === 'POST' && !createPath && !lifecyclePath) return
        if (request.method === 'DELETE' && !deletePath) return
        if (request.method !== 'POST' && request.method !== 'DELETE') return
        const operation: ManagementOperation = createPath
            ? 'create'
            : request.method === 'DELETE'
              ? 'delete'
              : lifecyclePath?.[4]?.toLowerCase() === 'rotate'
                ? 'rotate'
                : 'revoke'
        const workspaceParam = decodePathParam(target[1])
        const routeTarget: ManagementTarget = {
            integrationId: decodePathParam(lifecyclePath?.[2] ?? deletePath?.[2]),
            credentialId: decodePathParam(lifecyclePath?.[3] ?? deletePath?.[3]),
        }
        try {
            const session = request.session?.auth
            const user =
                session?.userId && typeof session.sessionVersion === 'number'
                    ? await this.prisma.user.findFirst({
                          where: { id: session.userId, sessionVersion: session.sessionVersion },
                          select: { id: true },
                      })
                    : null
            const membership =
                user && workspaceParam
                    ? await this.prisma.workspaceMembership.findFirst({
                          where: { userId: user.id, workspaceId: workspaceParam },
                          select: { workspaceId: true },
                      })
                    : null
            await this.denied(
                request,
                operation,
                {
                    userId: user?.id,
                    workspaceId: membership?.workspaceId,
                },
                403,
                'CSRF',
                true,
                routeTarget,
            )
        } catch {
            throw new ServiceUnavailableException('Integration audit is unavailable')
        }
    }

    private async record(
        request: Request,
        operation: ManagementOperation,
        actor: VerifiedActor,
        result: { outcome: 'succeeded' | 'denied'; status: number; reason: string },
        resolveTarget: boolean,
        target?: ManagementTarget,
    ): Promise<void> {
        try {
            // Never persist raw request parameters, bodies, passwords, tokens or exception text.
            const integrationId = target
                ? target.integrationId
                : getSingleParam(request.params.integrationId)
            const credentialId = target
                ? target.credentialId
                : getSingleParam(request.params.credentialId)
            const integration =
                resolveTarget && actor.workspaceId && integrationId
                    ? await this.prisma.integration.findFirst({
                          where: {
                              id: integrationId,
                              workspaceId: actor.workspaceId,
                          },
                          select: { id: true },
                      })
                    : null
            const credential =
                integration && credentialId
                    ? await this.prisma.integrationCredential.findFirst({
                          where: {
                              id: credentialId,
                              integrationId: integration.id,
                          },
                          select: { id: true, tokenPrefix: true },
                      })
                    : null
            await this.audit.record({
                action:
                    result.outcome === 'denied'
                        ? AUDIT_ACTIONS.INTEGRATION_MANAGEMENT_DENIED
                        : AUDIT_ACTIONS.INTEGRATION_MANAGEMENT_READ,
                workspaceId: actor.workspaceId ?? null,
                userId: actor.userId ?? null,
                entityType: credential
                    ? AUDIT_ENTITY_TYPES.INTEGRATION_CREDENTIAL
                    : AUDIT_ENTITY_TYPES.INTEGRATION,
                entityId: credential?.id ?? integration?.id ?? null,
                metadata: {
                    operation,
                    ...result,
                    integration_id: integration?.id ?? null,
                    credential_id: credential?.id ?? null,
                    token_prefix: credential?.tokenPrefix ?? null,
                },
            })
        } catch {
            throw new ServiceUnavailableException('Integration audit is unavailable')
        }
    }
}

export function managementFailureStatus(error: unknown): number {
    return error instanceof HttpException ? error.getStatus() : 503
}

function denialReason(status: number, phase: 'AUTHORIZATION' | 'REQUEST'): string {
    if (status === 429) return 'RATE_LIMITED'
    if (status >= 500) return 'PERSISTENCE_UNAVAILABLE'
    if (phase === 'AUTHORIZATION') return 'AUTHORIZATION_DENIED'
    if (status === 400) return 'INVALID_REQUEST'
    if (status === 401) return 'STEP_UP_DENIED'
    if (status === 403) return 'AUTHORITY_LOST'
    if (status === 404) return 'TARGET_UNAVAILABLE'
    if (status === 409) return 'LIFECYCLE_CONFLICT'
    return 'PERSISTENCE_UNAVAILABLE'
}

function getSingleParam(value: string | string[] | undefined): string | undefined {
    if (typeof value === 'string') return value
    return value?.length === 1 ? value[0] : undefined
}

function decodePathParam(value: string | undefined): string | undefined {
    if (!value) return undefined
    try {
        return decodeURIComponent(value)
    } catch {
        return undefined
    }
}
