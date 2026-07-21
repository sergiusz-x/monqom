import { PrismaService } from '../../shared/database/prisma.service'
import { AuditService } from '../../shared/audit/audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../shared/audit/audit.types'
import { PaymentSourcesRepository } from './payment-sources.repository'

describe('PaymentSourcesRepository', () => {
    let repository: PaymentSourcesRepository
    let auditService: {
        record: jest.Mock
    }
    let prisma: {
        paymentSource: {
            create: jest.Mock
        }
    }

    beforeEach(() => {
        prisma = {
            paymentSource: {
                create: jest.fn(),
            },
        }
        auditService = {
            record: jest.fn().mockResolvedValue(undefined),
        }

        repository = new PaymentSourcesRepository(
            prisma as never as PrismaService,
            auditService as never as AuditService,
        )
    })

    it('records created payment source audits through the shared audit service', async () => {
        const paymentSource = {
            id: 'payment-source-1',
            workspaceId: 'workspace-1',
            name: 'Travel Card',
            type: 'debit_card',
            createdAt: new Date('2026-03-24T12:00:00.000Z'),
            updatedAt: new Date('2026-03-24T12:00:00.000Z'),
            deletedAt: null,
        }
        prisma.paymentSource.create.mockResolvedValue(paymentSource)

        await expect(
            repository.createPaymentSource({
                workspaceId: 'workspace-1',
                userId: 'user-1',
                name: 'Travel Card',
                type: 'debit_card',
            }),
        ).resolves.toEqual(paymentSource)

        expect(auditService.record).toHaveBeenCalledWith(
            {
                action: AUDIT_ACTIONS.PAYMENT_SOURCE_CREATED,
                workspaceId: 'workspace-1',
                userId: 'user-1',
                entityType: AUDIT_ENTITY_TYPES.PAYMENT_SOURCE,
                entityId: 'payment-source-1',
                metadata: {
                    id: 'payment-source-1',
                    workspace_id: 'workspace-1',
                    name: 'Travel Card',
                    type: 'debit_card',
                    created_at: '2026-03-24T12:00:00.000Z',
                    updated_at: '2026-03-24T12:00:00.000Z',
                    archived_at: null,
                },
            },
            prisma,
        )
    })
})
