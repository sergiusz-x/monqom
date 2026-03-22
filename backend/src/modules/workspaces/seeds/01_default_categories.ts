import { createHash } from 'crypto'
export interface DefaultCategoryChildSeed {
    name: string
    icon?: string
    sort_order: number
}

export interface DefaultCategoryParentSeed {
    name: string
    icon?: string
    sort_order: number
    children: readonly DefaultCategoryChildSeed[]
}

export const DEFAULT_CATEGORY_SEEDS: readonly DefaultCategoryParentSeed[] = [
    {
        name: 'Food',
        icon: '🍽️',
        sort_order: 1,
        children: [
            { name: 'Groceries', icon: '🛒', sort_order: 1 },
            { name: 'Restaurants', icon: '🍝', sort_order: 2 },
            { name: 'Coffee', icon: '☕', sort_order: 3 },
            { name: 'Delivery', icon: '🛵', sort_order: 4 },
        ],
    },
    {
        name: 'Housing',
        icon: '🏠',
        sort_order: 2,
        children: [
            { name: 'Rent', icon: '📅', sort_order: 1 },
            { name: 'Utilities', icon: '💡', sort_order: 2 },
            { name: 'Maintenance', icon: '🧰', sort_order: 3 },
            { name: 'Insurance', icon: '🧾', sort_order: 4 },
        ],
    },
    {
        name: 'Transport',
        icon: '🚗',
        sort_order: 3,
        children: [
            { name: 'Fuel', icon: '⛽', sort_order: 1 },
            { name: 'Public Transport', icon: '🚌', sort_order: 2 },
            { name: 'Taxi', icon: '🚕', sort_order: 3 },
            { name: 'Parking', icon: '🅿️', sort_order: 4 },
        ],
    },
    {
        name: 'Health',
        icon: '🩺',
        sort_order: 4,
        children: [
            { name: 'Pharmacy', icon: '💊', sort_order: 1 },
            { name: 'Doctor', icon: '👨‍⚕️', sort_order: 2 },
            { name: 'Dental', icon: '🦷', sort_order: 3 },
        ],
    },
    {
        name: 'Entertainment',
        icon: '🎬',
        sort_order: 5,
        children: [
            { name: 'Streaming', icon: '📺', sort_order: 1 },
            { name: 'Games', icon: '🎮', sort_order: 2 },
            { name: 'Events', icon: '🎟️', sort_order: 3 },
        ],
    },
    {
        name: 'Shopping',
        icon: '🛍️',
        sort_order: 6,
        children: [
            { name: 'Clothing', icon: '👕', sort_order: 1 },
            { name: 'Electronics', icon: '📱', sort_order: 2 },
            { name: 'Home Goods', icon: '🪑', sort_order: 3 },
        ],
    },
    {
        name: 'Utilities',
        icon: '🔌',
        sort_order: 7,
        children: [
            { name: 'Electricity', icon: '⚡', sort_order: 1 },
            { name: 'Water', icon: '🚰', sort_order: 2 },
            { name: 'Internet', icon: '🌐', sort_order: 3 },
            { name: 'Phone', icon: '📞', sort_order: 4 },
        ],
    },
    {
        name: 'Education',
        icon: '🎓',
        sort_order: 8,
        children: [
            { name: 'Books', icon: '📚', sort_order: 1 },
            { name: 'Courses', icon: '🧑‍🏫', sort_order: 2 },
            { name: 'Supplies', icon: '✏️', sort_order: 3 },
        ],
    },
]

interface CategorySeedUpsertArgs {
    where: {
        id: string
    }
    update: {
        workspaceId: string
        parentId: string | null
        name: string
        icon: string | null
    }
    create: {
        id: string
        workspaceId: string
        parentId: string | null
        name: string
        icon?: string | null
    }
}

interface CategorySeedPrismaClient {
    category: {
        upsert(args: CategorySeedUpsertArgs): Promise<unknown>
    }
}

function deterministicCategoryId(workspaceId: string, categoryPath: string): string {
    const hash = createHash('sha256')
        .update(`${workspaceId}:${categoryPath}`)
        .digest('hex')
        .slice(0, 32)
    return `cat_${hash}`
}

export async function seedCategoriesForWorkspace(
    workspaceId: string,
    prisma: CategorySeedPrismaClient,
): Promise<void> {
    if (workspaceId.trim().length === 0) {
        throw new Error('workspaceId must be a non-empty string')
    }

    const orderedParents = [...DEFAULT_CATEGORY_SEEDS].sort(
        (left, right) => left.sort_order - right.sort_order,
    )

    for (const parent of orderedParents) {
        const parentId = deterministicCategoryId(workspaceId, parent.name)

        await prisma.category.upsert({
            where: { id: parentId },
            update: {
                workspaceId,
                parentId: null,
                name: parent.name,
                icon: parent.icon ?? null,
            },
            create: {
                id: parentId,
                workspaceId,
                parentId: null,
                name: parent.name,
                icon: parent.icon,
            },
        })

        const orderedChildren = [...parent.children].sort(
            (left, right) => left.sort_order - right.sort_order,
        )

        for (const child of orderedChildren) {
            const childId = deterministicCategoryId(workspaceId, `${parent.name}/${child.name}`)

            await prisma.category.upsert({
                where: { id: childId },
                update: {
                    workspaceId,
                    parentId: parentId,
                    name: child.name,
                    icon: child.icon ?? null,
                },
                create: {
                    id: childId,
                    workspaceId,
                    parentId: parentId,
                    name: child.name,
                    icon: child.icon,
                },
            })
        }
    }
}
