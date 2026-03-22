import { readFileSync } from 'fs'
import { join } from 'path'

describe('Prisma migrations', () => {
    it('enforces positive monetary amounts and valid budget months', () => {
        const migrationPath = join(
            __dirname,
            '..',
            '..',
            '..',
            'prisma',
            'migrations',
            '0001_init',
            'migration.sql',
        )

        const migrationSql = readFileSync(migrationPath, 'utf8')

        expect(migrationSql).toContain('transactions_amount_positive_check')
        expect(migrationSql).toContain('CHECK ("amount" > 0)')
        expect(migrationSql).toContain('budgets_amount_positive_check')
        expect(migrationSql).toContain('budgets_month_valid_check')
        expect(migrationSql).toContain('CHECK ("month" BETWEEN 1 AND 12)')
    })
})
