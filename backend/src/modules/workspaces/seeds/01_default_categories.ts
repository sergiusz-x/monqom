import { createHash } from 'crypto'
export interface DefaultCategoryChildSeed {
    name: string
    icon?: string
    sort_order: number
}

export interface DefaultCategoryParentSeed {
    type?: 'expense' | 'income'
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
            { name: 'Car Maintenance', icon: '🔧', sort_order: 5 },
            { name: 'Car Wash', icon: '🧽', sort_order: 6 },
            { name: 'Car Insurance', icon: '🛡️', sort_order: 7 },
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
        name: 'Pets',
        icon: '🐾',
        sort_order: 9,
        children: [
            { name: 'Pet Food & Supplies', icon: '🦴', sort_order: 1 },
            { name: 'Veterinary Care', icon: '🐶', sort_order: 2 },
            { name: 'Pet Care', icon: '✂️', sort_order: 3 },
        ],
    },
    {
        name: 'Personal Care & Fitness',
        icon: '🧴',
        sort_order: 10,
        children: [
            { name: 'Cosmetics', icon: '🧴', sort_order: 1 },
            { name: 'Hairdresser', icon: '💇', sort_order: 2 },
            { name: 'Gym & Sport', icon: '🏋️', sort_order: 3 },
            { name: 'Therapy', icon: '🧠', sort_order: 4 },
        ],
    },
    {
        name: 'Digital Services',
        icon: '☁️',
        sort_order: 11,
        children: [
            { name: 'Apps & Cloud', icon: '📱', sort_order: 1 },
            { name: 'Hosting & Domains', icon: '🌐', sort_order: 2 },
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
        systemKey: string
        icon: string | null
        sortOrder: number
        deletedAt: null
        type: 'income' | 'expense'
    }
    create: {
        id: string
        workspaceId: string
        parentId: string | null
        name: string
        systemKey: string
        icon?: string | null
        sortOrder: number
        deletedAt: null
        type: 'income' | 'expense'
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
                systemKey: toSystemKey(parent.name),
                type: 'expense',
                icon: parent.icon ?? null,
                sortOrder: parent.sort_order,
                deletedAt: null,
            },
            create: {
                id: parentId,
                workspaceId,
                parentId: null,
                name: parent.name,
                systemKey: toSystemKey(parent.name),
                type: 'expense',
                icon: parent.icon,
                sortOrder: parent.sort_order,
                deletedAt: null,
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
                    systemKey: toSystemKey(child.name),
                    type: 'expense',
                    icon: child.icon ?? null,
                    sortOrder: child.sort_order,
                    deletedAt: null,
                },
                create: {
                    id: childId,
                    workspaceId,
                    parentId: parentId,
                    name: child.name,
                    systemKey: toSystemKey(child.name),
                    type: 'expense',
                    icon: child.icon,
                    sortOrder: child.sort_order,
                    deletedAt: null,
                },
            })
        }
    }
}

function toSystemKey(name: string): string {
    return (
        'categories.' +
        name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '.')
            .replace(/^\.+|\.+$/g, '')
    )
}

export async function seedIncomeCategoriesForWorkspace(
    workspaceId: string,
    prisma: CategorySeedPrismaClient,
): Promise<void> {
    const parents = [
        {
            name: 'Work',
            icon: '💼',
            children: [
                ['Salary', '💰'],
                ['Business & Freelance', '🧑‍💻'],
            ],
        },
        {
            name: 'Other income',
            icon: '✨',
            children: [
                ['Transfer from a person', '🤝'],
                ['Refund', '↩️'],
                ['Gift', '🎁'],
                ['Sale', '🏷️'],
                ['Other', '➕'],
            ],
        },
    ] as const
    const keys: Record<string, string> = {
        Work: 'categories.income.work',
        Salary: 'categories.income.salary',
        'Business & Freelance': 'categories.income.business.freelance',
        'Other income': 'categories.income.other',
        'Transfer from a person': 'categories.income.transfer.person',
        Refund: 'categories.income.refund',
        Gift: 'categories.income.gift',
        Sale: 'categories.income.sale',
        Other: 'categories.income.other.source',
    }
    for (const [parentIndex, parent] of parents.entries()) {
        const parentId = deterministicCategoryId(workspaceId, `income/${parent.name}`)
        await prisma.category.upsert({
            where: { id: parentId },
            update: {
                workspaceId,
                parentId: null,
                name: parent.name,
                systemKey: keys[parent.name],
                icon: parent.icon,
                sortOrder: parentIndex + 1,
                deletedAt: null,
                type: 'income',
            },
            create: {
                id: parentId,
                workspaceId,
                parentId: null,
                name: parent.name,
                systemKey: keys[parent.name],
                icon: parent.icon,
                sortOrder: parentIndex + 1,
                deletedAt: null,
                type: 'income',
            },
        })
        for (const [childIndex, [name, icon]] of parent.children.entries()) {
            const id = deterministicCategoryId(workspaceId, `income/${parent.name}/${name}`)
            await prisma.category.upsert({
                where: { id },
                update: {
                    workspaceId,
                    parentId,
                    name,
                    systemKey: keys[name],
                    icon,
                    sortOrder: childIndex + 1,
                    deletedAt: null,
                    type: 'income',
                },
                create: {
                    id,
                    workspaceId,
                    parentId,
                    name,
                    systemKey: keys[name],
                    icon,
                    sortOrder: childIndex + 1,
                    deletedAt: null,
                    type: 'income',
                },
            })
        }
    }
}
