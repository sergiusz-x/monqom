import { assertSeedVerificationResult, collectSeedVerificationResult } from './seed-verification'
import type { SeedVerificationPrismaClient } from './seed-verification'

describe('Seed verification', () => {
    it('collects seeded row counts for the target workspace', async () => {
        const prisma = {
            workspace: {
                count: jest.fn().mockResolvedValue(1),
            },
            category: {
                count: jest.fn().mockResolvedValue(9),
            },
            paymentSource: {
                count: jest.fn().mockResolvedValue(5),
            },
        } as unknown as SeedVerificationPrismaClient

        const result = await collectSeedVerificationResult(prisma, 'workspace-id')

        expect(prisma.workspace.count).toHaveBeenCalledWith({ where: { id: 'workspace-id' } })
        expect(prisma.category.count).toHaveBeenCalledWith({
            where: { workspaceId: 'workspace-id' },
        })
        expect(prisma.paymentSource.count).toHaveBeenCalledWith({
            where: { workspaceId: 'workspace-id' },
        })
        expect(result).toEqual({
            workspaceCount: 1,
            categoryCount: 9,
            paymentSourceCount: 5,
        })
    })

    it.each([
        [{ workspaceCount: 0, categoryCount: 9, paymentSourceCount: 5 }, 'workspace rows'],
        [{ workspaceCount: 1, categoryCount: 0, paymentSourceCount: 5 }, 'category rows'],
        [{ workspaceCount: 1, categoryCount: 9, paymentSourceCount: 0 }, 'payment source rows'],
    ])('fails when required seeded data is missing', (result, expectedMessagePart) => {
        expect(() => assertSeedVerificationResult(result)).toThrow(expectedMessagePart)
    })
})
