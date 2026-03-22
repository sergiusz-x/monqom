import type { PrismaClient } from '@prisma/client'

export interface SeedVerificationResult {
    workspaceCount: number
    categoryCount: number
    paymentSourceCount: number
}

export type SeedVerificationPrismaClient = Pick<PrismaClient, 'workspace' | 'category' | 'paymentSource'>

export async function collectSeedVerificationResult(
    prisma: SeedVerificationPrismaClient,
    workspaceId: string,
): Promise<SeedVerificationResult> {
    const [workspaceCount, categoryCount, paymentSourceCount] = await Promise.all([
        prisma.workspace.count({ where: { id: workspaceId } }),
        prisma.category.count({ where: { workspaceId } }),
        prisma.paymentSource.count({ where: { workspaceId } }),
    ])

    return {
        workspaceCount,
        categoryCount,
        paymentSourceCount,
    }
}

export function assertSeedVerificationResult(result: SeedVerificationResult): void {
    if (result.workspaceCount < 1) {
        throw new Error('Seed verification failed: no workspace rows were created')
    }

    if (result.categoryCount < 1) {
        throw new Error('Seed verification failed: no category rows were created')
    }

    if (result.paymentSourceCount < 1) {
        throw new Error('Seed verification failed: no payment source rows were created')
    }
}
