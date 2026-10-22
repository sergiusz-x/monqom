import {
    CanActivate,
    ExecutionContext,
    HttpException,
    Injectable,
    ServiceUnavailableException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request, Response } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { WorkspaceRoleGuard } from '../../shared/guards/workspace-role.guard'
import {
    IntegrationManagementAuditService,
    managementFailureStatus,
    managementOperation,
} from './integration-management-audit.service'
import {
    IntegrationRateLimitExceededError,
    IntegrationRateLimitService,
} from './integration-rate-limit.service'

@Injectable()
export class IntegrationManagementGuard implements CanActivate {
    constructor(
        private readonly session: SessionGuard,
        private readonly workspace: WorkspaceGuard,
        private readonly role: WorkspaceRoleGuard,
        private readonly audit: IntegrationManagementAuditService,
        private readonly reflector: Reflector,
        private readonly rateLimit: IntegrationRateLimitService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>()
        const response = context.switchToHttp().getResponse<Response>()
        response.setHeader('Cache-Control', 'no-store')
        response.setHeader('Pragma', 'no-cache')
        let userId: string | undefined
        let workspaceId: string | undefined
        let authorized = false
        const operation = managementOperation(this.reflector, context)
        try {
            await this.session.canActivate(context)
            userId = request.session.auth?.userId
            await this.workspace.canActivate(context)
            workspaceId = request.workspace?.workspaceId
            this.role.canActivate(context)
            authorized = true
            if (operation === 'create' || operation === 'rotate' || operation === 'revoke') {
                await this.rateLimit.consumeManagementStepUp(userId!, request.ip)
            }
            return true
        } catch (error) {
            let failure: unknown = error
            if (error instanceof IntegrationRateLimitExceededError) {
                response.setHeader('Retry-After', String(error.retryAfterSeconds))
                failure = new HttpException(
                    {
                        statusCode: 429,
                        message:
                            'Too many integration management attempts. Please try again later.',
                        error: 'Too Many Requests',
                        code: 'RATE_LIMITED',
                    },
                    429,
                )
            }
            // The workspace guard can establish membership before a role denial.
            await this.audit.denied(
                request,
                operation,
                {
                    userId,
                    workspaceId:
                        workspaceId ?? (userId ? request.workspace?.workspaceId : undefined),
                },
                managementFailureStatus(failure),
                'AUTHORIZATION',
                authorized,
            )
            if (failure instanceof HttpException) throw failure
            throw new ServiceUnavailableException('Integration management is unavailable')
        }
    }
}
