import { ConflictException } from '@nestjs/common'
import { GoalsService } from './goals.service'

describe('GoalsService', () => {
    const workspaceService = {
        getWorkspaceById: jest.fn().mockResolvedValue({
            id: 'workspace-1',
            baseCurrency: 'PLN',
            timezone: 'Europe/Warsaw',
        }),
    }
    const auditService = { record: jest.fn().mockResolvedValue(undefined) }

    beforeEach(() => {
        jest.useFakeTimers().setSystemTime(new Date('2026-08-19T10:00:00.000Z'))
        jest.clearAllMocks()
    })

    afterEach(() => jest.useRealTimers())

    it('scopes list queries to the requested workspace and hides archives by default', async () => {
        const prisma = {
            goal: { findMany: jest.fn().mockResolvedValue([]) },
        }
        const service = new GoalsService(prisma as never, workspaceService as never, auditService as never)

        await service.list('workspace-1')

        expect(prisma.goal.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { workspaceId: 'workspace-1', archivedAt: null } }),
        )
    })

    it('uses workspace currency and persists next month as the default plan start', async () => {
        const tx = {
            goal: {
                create: jest.fn().mockImplementation(({ data }) =>
                    Promise.resolve({
                        id: 'goal-1',
                        ...data,
                        archivedAt: null,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                        operations: [],
                    }),
                ),
            },
        }
        const prisma = { $transaction: jest.fn((callback) => callback(tx)) }
        const service = new GoalsService(prisma as never, workspaceService as never, auditService as never)

        const result = await service.create('workspace-1', 'user-1', {
            name: ' Holiday ',
            target_amount: 1200,
            initial_amount: 200,
            target_date: '2027-08-19',
            include_current_month: false,
        })

        expect(tx.goal.create).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    workspaceId: 'workspace-1',
                    currency: 'PLN',
                    name: 'Holiday',
                    targetAmount: 120000,
                    initialAmount: 20000,
                    planStartMonth: new Date('2026-09-01T00:00:00.000Z'),
                }),
            }),
        )
        expect(result.recommended_monthly_amount).toBe(83.34)
    })

    it('rejects a withdrawal that would make the independently tracked balance negative', async () => {
        const tx = {
            goal: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'goal-1',
                    workspaceId: 'workspace-1',
                    name: 'Holiday',
                    targetAmount: 100000,
                    initialAmount: 1000,
                    currency: 'PLN',
                    targetDate: new Date('2027-08-19T00:00:00.000Z'),
                    planStartMonth: new Date('2026-09-01T00:00:00.000Z'),
                    archivedAt: null,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    operations: [],
                }),
            },
            goalOperation: { create: jest.fn() },
        }
        const prisma = { $transaction: jest.fn((callback) => callback(tx)) }
        const service = new GoalsService(prisma as never, workspaceService as never, auditService as never)

        await expect(
            service.createOperation('workspace-1', 'user-1', 'goal-1', {
                type: 'withdrawal',
                amount: 20,
                date: '2026-08-19',
            }),
        ).rejects.toBeInstanceOf(ConflictException)
        expect(tx.goalOperation.create).not.toHaveBeenCalled()
    })

    it('returns not found when a nested goal is absent from the workspace', async () => {
        const tx = { goal: { findUnique: jest.fn().mockResolvedValue(null) } }
        const prisma = { $transaction: jest.fn((callback) => callback(tx)) }
        const service = new GoalsService(prisma as never, workspaceService as never, auditService as never)

        await expect(
            service.createOperation('workspace-2', 'user-1', 'goal-1', {
                type: 'deposit',
                amount: 10,
                date: '2026-08-19',
            }),
        ).rejects.toMatchObject({ status: 404 })
        expect(tx.goal.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { workspaceId_id: { workspaceId: 'workspace-2', id: 'goal-1' } },
            }),
        )
    })
})
