import { NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'

/** Keep the currency stable until the financial write commits; concurrent writers may share it. */
export async function lockWorkspaceCurrency(tx: Prisma.TransactionClient, workspaceId: string) {
    const rows = await tx.$queryRaw<Array<{ baseCurrency: string; timezone: string }>>(Prisma.sql`
        SELECT base_currency AS "baseCurrency", timezone FROM workspaces
        WHERE id = ${workspaceId} FOR SHARE
    `)
    if (!rows[0]) throw new NotFoundException('Workspace not found')
    return rows[0]
}
