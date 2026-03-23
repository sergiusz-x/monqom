import { WorkspaceRepository } from './workspace.repository'
import { WorkspaceService } from './workspace.service'

describe('WorkspaceService', () => {
    let service: WorkspaceService
    let transactionClient: object
    let prisma: {
        $transaction: jest.Mock
    }
    let workspaceRepository: jest.Mocked<
        Pick<
            WorkspaceRepository,
            'createWorkspace' | 'createWorkspaceMembership' | 'seedDefaultCategories'
        >
    >

    beforeEach(() => {
        transactionClient = {}
        prisma = {
            $transaction: jest.fn(async (callback: (tx: object) => Promise<unknown>) =>
                callback(transactionClient),
            ),
        }
        workspaceRepository = {
            createWorkspace: jest.fn(),
            createWorkspaceMembership: jest.fn(),
            seedDefaultCategories: jest.fn(),
        }

        service = new WorkspaceService(
            prisma as never,
            workspaceRepository as unknown as WorkspaceRepository,
        )
    })

    it('creates a personal workspace, owner membership, and default categories in one transaction', async () => {
        const workspace = {
            id: 'workspace-1',
            name: "Ada Lovelace's Finances",
            type: 'personal',
            timezone: 'UTC',
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        }

        workspaceRepository.createWorkspace.mockResolvedValue(workspace as never)
        workspaceRepository.createWorkspaceMembership.mockResolvedValue({
            id: 'membership-1',
            userId: 'user-1',
            workspaceId: 'workspace-1',
            role: 'owner',
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        } as never)
        workspaceRepository.seedDefaultCategories.mockResolvedValue(undefined)

        await expect(
            service.createPersonalWorkspace(' user-1 ', ' Ada Lovelace '),
        ).resolves.toEqual(workspace)

        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
        expect(workspaceRepository.createWorkspace).toHaveBeenCalledWith(
            {
                name: "Ada Lovelace's Finances",
                type: 'personal',
                timezone: 'UTC',
            },
            transactionClient,
        )
        expect(workspaceRepository.createWorkspaceMembership).toHaveBeenCalledWith(
            {
                userId: 'user-1',
                workspaceId: 'workspace-1',
                role: 'owner',
            },
            transactionClient,
        )
        expect(workspaceRepository.seedDefaultCategories).toHaveBeenCalledWith(
            'workspace-1',
            transactionClient,
        )
    })

    it('reuses an existing transaction client when provided', async () => {
        const providedTransactionClient = {}
        const workspace = {
            id: 'workspace-1',
            name: "Ada Lovelace's Finances",
            type: 'personal',
            timezone: 'UTC',
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        }

        workspaceRepository.createWorkspace.mockResolvedValue(workspace as never)
        workspaceRepository.createWorkspaceMembership.mockResolvedValue({
            id: 'membership-1',
            userId: 'user-1',
            workspaceId: 'workspace-1',
            role: 'owner',
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        } as never)
        workspaceRepository.seedDefaultCategories.mockResolvedValue(undefined)

        await expect(
            service.createPersonalWorkspace(
                'user-1',
                'Ada Lovelace',
                providedTransactionClient as never,
            ),
        ).resolves.toEqual(workspace)

        expect(prisma.$transaction).not.toHaveBeenCalled()
        expect(workspaceRepository.createWorkspace).toHaveBeenCalledWith(
            {
                name: "Ada Lovelace's Finances",
                type: 'personal',
                timezone: 'UTC',
            },
            providedTransactionClient,
        )
    })

    it('propagates workspace repository errors and skips later onboarding steps', async () => {
        workspaceRepository.createWorkspace.mockRejectedValue(new Error('Workspace insert failed'))

        await expect(service.createPersonalWorkspace('user-1', 'Ada Lovelace')).rejects.toThrow(
            'Workspace insert failed',
        )

        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
        expect(workspaceRepository.createWorkspaceMembership).not.toHaveBeenCalled()
        expect(workspaceRepository.seedDefaultCategories).not.toHaveBeenCalled()
    })

    it.each([
        ['blank user id', '   ', 'Ada Lovelace', 'User id is required'],
        ['blank user name', 'user-1', '   ', 'User name is required'],
    ])('rejects %s', async (_, userId, userName, errorMessage) => {
        await expect(service.createPersonalWorkspace(userId, userName)).rejects.toThrow(
            errorMessage,
        )

        expect(prisma.$transaction).not.toHaveBeenCalled()
        expect(workspaceRepository.createWorkspace).not.toHaveBeenCalled()
    })
})
