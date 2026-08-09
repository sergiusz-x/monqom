import { readFileSync } from 'fs'
import { join } from 'path'
import { DEFAULT_CATEGORY_SEEDS } from '../workspaces/seeds/01_default_categories'

describe('expanded default categories migration', () => {
    const migrationPath = join(
        process.cwd(),
        'prisma',
        'migrations',
        '0016_expand_default_categories',
        'migration.sql',
    )
    const migrationSql = readFileSync(migrationPath, 'utf8')

    const addedParentNames = ['Pets', 'Personal Care & Fitness', 'Digital Services']
    const addedChildNames = [
        'Car Maintenance',
        'Car Wash',
        'Car Insurance',
        ...DEFAULT_CATEGORY_SEEDS.filter((category) =>
            addedParentNames.includes(category.name),
        ).flatMap((category) => category.children.map((child) => child.name)),
    ]

    it('adds each new top-level default category for every workspace', () => {
        for (const parentName of addedParentNames) {
            expect(migrationSql).toContain(`('${parentName}',`)
        }
        expect(migrationSql).toContain('FROM workspaces w')
    })

    it('adds each new default subcategory without overwriting existing data', () => {
        for (const childName of addedChildNames) {
            expect(migrationSql).toContain(`'${childName}'`)
        }
        expect(migrationSql).toContain('WHERE NOT EXISTS')
    })
})
