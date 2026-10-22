import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    HttpException,
    Injectable,
    NotFoundException,
    SetMetadata,
    UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request, Response } from 'express'
import { IntegrationScope, isIntegrationScope } from './integration-scopes'
import { IntegrationCredentialService } from './integration-credential.service'
import { isIntegrationLoopback, normalizeIntegrationClientIp } from './integration-network-policy'
import {
    IntegrationRateLimitExceededError,
    IntegrationRateLimitService,
} from './integration-rate-limit.service'

const INTEGRATION_SCOPES_METADATA_KEY = 'integration_scopes'
const MUTATION_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH'])
const ALTERNATE_CREDENTIAL_FIELDS = new Set([
    'token',
    'accesstoken',
    'bearertoken',
    'apikey',
    'apitoken',
    'authorization',
    'credential',
    'integrationtoken',
    'integrationcredential',
    'clientsecret',
    'secret',
    'xapikey',
    'xapitoken',
    'xauthtoken',
    'xaccesstoken',
    'xintegrationtoken',
    'xintegrationcredential',
])

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
        const response = context.switchToHttp().getResponse<Response>()
        response.setHeader('Cache-Control', 'no-store')
        response.setHeader('Pragma', 'no-cache')
        delete request.machine
        const clientIp = normalizeIntegrationClientIp(request.ip)
        let principal
        try {
            await this.rateLimitService.assertSourceAllowed(clientIp)
            if (
                !clientIp ||
                !hasSecureTransport(request) ||
                hasAlternateCredentials(request) ||
                request.rawHeaders.filter(
                    (value, index) => index % 2 === 0 && value.toLowerCase() === 'authorization',
                ).length !== 1
            ) {
                throw new UnauthorizedException('Integration authentication failed')
            }
            principal = await this.credentialService.authenticateAuthorizationHeader(
                request.get('authorization'),
                clientIp,
            )
        } catch (error) {
            if (error instanceof UnauthorizedException) {
                response.setHeader('WWW-Authenticate', 'Bearer')
                try {
                    await this.rateLimitService.consumeFailedAuthentication(clientIp)
                } catch (limitError) {
                    this.rethrowRateLimit(context, limitError)
                }
            }
            this.rethrowRateLimit(context, error)
        }
        // The catch always throws; this also keeps authorization fail closed under unexpected changes.
        if (!principal) throw new UnauthorizedException('Integration authentication failed')
        try {
            await this.rateLimitService.consumeCredential(
                principal.credentialId,
                undefined,
                MUTATION_METHODS.has(request.method.toUpperCase()),
                principal.workspaceId,
            )
        } catch (error) {
            this.rethrowRateLimit(context, error)
        }
        const workspaceId = request.params?.workspaceId
        if (typeof workspaceId !== 'string' || workspaceId !== principal.workspaceId) {
            await this.credentialService.recordDeniedAccess(principal, 'WORKSPACE_DENIED')
            throw new NotFoundException('Workspace not found')
        }
        const requiredScopes = this.reflector.getAllAndOverride<unknown>(
            INTEGRATION_SCOPES_METADATA_KEY,
            [context.getHandler(), context.getClass()],
        )
        if (
            !Array.isArray(requiredScopes) ||
            requiredScopes.length === 0 ||
            !requiredScopes.every(
                (scope: unknown) =>
                    typeof scope === 'string' &&
                    isIntegrationScope(scope) &&
                    principal.scopes.includes(scope),
            )
        ) {
            await this.credentialService.recordDeniedAccess(principal, 'SCOPE_DENIED')
            throw new ForbiddenException('Insufficient integration permissions')
        }
        request.machine = principal
        return true
    }

    private rethrowRateLimit(context: ExecutionContext, error: unknown): never {
        if (!(error instanceof IntegrationRateLimitExceededError)) throw error
        context
            .switchToHttp()
            .getResponse<Response>()
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

function hasSecureTransport(request: Request): boolean {
    if (request.protocol === 'https') {
        // Express derives protocol from TLS or the configured trusted proxy, never a raw header alone.
        const forwarded = request.get('x-forwarded-proto')
        return forwarded === undefined || forwarded === 'https'
    }
    return (
        (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') &&
        request.protocol === 'http' &&
        isIntegrationLoopback(request.socket.remoteAddress) &&
        isIntegrationLoopback(request.ip)
    )
}

function hasAlternateCredentials(request: Request): boolean {
    const isCredentialField = (key: string): boolean =>
        ALTERNATE_CREDENTIAL_FIELDS.has(key.replace(/[-_]/g, '').toLowerCase())
    const hasCredentialField = (value: unknown, seen = new WeakSet<object>()): boolean => {
        if (typeof value === 'string') return /mqic(?:_|%5f)[A-Za-z0-9_%.-]+/i.test(value)
        if (value === null || typeof value !== 'object' || seen.has(value)) return false
        seen.add(value)
        return Object.entries(value).some(
            ([key, entry]) => isCredentialField(key) || hasCredentialField(entry, seen),
        )
    }
    if (hasCredentialField(request.query) || hasCredentialField(request.body)) return true
    const cookies = (request.get('cookie') ?? '').split(';')
    if (
        cookies.some((cookie) => {
            const separator = cookie.indexOf('=')
            return separator > 0 && isCredentialField(cookie.slice(0, separator).trim())
        })
    ) {
        return true
    }
    return Object.entries(request.headers).some(
        ([name, value]) =>
            name !== 'authorization' && (isCredentialField(name) || /mqic_/i.test(String(value))),
    )
}
