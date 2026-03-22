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

    it('adds registration fields and email verification token storage', () => {
        const migrationPath = join(
            __dirname,
            '..',
            '..',
            '..',
            'prisma',
            'migrations',
            '0002_auth_registration',
            'migration.sql',
        )

        const migrationSql = readFileSync(migrationPath, 'utf8')

        expect(migrationSql).toContain('ADD COLUMN "name" TEXT NOT NULL')
        expect(migrationSql).toContain('ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false')
        expect(migrationSql).toContain('CREATE TABLE "email_verification_tokens"')
        expect(migrationSql).toContain('CREATE UNIQUE INDEX "email_verification_tokens_token_key"')
    })
})
