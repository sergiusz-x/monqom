import { PrismaClient } from '@prisma/client'
import { DEFAULT_CATEGORIES, DEFAULT_PAYMENT_SOURCES, DEFAULT_WORKSPACE_ID } from './constants'

export async function seed(prisma: PrismaClient) {
    for (const [parentIndex, parentCategory] of DEFAULT_CATEGORIES.entries()) {
        await prisma.category.upsert({
            where: {
                id: parentCategory.id,
            },
            update: {
                workspaceId: DEFAULT_WORKSPACE_ID,
                parentId: null,
                name: parentCategory.name,
                icon: parentCategory.icon,
                sortOrder: parentIndex + 1,
                deletedAt: null,
            },
            create: {
                id: parentCategory.id,
                workspaceId: DEFAULT_WORKSPACE_ID,
                parentId: null,
                name: parentCategory.name,
                icon: parentCategory.icon,
                sortOrder: parentIndex + 1,
                deletedAt: null,
            },
        })

        for (const [childIndex, childCategory] of parentCategory.children.entries()) {
            await prisma.category.upsert({
                where: {
                    id: childCategory.id,
                },
                update: {
                    workspaceId: DEFAULT_WORKSPACE_ID,
                    parentId: parentCategory.id,
                    name: childCategory.name,
                    icon: null,
                    sortOrder: childIndex + 1,
                    deletedAt: null,
                },
                create: {
                    id: childCategory.id,
                    workspaceId: DEFAULT_WORKSPACE_ID,
                    parentId: parentCategory.id,
                    name: childCategory.name,
                    sortOrder: childIndex + 1,
                    deletedAt: null,
                },
            })
        }
    }

    for (const paymentSource of DEFAULT_PAYMENT_SOURCES) {
        await prisma.paymentSource.upsert({
            where: {
                id: paymentSource.id,
            },
            update: {
                workspaceId: DEFAULT_WORKSPACE_ID,
                name: paymentSource.name,
                type: paymentSource.type,
                deletedAt: null,
            },
            create: {
                id: paymentSource.id,
                workspaceId: DEFAULT_WORKSPACE_ID,
                name: paymentSource.name,
                type: paymentSource.type,
            },
        })
    }
}
