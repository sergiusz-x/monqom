import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { MonthlyPlanService } from '../src/modules/budgets/monthly-plan.service'
import { BudgetsRepository } from '../src/modules/budgets/budgets.repository'
import { WorkspaceService } from '../src/modules/workspace/workspace.service'
import { WorkspaceRepository } from '../src/modules/workspace/workspace.repository'
import { BadRequestException } from '@nestjs/common'

const databaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL
if (!databaseUrl || !/(^|[_-])test([_-]|$)/i.test(new URL(databaseUrl).pathname.slice(1)))
    throw new Error('INTEGRATION_TEST_DATABASE_URL must point to a disposable test database')
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
const service = new MonthlyPlanService(
    prisma as never,
    new WorkspaceService(
        prisma as never,
        new WorkspaceRepository(prisma as never),
        {} as never,
    ) as never,
    new BudgetsRepository(prisma as never, {} as never),
    { record: jest.fn() } as never,
)
afterAll(async () => prisma.$disconnect())
test('deletion changes only the selected plan and rejects another workspace allocation atomically', async () => {
    const ws = await prisma.workspace.create({ data: { name: 'Review', baseCurrency: 'PLN' } })
    const other = await prisma.workspace.create({ data: { name: 'Other', baseCurrency: 'PLN' } })
    try {
        const createPlan = (workspaceId: string, month: string) =>
            prisma.monthlyPlan.create({
                data: {
                    workspaceId,
                    month,
                    currency: 'PLN',
                    funds: 10000,
                    incomeMode: 'manual',
                    incomePlanned: true,
                    confirmedAt: new Date(),
                },
            })
        const plan = await createPlan(ws.id, '2026-11')
        const history = await createPlan(ws.id, '2026-10')
        const foreignPlan = await createPlan(other.id, '2026-11')
        const goal = await prisma.goal.create({
            data: {
                workspaceId: ws.id,
                name: 'Deleted',
                targetAmount: 10000,
                currency: 'PLN',
                targetDate: new Date('2027-01-01'),
                planStartMonth: new Date('2026-01-01'),
            },
        })
        const add = (workspaceId: string, planId: string, goalId?: string) =>
            prisma.monthlyGoalAllocation.create({
                data: { workspaceId, planId, goalId, goalName: 'Deleted', amount: 3000 },
            })
        const selected = await add(ws.id, plan.id, goal.id)
        const historical = await add(ws.id, history.id, goal.id)
        const foreign = await add(other.id, foreignPlan.id)
        await prisma.goal.delete({ where: { id: goal.id } })
        expect((await service.get(ws.id, '2026-11'))?.unallocated_cents).toBe(7000)
        await expect(
            service.saveGoals(ws.id, 'user', '2026-11', {
                expected_revision: 1,
                allocations: [],
                removed_allocation_ids: [foreign.id],
            }),
        ).rejects.toBeInstanceOf(BadRequestException)
        expect(
            (await prisma.monthlyPlan.findUniqueOrThrow({ where: { id: plan.id } })).revision,
        ).toBe(1)
        const result = await service.saveGoals(ws.id, 'user', '2026-11', {
            expected_revision: 1,
            allocations: [],
            removed_allocation_ids: [selected.id],
        })
        expect(result?.unallocated_cents).toBe(10000)
        expect((await service.get(ws.id, '2026-10'))?.unallocated_cents).toBe(7000)
        expect(
            await prisma.monthlyGoalAllocation.findMany({
                where: { id: { in: [historical.id, foreign.id] } },
            }),
        ).toHaveLength(2)
    } finally {
        await prisma.workspace.deleteMany({ where: { id: { in: [ws.id, other.id] } } })
    }
})

test('confirmed income categories remain stable while unplanned months inherit newer rules', async () => {
    const workspace = await prisma.workspace.create({
        data: { name: 'Income rule test', baseCurrency: 'PLN' },
    })
    try {
        const source = await prisma.paymentSource.create({
            data: { workspaceId: workspace.id, name: 'Bank', type: 'bank' },
        })
        const oldCategory = await prisma.category.create({
            data: { workspaceId: workspace.id, name: 'Original income', type: 'income' },
        })
        const newCategory = await prisma.category.create({
            data: { workspaceId: workspace.id, name: 'Changed income', type: 'income' },
        })
        await prisma.monthlyPlan.create({
            data: {
                workspaceId: workspace.id,
                month: '2026-12',
                currency: 'PLN',
                funds: 0,
                incomeMode: 'transactions',
                incomeCategoryIds: [oldCategory.id],
                incomePlanned: true,
                confirmedAt: new Date(),
            },
        })
        await prisma.monthlyPlanIncomeRule.create({
            data: {
                workspaceId: workspace.id,
                effectiveMonth: '2026-11',
                currency: 'PLN',
                categoryIds: [newCategory.id],
            },
        })
        for (const [categoryId, amount] of [
            [oldCategory.id, 1000],
            [newCategory.id, 5000],
        ] as const) {
            await prisma.transaction.create({
                data: {
                    workspaceId: workspace.id,
                    paymentSourceId: source.id,
                    categoryId,
                    type: 'income',
                    amount,
                    baseAmount: amount,
                    currency: 'PLN',
                    date: new Date('2026-12-15'),
                    description: 'Test income',
                },
            })
        }
        const confirmed = await service.get(workspace.id, '2026-12')
        expect(confirmed).toMatchObject({ category_ids: [oldCategory.id], funds_cents: 1000 })
        const inherited = await service.get(workspace.id, '2027-01')
        expect(inherited).toMatchObject({ category_ids: [newCategory.id], revision: 0 })
    } finally {
        await prisma.workspace.delete({ where: { id: workspace.id } })
    }
})
