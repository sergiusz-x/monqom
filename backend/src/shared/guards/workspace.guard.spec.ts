import {
    BadRequestException,
    ExecutionContext,
    ForbiddenException,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'
import type { SessionData } from 'express-session'
import { WorkspaceRepository } from '../../modules/workspace/workspace.repository'
import { WorkspaceGuard } from './workspace.guard'

type SessionRequest = Omit<Partial<Request>, 'headers' | 'params' | 'session'> & {
    headers?: Request['headers']
    params?: Record<string, string | undefined>
    session?: Partial<SessionData>
}

describe('WorkspaceGuard', () => {
    let guard: WorkspaceGuard
    let workspaceRepository: jest.Mocked<
        Pick<WorkspaceRepository, 'findWorkspaceById' | 'findWorkspaceAccess'>
    >

    beforeEach(() => {
        workspaceRepository = {
            findWorkspaceById: jest.fn(),
            findWorkspaceAccess: jest.fn(),
        }

        guard = new WorkspaceGuard(workspaceRepository as unknown as WorkspaceRepository)
    })

    it('attaches workspace context from route params for members', async () => {
        const request: SessionRequest = {
            headers: {},
            params: {
                workspaceId: ' workspace-1 ',
            },
            session: {
                auth: {
                    userId: 'user-1',
                    sessionVersion: 1,
                },
            },
        }

        workspaceRepository.findWorkspaceAccess.mockResolvedValue({
            workspaceId: 'workspace-1',
            role: 'owner',
        } as never)

        await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true)

        expect(workspaceRepository.findWorkspaceAccess).toHaveBeenCalledWith(
            'user-1',
            'workspace-1',
        )
        expect(request.workspace).toEqual({
            workspaceId: 'workspace-1',
            role: 'owner',
        })
        expect(workspaceRepository.findWorkspaceById).not.toHaveBeenCalled()
    })

    it('falls back to the workspace header when route params are missing', async () => {
        const request: SessionRequest = {
            headers: {
                'x-workspace-id': ' workspace-2 ',
            },
            params: {},
            session: {
                auth: {
                    userId: 'user-1',
                    sessionVersion: 1,
                },
            },
        }

        workspaceRepository.findWorkspaceAccess.mockResolvedValue({
            workspaceId: 'workspace-2',
            role: 'member',
        } as never)

        await expect(guard.canActivate(createExecutionContext(request))).resolves.toBe(true)

        expect(workspaceRepository.findWorkspaceAccess).toHaveBeenCalledWith(
            'user-1',
            'workspace-2',
        )
        expect(request.workspace).toEqual({
            workspaceId: 'workspace-2',
            role: 'member',
        })
        expect(workspaceRepository.findWorkspaceById).not.toHaveBeenCalled()
    })

    it('rejects requests without an authenticated session', async () => {
        const request: SessionRequest = {
            headers: {},
            params: {
                workspaceId: 'workspace-1',
            },
            session: {},
        }

        await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
            UnauthorizedException,
        )
        expect(workspaceRepository.findWorkspaceAccess).not.toHaveBeenCalled()
    })

    it('returns 404 when the workspace does not exist', async () => {
        const request: SessionRequest = {
            headers: {},
            params: {
                workspaceId: 'workspace-9',
            },
            session: {
                auth: {
                    userId: 'user-1',
                    sessionVersion: 1,
                },
            },
        }

        workspaceRepository.findWorkspaceAccess.mockResolvedValue(null)
        workspaceRepository.findWorkspaceById.mockResolvedValue(null)

        await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
            NotFoundException,
        )
    })

    it('returns 403 when the workspace exists but the user is not a member', async () => {
        const request: SessionRequest = {
            headers: {},
            params: {
                workspaceId: 'workspace-2',
            },
            session: {
                auth: {
                    userId: 'user-1',
                    sessionVersion: 1,
                },
            },
        }

        workspaceRepository.findWorkspaceAccess.mockResolvedValue(null)
        workspaceRepository.findWorkspaceById.mockResolvedValue({
            id: 'workspace-2',
        } as never)

        await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
            ForbiddenException,
        )
    })

    it('rejects requests without a workspace id', async () => {
        const request: SessionRequest = {
            headers: {},
            params: {},
            session: {
                auth: {
                    userId: 'user-1',
                    sessionVersion: 1,
                },
            },
        }

        await expect(guard.canActivate(createExecutionContext(request))).rejects.toBeInstanceOf(
            BadRequestException,
        )
        expect(workspaceRepository.findWorkspaceAccess).not.toHaveBeenCalled()
    })
})

function createExecutionContext(request: SessionRequest): ExecutionContext {
    return {
        switchToHttp: () => ({
            getRequest: () => request as Request,
        }),
    } as ExecutionContext
}
