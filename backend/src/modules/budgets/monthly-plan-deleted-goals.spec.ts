import { BadRequestException } from '@nestjs/common'
import { MonthlyPlanService } from './monthly-plan.service'

describe('removing deleted goal allocations', () => {
    function setup(removedCount: number) {
        const tx = {
            monthlyPlan: {
                findUnique: jest
                    .fn()
                    .mockResolvedValue({ id: 'plan', revision: 1, currency: 'PLN' }),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            goal: { findMany: jest.fn().mockResolvedValue([]) },
            monthlyGoalAllocation: {
                deleteMany: jest
                    .fn()
                    .mockResolvedValueOnce({ count: removedCount })
                    .mockResolvedValue({ count: 0 }),
            },
        }
        const prisma = { $transaction: jest.fn((fn) => fn(tx)) }
        const audit = { record: jest.fn() }
        const service = new MonthlyPlanService(
            prisma as never,
            {} as never,
            {} as never,
            audit as never,
        )
        jest.spyOn(service, 'get').mockResolvedValue(null)
        return { service, tx, audit }
    }

    it('removes only the selected deleted allocations in the requested plan', async () => {
        const { service, tx } = setup(1)
        await service.saveGoals('ws', 'user', '2026-11', {
            expected_revision: 1,
            allocations: [],
            removed_allocation_ids: ['deleted'],
        })
        expect(tx.monthlyGoalAllocation.deleteMany).toHaveBeenNthCalledWith(1, {
            where: { workspaceId: 'ws', planId: 'plan', goalId: null, id: { in: ['deleted'] } },
        })
        expect(tx.monthlyGoalAllocation.deleteMany).toHaveBeenNthCalledWith(2, {
            where: { workspaceId: 'ws', planId: 'plan', goalId: { not: null } },
        })
    })

    it('rejects allocation IDs that do not belong to this plan or are still linked to a goal', async () => {
        const { service, tx, audit } = setup(0)
        await expect(
            service.saveGoals('ws', 'user', '2026-11', {
                expected_revision: 1,
                allocations: [],
                removed_allocation_ids: ['other'],
            }),
        ).rejects.toBeInstanceOf(BadRequestException)
        expect(tx.monthlyGoalAllocation.deleteMany).toHaveBeenCalledTimes(1)
        expect(audit.record).not.toHaveBeenCalled()
    })
})
