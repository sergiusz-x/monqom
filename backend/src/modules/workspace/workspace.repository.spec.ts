import { WorkspaceRepository } from './workspace.repository'

describe('WorkspaceRepository', () => {
    it.each([
        [{ transactions: 1, budgets: 0 }, true],
        [{ transactions: 0, budgets: 1 }, true],
        [{ transactions: 0, budgets: 0 }, false],
    ])('derives the base currency lock from financial records', async (_count, expected) => {
        const prisma = {
            workspace: {
                findUnique: jest.fn().mockResolvedValue({
                    id: 'workspace-1',
                    name: 'Household',
                    type: 'personal',
                    timezone: 'UTC',
                    baseCurrency: 'PLN',
                    createdAt: new Date('2026-01-01T00:00:00.000Z'),
                    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
                    _count,
                }),
            },
        }
        const repository = new WorkspaceRepository(prisma as never)

        await expect(repository.findWorkspaceById('workspace-1')).resolves.toMatchObject({
            baseCurrencyLocked: expected,
        })
        expect(prisma.workspace.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                include: {
                    _count: {
                        select: {
                            transactions: true,
                            budgets: true,
                        },
                    },
                },
            }),
        )
    })
})
