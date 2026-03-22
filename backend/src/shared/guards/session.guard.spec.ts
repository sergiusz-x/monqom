import { ExecutionContext, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import type { SessionData } from 'express-session'
import { SessionGuard } from './session.guard'

type SessionRequest = Omit<Partial<Request>, 'session'> & {
    session?: Partial<SessionData>
}

describe('SessionGuard', () => {
    const guard = new SessionGuard()

    it('allows requests with a session user id', () => {
        const context = createExecutionContext({
            session: {
                auth: {
                    userId: 'user-1',
                },
            },
        })

        expect(guard.canActivate(context)).toBe(true)
    })

    it('rejects requests without an authenticated session', () => {
        const context = createExecutionContext({
            session: {},
        })

        expect(() => guard.canActivate(context)).toThrow(UnauthorizedException)
        expect(() => guard.canActivate(context)).toThrow('Authentication required')
    })
})

function createExecutionContext(request: SessionRequest): ExecutionContext {
    return {
        switchToHttp: () => ({
            getRequest: () => request as Request,
        }),
    } as ExecutionContext
}
