import { orderSeedFiles, runOrderedSeeds } from './seed-runner'

describe('Seed runner', () => {
    it('orders only numbered seed files lexicographically', () => {
        const orderedSeeds = orderSeedFiles([
            'notes.md',
            '02_payment-sources.ts',
            '10_final.ts',
            '01_workspace.ts',
            'abc.ts',
            '03_categories.js',
        ])

        expect(orderedSeeds).toEqual([
            '01_workspace.ts',
            '02_payment-sources.ts',
            '03_categories.js',
            '10_final.ts',
        ])
    })

    it('executes discovered seeds in deterministic order', async () => {
        const executionOrder: string[] = []

        const executedSeedFiles = await runOrderedSeeds({
            seedDirectory: '/virtual/prisma/seeds',
            prisma: {},
            readDirectory: async () => ['02_second.ts', '01_first.ts'],
            moduleLoader: async (seedPath: string) => {
                if (seedPath.endsWith('01_first.ts')) {
                    return {
                        seed: async () => {
                            executionOrder.push('01_first.ts')
                        },
                    }
                }

                return {
                    default: async () => {
                        executionOrder.push('02_second.ts')
                    },
                }
            },
        })

        expect(executionOrder).toEqual(['01_first.ts', '02_second.ts'])
        expect(executedSeedFiles).toEqual(['01_first.ts', '02_second.ts'])
    })

    it('returns an empty execution list when no ordered seed files exist', async () => {
        const executedSeedFiles = await runOrderedSeeds({
            seedDirectory: '/virtual/prisma/seeds',
            prisma: {},
            readDirectory: async () => ['README.md', 'seed-helper.ts'],
            moduleLoader: async () => {
                throw new Error('module loader should not run when there are no ordered seeds')
            },
        })

        expect(executedSeedFiles).toEqual([])
    })

    it('throws when a seed module has no executable export', async () => {
        await expect(
            runOrderedSeeds({
                seedDirectory: '/virtual/prisma/seeds',
                prisma: {},
                readDirectory: async () => ['01_invalid.ts'],
                moduleLoader: async () => ({}),
            }),
        ).rejects.toThrow("Seed file '01_invalid.ts' must export a 'seed' or default function")
    })
})
