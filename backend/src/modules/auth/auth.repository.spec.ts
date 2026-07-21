import { PrismaService } from '../../shared/database/prisma.service'
import { AuditService } from '../../shared/audit/audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../shared/audit/audit.types'
import { AuthRepository } from './auth.repository'

describe('AuthRepository', () => {
    let repository: AuthRepository
    let auditService: {
        record: jest.Mock
    }
    let prisma: {
        auditEvent: {
            create: jest.Mock
        }
    }

    beforeEach(() => {
        prisma = {
            auditEvent: {
                create: jest.fn(),
            },
        }
        auditService = {
            record: jest.fn().mockResolvedValue(undefined),
        }

        repository = new AuthRepository(
            prisma as never as PrismaService,
            auditService as never as AuditService,
        )
    })

    it('records user audit events through the shared audit service', async () => {
        await repository.createUserAuditEvent({
            action: AUDIT_ACTIONS.USER_LOGGED_IN,
            userId: 'user-1',
            metadata: {
                auth_strategy: 'SESSION_COOKIE',
                ip_address: '127.0.0.1',
            },
        })

        expect(auditService.record).toHaveBeenCalledWith({
            action: AUDIT_ACTIONS.USER_LOGGED_IN,
            userId: 'user-1',
            entityType: AUDIT_ENTITY_TYPES.USER,
            entityId: 'user-1',
            metadata: {
                auth_strategy: 'SESSION_COOKIE',
                ip_address: '127.0.0.1',
            },
        })
        expect(prisma.auditEvent.create).not.toHaveBeenCalled()
    })
    it('preserves shared workspaces, transfers sole ownership and deletes only orphaned workspaces', async () => {
        const tx = {
            workspaceMembership: {
                findMany: jest
                    .fn()
                    .mockResolvedValueOnce([
                        { workspaceId: 'shared-member', role: 'member' },
                        { workspaceId: 'shared-owned', role: 'owner' },
                        { workspaceId: 'orphaned', role: 'owner' },
                        { workspaceId: 'co-owned', role: 'owner' },
                    ])
                    .mockResolvedValueOnce([{ id: 'owner-2', role: 'owner' }])
                    .mockResolvedValueOnce([
                        { id: 'member-2', role: 'member' },
                        { id: 'admin-2', role: 'admin' },
                    ])
                    .mockResolvedValueOnce([])
                    .mockResolvedValueOnce([{ id: 'owner-3', role: 'owner' }]),
                update: jest.fn().mockResolvedValue(undefined),
            },
            workspace: {
                delete: jest.fn().mockResolvedValue(undefined),
            },
            user: {
                delete: jest.fn().mockResolvedValue(undefined),
            },
            $executeRaw: jest.fn().mockResolvedValue(1),
        }
        const transactionalPrisma = {
            $transaction: jest.fn(async (operation: (client: typeof tx) => Promise<void>) =>
                operation(tx),
            ),
        }
        const transactionalRepository = new AuthRepository(
            transactionalPrisma as never as PrismaService,
            auditService as never as AuditService,
        )

        await transactionalRepository.deleteUserAccount('user-1')

        expect(tx.workspace.delete).toHaveBeenCalledTimes(1)
        expect(tx.workspace.delete).toHaveBeenCalledWith({
            where: { id: 'orphaned' },
        })
        expect(tx.workspaceMembership.update).toHaveBeenCalledTimes(1)
        expect(tx.workspaceMembership.update).toHaveBeenCalledWith({
            where: { id: 'admin-2' },
            data: { role: 'owner' },
        })
        expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'user-1' } })
        expect(transactionalPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
            isolationLevel: 'Serializable',
        })
    })
})
