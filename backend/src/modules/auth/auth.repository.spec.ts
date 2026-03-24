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
})
