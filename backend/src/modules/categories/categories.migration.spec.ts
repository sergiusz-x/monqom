import { readFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_CATEGORIES } from '../../../prisma/seeds/constants'
import { DEFAULT_CATEGORY_SEEDS } from '../workspaces/seeds/01_default_categories'

describe('category sort-order migration', () => {
    const migrationPath = join(
        process.cwd(),
        'prisma',
        'migrations',
        '0009_category_sort_order_and_archive',
        'migration.sql',
    )
    const migrationSql = readFileSync(migrationPath, 'utf8')

    it('covers every seeded parent category name from current and legacy seed sources', () => {
        const parentNames = new Set<string>([
            ...DEFAULT_CATEGORY_SEEDS.map((category) => category.name),
            ...DEFAULT_CATEGORIES.map((category) => category.name),
        ])

        for (const parentName of parentNames) {
            expect(migrationSql).toContain(`WHEN '${parentName}' THEN`)
        }
    })

    it('covers every seeded child category name from current and legacy seed sources', () => {
        const childNames = new Set<string>([
            ...DEFAULT_CATEGORY_SEEDS.flatMap((category) =>
                category.children.map((childCategory) => childCategory.name),
            ),
            ...DEFAULT_CATEGORIES.flatMap((category) =>
                category.children.map((childCategory) => childCategory.name),
            ),
        ])

        for (const childName of childNames) {
            expect(migrationSql).toContain(`child."name" = '${childName}'`)
        }
    })
})
