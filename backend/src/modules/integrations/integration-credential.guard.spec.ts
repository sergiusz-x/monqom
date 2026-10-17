/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    ForbiddenException,
    HttpException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { IntegrationCredentialGuard } from './integration-credential.guard'
import { IntegrationCredentialService, MachinePrincipal } from './integration-credential.service'
import {
    IntegrationRateLimitExceededError,
    IntegrationRateLimitService,
} from './integration-rate-limit.service'

const principal: MachinePrincipal = {
    integrationId: 'integration-1',
    credentialId: 'credential-1',
    workspaceId: 'workspace-1',
    scopes: ['transactions:create'],
    categoryAllowlistEnabled: false,
    allowedCategoryIds: [],
    paymentSourceAllowlistEnabled: false,
    allowedPaymentSourceIds: [],
    allowedCidrs: [],
}

describe('IntegrationCredentialGuard', () => {
    function fixture(workspaceId = 'workspace-1', overrides: Record<string, unknown> = {}) {
        const response = { setHeader: jest.fn() }
        const request: any = {
            params: { workspaceId },
            get: jest.fn((name: string) => (name === 'authorization' ? 'Bearer token' : undefined)),
            ip: '127.0.0.1',
            protocol: 'https',
            socket: { remoteAddress: '127.0.0.1' },
            rawHeaders: ['authorization', 'Bearer token'],
            headers: { authorization: 'Bearer token' },
            body: {},
            query: {},
            method: 'POST',
            ...overrides,
        }
        const execution: any = {
            switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
            getHandler: jest.fn(),
            getClass: jest.fn(),
        }
        const auth = {
            authenticateAuthorizationHeader: jest.fn().mockResolvedValue(principal),
            recordDeniedAccess: jest.fn().mockResolvedValue(undefined),
        }
        const limits = {
            assertSourceAllowed: jest.fn().mockResolvedValue(undefined),
            consumeCredential: jest.fn().mockResolvedValue(undefined),
            consumeFailedAuthentication: jest.fn().mockResolvedValue(undefined),
        }
        const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['transactions:create']) }
        const guard = new IntegrationCredentialGuard(
            auth as unknown as IntegrationCredentialService,
            limits as unknown as IntegrationRateLimitService,
            reflector as unknown as Reflector,
        )
        return { guard, execution, request, response, auth, limits, reflector }
    }

    it('binds a machine principal to one workspace and charges the shared method-aware limit', async () => {
        const f = fixture()
        await expect(f.guard.canActivate(f.execution)).resolves.toBe(true)
        expect(f.request.machine).toEqual(principal)
        expect(f.limits.consumeCredential).toHaveBeenCalledWith(
            'credential-1',
            undefined,
            true,
            'workspace-1',
        )
    })

    it('does not disclose another workspace and records the denial', async () => {
        const f = fixture('workspace-2')
        await expect(f.guard.canActivate(f.execution)).rejects.toBeInstanceOf(NotFoundException)
        expect(f.auth.recordDeniedAccess).toHaveBeenCalledWith(principal, 'WORKSPACE_DENIED')
        expect(f.limits.consumeCredential).toHaveBeenCalled()
    })

    it.each([undefined, [], ['unknown:scope'], ['transactions:update-own']])(
        'denies absent, empty, unknown, or ungranted scope metadata: %p',
        async (scopes) => {
            const f = fixture()
            f.reflector.getAllAndOverride.mockReturnValue(scopes)
            await expect(f.guard.canActivate(f.execution)).rejects.toBeInstanceOf(
                ForbiddenException,
            )
            expect(f.auth.recordDeniedAccess).toHaveBeenCalledWith(principal, 'SCOPE_DENIED')
        },
    )

    it('authorizes only the exact declared scope', async () => {
        const f = fixture()
        f.auth.authenticateAuthorizationHeader.mockResolvedValue({
            ...principal,
            scopes: ['transactions:update-own'],
        })
        f.reflector.getAllAndOverride.mockReturnValue(['transactions:update-own'])
        await expect(f.guard.canActivate(f.execution)).resolves.toBe(true)
    })

    it('rejects plaintext HTTP outside local development and never parses the credential', async () => {
        const f = fixture('workspace-1', {
            protocol: 'http',
            ip: '203.0.113.1',
            socket: { remoteAddress: '203.0.113.1' },
        })
        await expect(f.guard.canActivate(f.execution)).rejects.toBeInstanceOf(UnauthorizedException)
        expect(f.auth.authenticateAuthorizationHeader).not.toHaveBeenCalled()
        expect(f.response.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Bearer')
        expect(f.limits.consumeFailedAuthentication).toHaveBeenCalled()
    })

    it('rejects duplicate Authorization headers and a spoofed forwarded scheme', async () => {
        const duplicate = fixture('workspace-1', {
            rawHeaders: ['authorization', 'Bearer token', 'authorization', 'Bearer other-token'],
        })
        await expect(duplicate.guard.canActivate(duplicate.execution)).rejects.toBeInstanceOf(
            UnauthorizedException,
        )
        expect(duplicate.auth.authenticateAuthorizationHeader).not.toHaveBeenCalled()

        const spoofedScheme = fixture('workspace-1', {
            get: jest.fn((name: string) =>
                name === 'authorization'
                    ? 'Bearer token'
                    : name === 'x-forwarded-proto'
                      ? 'http'
                      : undefined,
            ),
        })
        await expect(
            spoofedScheme.guard.canActivate(spoofedScheme.execution),
        ).rejects.toBeInstanceOf(UnauthorizedException)
        expect(spoofedScheme.auth.authenticateAuthorizationHeader).not.toHaveBeenCalled()
    })

    it('rejects a bearer copied into an alternate header or request field', async () => {
        const header = fixture('workspace-1', {
            headers: { authorization: 'Bearer token', 'x-api-key': 'secret' },
        })
        await expect(header.guard.canActivate(header.execution)).rejects.toBeInstanceOf(
            UnauthorizedException,
        )
        expect(header.auth.authenticateAuthorizationHeader).not.toHaveBeenCalled()
        const body = fixture('workspace-1', { body: { access_token: 'secret' } })
        await expect(body.guard.canActivate(body.execution)).rejects.toBeInstanceOf(
            UnauthorizedException,
        )
        expect(body.auth.authenticateAuthorizationHeader).not.toHaveBeenCalled()
        const nestedBody = fixture('workspace-1', {
            body: { options: [{ credentials: { client_secret: 'secret' } }] },
        })
        await expect(nestedBody.guard.canActivate(nestedBody.execution)).rejects.toBeInstanceOf(
            UnauthorizedException,
        )
        expect(nestedBody.auth.authenticateAuthorizationHeader).not.toHaveBeenCalled()
        const disguisedToken = fixture('workspace-1', {
            body: {
                note: 'do-not-accept mqic_abcdefghijkl.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO12',
            },
        })
        await expect(
            disguisedToken.guard.canActivate(disguisedToken.execution),
        ).rejects.toBeInstanceOf(UnauthorizedException)
        expect(disguisedToken.auth.authenticateAuthorizationHeader).not.toHaveBeenCalled()
        const query = fixture('workspace-1', { query: { api_token: 'secret' } })
        await expect(query.guard.canActivate(query.execution)).rejects.toBeInstanceOf(
            UnauthorizedException,
        )
        expect(query.auth.authenticateAuthorizationHeader).not.toHaveBeenCalled()
        const cookie = fixture()
        cookie.request.get.mockImplementation((name: string) =>
            name === 'authorization'
                ? 'Bearer token'
                : name === 'cookie'
                  ? 'session=abc; client_secret=secret'
                  : undefined,
        )
        await expect(cookie.guard.canActivate(cookie.execution)).rejects.toBeInstanceOf(
            UnauthorizedException,
        )
        expect(cookie.auth.authenticateAuthorizationHeader).not.toHaveBeenCalled()
    })

    it('returns a retry delay for blocked sources and propagates shared storage failures', async () => {
        const limited = fixture()
        limited.limits.assertSourceAllowed.mockRejectedValue(
            new IntegrationRateLimitExceededError(30),
        )
        await expect(limited.guard.canActivate(limited.execution)).rejects.toBeInstanceOf(
            HttpException,
        )
        expect(limited.response.setHeader).toHaveBeenCalledWith('Retry-After', '30')
        const unavailable = fixture()
        unavailable.limits.assertSourceAllowed.mockRejectedValue(new Error('storage failed'))
        await expect(unavailable.guard.canActivate(unavailable.execution)).rejects.toThrow(
            'storage failed',
        )
        expect(unavailable.auth.authenticateAuthorizationHeader).not.toHaveBeenCalled()
    })
})
