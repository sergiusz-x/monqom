import { PrismaService } from '../database/prisma.service'
import { AuditService } from './audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from './audit.types'

describe('AuditService', () => {
    let service: AuditService
    let prisma: {
        auditEvent: {
            create: jest.Mock
        }
    }

    beforeEach(() => {
        prisma = {
            auditEvent: {
                create: jest.fn().mockResolvedValue({ id: 'audit-event-1' }),
            },
        }

        service = new AuditService(prisma as never as PrismaService)
    })

    it('records audit events through the default prisma client', async () => {
        await service.record({
            action: AUDIT_ACTIONS.TRANSACTION_DELETED,
            workspaceId: 'workspace-1',
            userId: 'user-1',
            entityType: AUDIT_ENTITY_TYPES.TRANSACTION,
            entityId: 'transaction-1',
            metadata: {
                amount: 1500,
                currency: 'USD',
            },
        })

        expect(prisma.auditEvent.create).toHaveBeenCalledWith({
            data: {
                action: AUDIT_ACTIONS.TRANSACTION_DELETED,
                workspaceId: 'workspace-1',
                userId: 'user-1',
                entityType: AUDIT_ENTITY_TYPES.TRANSACTION,
                entityId: 'transaction-1',
                metadata: {
                    amount: 1500,
                    currency: 'USD',
                },
            },
        })
    })

    it('records audit events through an explicit transaction client', async () => {
        const tx = {
            auditEvent: {
                create: jest.fn().mockResolvedValue({ id: 'audit-event-2' }),
            },
        }

        await service.record(
            {
                action: AUDIT_ACTIONS.USER_LOGGED_IN,
                userId: 'user-1',
                entityType: AUDIT_ENTITY_TYPES.USER,
                entityId: 'user-1',
                metadata: {
                    auth_strategy: 'SESSION_COOKIE',
                },
            },
            tx as never,
        )

        expect(tx.auditEvent.create).toHaveBeenCalledWith({
            data: {
                action: AUDIT_ACTIONS.USER_LOGGED_IN,
                userId: 'user-1',
                entityType: AUDIT_ENTITY_TYPES.USER,
                entityId: 'user-1',
                metadata: {
                    auth_strategy: 'SESSION_COOKIE',
                },
            },
        })
        expect(prisma.auditEvent.create).not.toHaveBeenCalled()
    })

    it('preserves explicit null fields and omits metadata when it is not provided', async () => {
        await service.record({
            action: AUDIT_ACTIONS.USER_LOGGED_OUT,
            workspaceId: null,
            userId: null,
            entityType: null,
            entityId: null,
        })

        expect(prisma.auditEvent.create).toHaveBeenCalledWith({
            data: {
                action: AUDIT_ACTIONS.USER_LOGGED_OUT,
                workspaceId: null,
                userId: null,
                entityType: null,
                entityId: null,
            },
        })
    })
})
