import { readdir } from 'fs/promises'
import { join } from 'path'
import { createRequire } from 'module'

export const ORDERED_SEED_FILE_PATTERN = /^\d+_.+\.(ts|js)$/

export type SeedHandler<TClient> = (client: TClient) => Promise<void> | void

export interface SeedModule<TClient> {
    seed?: SeedHandler<TClient>
    default?: SeedHandler<TClient>
}

export interface RunOrderedSeedsOptions<TClient> {
    seedDirectory: string
    prisma: TClient
    readDirectory?: (seedDirectory: string) => Promise<string[]>
    moduleLoader?: (seedPath: string) => Promise<SeedModule<TClient>>
}

export function orderSeedFiles(seedFiles: string[]): string[] {
    return [...seedFiles]
        .filter((seedFile) => ORDERED_SEED_FILE_PATTERN.test(seedFile))
        .sort((left, right) => left.localeCompare(right, 'en'))
}

async function defaultModuleLoader<TClient>(seedPath: string): Promise<SeedModule<TClient>> {
    const require = createRequire(__filename)
    return require(seedPath) as SeedModule<TClient>
}

export async function runOrderedSeeds<TClient>({
    seedDirectory,
    prisma,
    readDirectory = readdir,
    moduleLoader = defaultModuleLoader,
}: RunOrderedSeedsOptions<TClient>): Promise<string[]> {
    const discoveredSeedFiles = await readDirectory(seedDirectory)
    const orderedSeedFiles = orderSeedFiles(discoveredSeedFiles)

    const executedSeedFiles: string[] = []

    for (const orderedSeedFile of orderedSeedFiles) {
        const seedPath = join(seedDirectory, orderedSeedFile)
        const seedModule = await moduleLoader(seedPath)
        const seedHandler = seedModule.seed ?? seedModule.default

        if (typeof seedHandler !== 'function') {
            throw new Error(
                `Seed file '${orderedSeedFile}' must export a 'seed' or default function`,
            )
        }

        await seedHandler(prisma)
        executedSeedFiles.push(orderedSeedFile)
    }

    return executedSeedFiles
}
