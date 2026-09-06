import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import type { Request } from 'express'
import { getAuthenticatedUserId, getWorkspaceId } from './request-context.decorator'

describe('request context accessors', () => {
    it('returns identifiers attached by authentication and workspace guards', () => {
        const request = {
            session: { auth: { userId: 'user-1', sessionVersion: 1 } },
            workspace: { workspaceId: 'workspace-1', role: 'member' },
        } as Request

        expect(getAuthenticatedUserId(request)).toBe('user-1')
        expect(getWorkspaceId(request)).toBe('workspace-1')
    })

    it('rejects requests that did not pass authentication', () => {
        expect(() => getAuthenticatedUserId({ session: {} } as Request)).toThrow(
            UnauthorizedException,
        )
    })

    it('rejects requests that did not receive workspace context', () => {
        expect(() => getWorkspaceId({} as Request)).toThrow(BadRequestException)
    })
})
