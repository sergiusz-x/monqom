import { PrismaClient } from '@prisma/client'
import { DEFAULT_WORKSPACE_ID, DEFAULT_WORKSPACE_NAME } from './constants'

export async function seed(prisma: PrismaClient) {
    await prisma.workspace.upsert({
        where: { id: DEFAULT_WORKSPACE_ID },
        update: {
            name: DEFAULT_WORKSPACE_NAME,
        },
        create: {
            id: DEFAULT_WORKSPACE_ID,
            name: DEFAULT_WORKSPACE_NAME,
        },
    })
}
