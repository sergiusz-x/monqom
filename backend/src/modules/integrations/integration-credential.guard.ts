import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    HttpException,
    Injectable,
    NotFoundException,
    SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { IntegrationScope } from './integration-scopes'
import { IntegrationCredentialService } from './integration-credential.service'
import {
    IntegrationRateLimitExceededError,
    IntegrationRateLimitService,
} from './integration-rate-limit.service'

const INTEGRATION_SCOPES_METADATA_KEY = 'integration_scopes'

export const RequireIntegrationScopes = (...scopes: IntegrationScope[]) =>
    SetMetadata(INTEGRATION_SCOPES_METADATA_KEY, scopes)

@Injectable()
export class IntegrationCredentialGuard implements CanActivate {
    constructor(
        private readonly credentialService: IntegrationCredentialService,
        private readonly rateLimitService: IntegrationRateLimitService,
        private readonly reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>()
        let principal
        try {
            principal = await this.credentialService.authenticateAuthorizationHeader(
                request.get('authorization'),
                request.ip,
            )
        } catch (error) {
            await this.consumeFailedAuthentication(context, request)
            throw error
        }
        await this.consumeCredential(context, principal.credentialId)
        const workspaceParam = request.params?.workspaceId
        const requestedWorkspaceId = typeof workspaceParam === 'string' ? workspaceParam.trim() : ''
        if (!requestedWorkspaceId || requestedWorkspaceId !== principal.workspaceId) {
            throw new NotFoundException('Workspace not found')
        }
        const requiredScopes = this.reflector.getAllAndOverride<IntegrationScope[]>(
            INTEGRATION_SCOPES_METADATA_KEY,
            [context.getHandler(), context.getClass()],
        )
        if (!requiredScopes || !requiredScopes.every((scope) => principal.scopes.includes(scope))) {
            throw new ForbiddenException('Insufficient integration permissions')
        }
        request.machine = principal
        return true
    }

    private async consumeCredential(
        context: ExecutionContext,
        credentialId: string,
    ): Promise<void> {
        try {
            await this.rateLimitService.consumeCredential(credentialId)
        } catch (error) {
            this.rethrowRateLimit(context, error)
        }
    }

    private async consumeFailedAuthentication(
        context: ExecutionContext,
        request: Request,
    ): Promise<void> {
        try {
            await this.rateLimitService.consumeFailedAuthentication(request.ip)
        } catch (error) {
            this.rethrowRateLimit(context, error)
        }
    }

    private rethrowRateLimit(context: ExecutionContext, error: unknown): never | void {
        if (!(error instanceof IntegrationRateLimitExceededError)) throw error
        context
            .switchToHttp()
            .getResponse()
            .setHeader('Retry-After', String(error.retryAfterSeconds))
        throw new HttpException(
            {
                statusCode: 429,
                message: 'Integration rate limit exceeded',
                error: 'Too Many Requests',
                code: 'RATE_LIMITED',
            },
            429,
        )
    }
}
