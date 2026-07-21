import { PrismaService } from '../../shared/database/prisma.service'
import { AuditService } from '../../shared/audit/audit.service'
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../../shared/audit/audit.types'
import { BudgetsRepository } from './budgets.repository'

describe('BudgetsRepository', () => {
    let repository: BudgetsRepository
    let auditService: {
        record: jest.Mock
    }
    let prisma: {
        budget: {
            create: jest.Mock
        }
    }

    beforeEach(() => {
        prisma = {
            budget: {
                create: jest.fn(),
            },
        }
        auditService = {
            record: jest.fn().mockResolvedValue(undefined),
        }

        repository = new BudgetsRepository(
            prisma as never as PrismaService,
            auditService as never as AuditService,
        )
    })

    it('records created budget audits through the shared audit service', async () => {
        const createdBudget = {
            id: 'budget-1',
            workspaceId: 'workspace-1',
            categoryId: 'category-1',
            amount: 80000,
            currency: 'USD',
            year: 2026,
            month: 3,
            createdAt: new Date('2026-03-24T12:00:00.000Z'),
            updatedAt: new Date('2026-03-24T12:00:00.000Z'),
        }
        prisma.budget.create.mockResolvedValue(createdBudget)

        await expect(
            repository.createBudget({
                workspaceId: 'workspace-1',
                userId: 'user-1',
                categoryId: 'category-1',
                amount: 80000,
                currency: 'USD',
                year: 2026,
                month: 3,
            }),
        ).resolves.toEqual(createdBudget)

        expect(auditService.record).toHaveBeenCalledWith(
            {
                action: AUDIT_ACTIONS.BUDGET_CREATED,
                workspaceId: 'workspace-1',
                userId: 'user-1',
                entityType: AUDIT_ENTITY_TYPES.BUDGET,
                entityId: 'budget-1',
                metadata: {
                    id: 'budget-1',
                    workspace_id: 'workspace-1',
                    category_id: 'category-1',
                    amount: 80000,
                    currency: 'USD',
                    year: 2026,
                    month: 3,
                    created_at: '2026-03-24T12:00:00.000Z',
                    updated_at: '2026-03-24T12:00:00.000Z',
                },
            },
            prisma,
        )
    })
})
