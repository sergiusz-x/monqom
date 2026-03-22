import { DEFAULT_CATEGORY_SEEDS, seedCategoriesForWorkspace } from './01_default_categories'

interface StoredCategory {
    id: string
    workspaceId: string
    parentId: string | null
    name: string
    icon?: string | null
}

describe('default category seed', () => {
    it('provides a valid two-level category template', () => {
        expect(DEFAULT_CATEGORY_SEEDS.length).toBeGreaterThanOrEqual(8)

        const requiredParentCategories = [
            'Food',
            'Housing',
            'Transport',
            'Health',
            'Entertainment',
            'Shopping',
            'Utilities',
            'Education',
        ]

        const parentNames = DEFAULT_CATEGORY_SEEDS.map((parent) => parent.name)

        expect(parentNames).toEqual(expect.arrayContaining(requiredParentCategories))

        for (const parent of DEFAULT_CATEGORY_SEEDS) {
            expect(parent.sort_order).toBeGreaterThan(0)
            expect(parent.children.length).toBeGreaterThanOrEqual(2)
            expect(parent.children.length).toBeLessThanOrEqual(4)

            for (const child of parent.children) {
                expect(child.name).not.toHaveLength(0)
                expect(child.sort_order).toBeGreaterThan(0)
            }
        }
    })

    it('seeds categories idempotently and keeps them workspace-scoped', async () => {
        const createdById = new Map<string, StoredCategory>()

        const prisma = {
            category: {
                upsert: async ({
                    where,
                    update,
                    create,
                }: {
                    where: { id: string }
                    update: Omit<StoredCategory, 'id'>
                    create: StoredCategory
                }) => {
                    const existingCategory = createdById.get(where.id)

                    if (existingCategory) {
                        const mergedCategory: StoredCategory = {
                            ...existingCategory,
                            ...update,
                        }
                        createdById.set(where.id, mergedCategory)

                        return mergedCategory
                    }

                    createdById.set(where.id, create)
                    return create
                },
            },
        }

        await seedCategoriesForWorkspace('workspace-a', prisma)
        const firstSeedCount = createdById.size
        await seedCategoriesForWorkspace('workspace-a', prisma)
        const secondSeedCount = createdById.size
        await seedCategoriesForWorkspace('workspace-b', prisma)
        const thirdSeedCount = createdById.size

        expect(secondSeedCount).toBe(firstSeedCount)
        expect(thirdSeedCount).toBe(firstSeedCount * 2)
        expect(firstSeedCount).toBe(
            DEFAULT_CATEGORY_SEEDS.length +
                DEFAULT_CATEGORY_SEEDS.reduce((total, parent) => total + parent.children.length, 0),
        )

        for (const category of createdById.values()) {
            if (category.workspaceId === 'workspace-a') {
                expect(category.id).toContain('cat_')
            }
        }

        const foodCategory = [...createdById.values()].find(
            (category) =>
                category.workspaceId === 'workspace-a' &&
                category.parentId === null &&
                category.name === 'Food',
        )
        const groceriesCategory = [...createdById.values()].find(
            (category) => category.workspaceId === 'workspace-a' && category.name === 'Groceries',
        )

        expect(foodCategory).toBeDefined()
        expect(groceriesCategory?.parentId).toBe(foodCategory?.id)
    })

    it('rejects blank workspace ids', async () => {
        const prisma = {
            category: {
                upsert: jest.fn(),
            },
        }

        await expect(seedCategoriesForWorkspace('   ', prisma)).rejects.toThrow(
            'workspaceId must be a non-empty string',
        )
        expect(prisma.category.upsert).not.toHaveBeenCalled()
    })
})
