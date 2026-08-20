import { ExecutionContext, ForbiddenException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { WorkspaceRoleGuard } from './workspace-role.guard'

describe('WorkspaceRoleGuard', () => {
    it.each([
        ['member', 'member', true],
        ['admin', 'member', true],
        ['owner', 'admin', true],
        ['member', 'admin', false],
        ['admin', 'owner', false],
    ] as const)('%s requesting %s permission => %s', (current, required, allowed) => {
        const reflector = {
            getAllAndOverride: jest.fn().mockReturnValue(required),
        } as unknown as Reflector
        const guard = new WorkspaceRoleGuard(reflector)
        const context = {
            getHandler: jest.fn(),
            getClass: jest.fn(),
            switchToHttp: () => ({ getRequest: () => ({ workspace: { role: current } }) }),
        } as unknown as ExecutionContext

        if (allowed) expect(guard.canActivate(context)).toBe(true)
        else expect(() => guard.canActivate(context)).toThrow(ForbiddenException)
    })
})
