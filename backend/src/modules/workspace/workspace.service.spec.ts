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
            | 'checkMembership'
            | 'createWorkspace'
            | 'createWorkspaceMembership'
            | 'findWorkspaceById'
            | 'findWorkspacesByUserId'
            | 'seedDefaultCategories'
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
            checkMembership: jest.fn(),
            createWorkspace: jest.fn(),
            createWorkspaceMembership: jest.fn(),
            findWorkspaceById: jest.fn(),
            findWorkspacesByUserId: jest.fn(),
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

    it('lists workspaces for a user', async () => {
        const workspaces = [
            {
                id: 'workspace-1',
                name: "Ada Lovelace's Finances",
                type: 'personal',
                timezone: 'UTC',
                createdAt: new Date('2026-03-23T10:00:00.000Z'),
                updatedAt: new Date('2026-03-23T10:00:00.000Z'),
            },
        ]

        workspaceRepository.findWorkspacesByUserId.mockResolvedValue(workspaces as never)

        await expect(service.listUserWorkspaces(' user-1 ')).resolves.toEqual(workspaces)
        expect(workspaceRepository.findWorkspacesByUserId).toHaveBeenCalledWith('user-1')
    })

    it('returns workspace details when the user is a member', async () => {
        const workspace = {
            id: 'workspace-1',
            name: "Ada Lovelace's Finances",
            type: 'personal',
            timezone: 'UTC',
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            updatedAt: new Date('2026-03-23T10:00:00.000Z'),
        }

        workspaceRepository.checkMembership.mockResolvedValue(true)
        workspaceRepository.findWorkspaceById.mockResolvedValue(workspace as never)

        await expect(service.getWorkspaceForUser(' user-1 ', ' workspace-1 ')).resolves.toEqual(
            workspace,
        )
        expect(workspaceRepository.checkMembership).toHaveBeenCalledWith('user-1', 'workspace-1')
        expect(workspaceRepository.findWorkspaceById).toHaveBeenCalledWith('workspace-1')
    })

    it('rejects workspace details when the user is not a member', async () => {
        workspaceRepository.checkMembership.mockResolvedValue(false)

        await expect(service.getWorkspaceForUser('user-1', 'workspace-2')).rejects.toThrow(
            'Forbidden',
        )

        expect(workspaceRepository.checkMembership).toHaveBeenCalledWith('user-1', 'workspace-2')
        expect(workspaceRepository.findWorkspaceById).not.toHaveBeenCalled()
    })

    it('exports membership checks for other modules', async () => {
        workspaceRepository.checkMembership.mockResolvedValue(true)

        await expect(service.checkMembership(' user-1 ', ' workspace-1 ')).resolves.toBe(true)
        expect(workspaceRepository.checkMembership).toHaveBeenCalledWith('user-1', 'workspace-1')
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
        [
            'blank user id for workspace creation',
            () => service.createPersonalWorkspace('   ', 'Ada Lovelace'),
            'User id is required',
        ],
        [
            'blank user name for workspace creation',
            () => service.createPersonalWorkspace('user-1', '   '),
            'User name is required',
        ],
        [
            'blank user id for workspace listing',
            () => service.listUserWorkspaces('   '),
            'User id is required',
        ],
        [
            'blank workspace id for membership checks',
            () => service.checkMembership('user-1', '   '),
            'Workspace id is required',
        ],
    ])('rejects %s', async (_, runAssertion, errorMessage) => {
        await expect(runAssertion()).rejects.toThrow(errorMessage)

        expect(prisma.$transaction).not.toHaveBeenCalled()
    })
})
