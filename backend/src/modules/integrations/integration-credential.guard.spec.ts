import { ForbiddenException, NotFoundException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { IntegrationCredentialGuard } from './integration-credential.guard'
import { IntegrationCredentialService, MachinePrincipal } from './integration-credential.service'

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
    function context(workspaceId = 'workspace-1') {
        const request: {
            params: { workspaceId: string }
            get: jest.Mock
            ip: string
            machine?: MachinePrincipal
        } = {
            params: { workspaceId },
            get: jest.fn().mockReturnValue('Bearer token'),
            ip: '127.0.0.1',
        }
        return {
            request,
            context: {
                switchToHttp: () => ({ getRequest: () => request }),
                getHandler: jest.fn(),
                getClass: jest.fn(),
            },
        }
    }

    it('binds a machine principal to its one workspace', async () => {
        const auth = { authenticateAuthorizationHeader: jest.fn().mockResolvedValue(principal) }
        const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['transactions:create']) }
        const guard = new IntegrationCredentialGuard(
            auth as never as IntegrationCredentialService,
            { consumeCredential: jest.fn(), consumeFailedAuthentication: jest.fn() } as never,
            reflector as never as Reflector,
        )
        const execution = context()

        await expect(guard.canActivate(execution.context as never)).resolves.toBe(true)
        expect(execution.request.machine).toEqual(principal)
    })

    it('does not disclose another workspace or grant an omitted scope', async () => {
        const auth = { authenticateAuthorizationHeader: jest.fn().mockResolvedValue(principal) }
        const reflector = {
            getAllAndOverride: jest.fn().mockReturnValue(['transactions:update-own']),
        }
        const guard = new IntegrationCredentialGuard(
            auth as never as IntegrationCredentialService,
            { consumeCredential: jest.fn(), consumeFailedAuthentication: jest.fn() } as never,
            reflector as never as Reflector,
        )

        await expect(
            guard.canActivate(context('workspace-2').context as never),
        ).rejects.toBeInstanceOf(NotFoundException)
        await expect(guard.canActivate(context().context as never)).rejects.toBeInstanceOf(
            ForbiddenException,
        )
    })
})
