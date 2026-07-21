import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import type { SessionData } from 'express-session'
import { AuthRepository } from '../../modules/auth/auth.repository'
import { SessionGuard } from './session.guard'
import { createUserFixture } from '../../test-utils/prisma-fixtures'

type SessionRequest = Omit<Partial<Request>, 'session'> & {
    session?: Partial<SessionData>
}

describe('SessionGuard', () => {
    let guard: SessionGuard
    let authRepository: jest.Mocked<Pick<AuthRepository, 'findUserById'>>

    beforeEach(() => {
        authRepository = {
            findUserById: jest.fn(),
        }

        guard = new SessionGuard(authRepository as unknown as AuthRepository)
    })

    it('allows requests with a valid session user id and session version', async () => {
        authRepository.findUserById.mockResolvedValue(
            createUserFixture({ emailVerified: true, sessionVersion: 2 }),
        )

        const context = createExecutionContext({
            session: {
                auth: {
                    userId: 'user-1',
                    sessionVersion: 2,
                },
            },
        })

        await expect(guard.canActivate(context)).resolves.toBe(true)
    })

    it('rejects requests without an authenticated session', async () => {
        const context = createExecutionContext({
            session: {},
        })

        await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException)
        await expect(guard.canActivate(context)).rejects.toThrow('Authentication required')
        expect(authRepository.findUserById).not.toHaveBeenCalled()
    })

    it('rejects requests when the session version is stale', async () => {
        authRepository.findUserById.mockResolvedValue(
            createUserFixture({ emailVerified: true, sessionVersion: 3 }),
        )

        const context = createExecutionContext({
            session: {
                auth: {
                    userId: 'user-1',
                    sessionVersion: 2,
                },
            },
        })

        await expect(guard.canActivate(context)).rejects.toThrow('Authentication required')
    })
})

function createExecutionContext(request: SessionRequest): ExecutionContext {
    return {
        switchToHttp: () => ({
            getRequest: () => request as Request,
        }),
    } as ExecutionContext
}
