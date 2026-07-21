import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { join } from 'path'
import { runOrderedSeeds } from '../src/shared/database/seed-runner'
import {
    assertSeedVerificationResult,
    collectSeedVerificationResult,
} from '../src/shared/database/seed-verification'
import { DEFAULT_WORKSPACE_ID } from './seeds/constants'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required for seeding')
}

const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
})

async function main() {
    const seedDirectory = join(__dirname, 'seeds')
    const executedSeedFiles = await runOrderedSeeds({
        seedDirectory,
        prisma,
    })

    if (executedSeedFiles.length === 0) {
        console.log('No numbered seed files found. Skipping seed execution.')
        return
    }

    const verificationResult = await collectSeedVerificationResult(prisma, DEFAULT_WORKSPACE_ID)

    assertSeedVerificationResult(verificationResult)

    console.log(`Executed seed files: ${executedSeedFiles.join(', ')}`)
    console.log(
        `Verified seeded rows for workspace ${DEFAULT_WORKSPACE_ID}: ` +
            `${verificationResult.workspaceCount} workspace, ` +
            `${verificationResult.categoryCount} categories, ` +
            `${verificationResult.paymentSourceCount} payment sources`,
    )
}

main()
    .catch((error: unknown) => {
        console.error('Database seeding failed.')
        console.error(error)
        process.exitCode = 1
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
