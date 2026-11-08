import { Client } from 'pg'
import { readFileSync } from 'fs'
import { join } from 'path'

const databaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL
if (!databaseUrl || !/(^|[_-])test([_-]|$)/i.test(new URL(databaseUrl).pathname.slice(1)))
    throw new Error('INTEGRATION_TEST_DATABASE_URL must point to a disposable test database')

const migration = (name: string) =>
    readFileSync(join(process.cwd(), 'prisma', 'migrations', name, 'migration.sql'), 'utf8')

describe('expanded category repair migration', () => {
    it('repairs the original migration, preserves user changes and is idempotent', async () => {
        const client = new Client({ connectionString: databaseUrl })
        await client.connect()
        try {
            await client.query(`BEGIN;
                CREATE TEMP TABLE workspaces (id text PRIMARY KEY);
                CREATE TEMP TABLE categories (id text PRIMARY KEY, workspace_id text NOT NULL, parent_id text, name text NOT NULL, system_key text, icon text, sort_order int DEFAULT 0, type text DEFAULT 'expense', deleted_at timestamp, updated_at timestamp DEFAULT now());
                INSERT INTO workspaces VALUES ('old'), ('custom'), ('archived');
                INSERT INTO categories (id,workspace_id,parent_id,name,system_key) VALUES ('transport','old',NULL,'Transport','categories.transport');`)
            await client.query(migration('0016_expand_default_categories'))
            const before = await client.query(
                "SELECT id FROM categories WHERE workspace_id='old' AND name='Pet Care'",
            )
            expect(before.rowCount).toBe(0)
            await client.query(`UPDATE categories SET deleted_at=now() WHERE workspace_id='archived' AND name='Pets';
                INSERT INTO categories (id,workspace_id,parent_id,name,system_key,icon)
                SELECT 'custom-cat','custom',p.id,'Pet Care',NULL,'✨' FROM categories p WHERE p.workspace_id='custom' AND p.name='Pets';
                INSERT INTO categories (id,workspace_id,parent_id,name,system_key,deleted_at)
                SELECT 'cat_' || md5('custom:Pets/Veterinary Care'),'custom',p.id,'Renamed',NULL,now() FROM categories p WHERE p.workspace_id='custom' AND p.name='Pets';`)
            const repair = migration('0026_repair_expanded_category_children')
            await client.query(repair)
            await client.query(repair)
            const rows =
                await client.query(`SELECT workspace_id, name, icon, deleted_at FROM categories
                WHERE parent_id IN (SELECT id FROM categories WHERE name IN ('Pets','Personal Care & Fitness','Digital Services'))`)
            const old = rows.rows.filter((row) => row.workspace_id === 'old')
            expect(old).toHaveLength(9)
            const custom = rows.rows.filter((row) => row.workspace_id === 'custom')
            expect(custom.filter((row) => row.name === 'Pet Care')).toEqual([
                expect.objectContaining({ icon: '✨' }),
            ])
            expect(custom.some((row) => row.name === 'Veterinary Care')).toBe(false)
            expect(custom.find((row) => row.name === 'Renamed')?.deleted_at).toBeTruthy()
            expect(
                rows.rows.some((row) => row.workspace_id === 'archived' && row.name === 'Pet Care'),
            ).toBe(false)
        } finally {
            await client.query('ROLLBACK')
            await client.end()
        }
    })
})
