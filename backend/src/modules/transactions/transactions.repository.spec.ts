import { Prisma } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'
import { TransactionsRepository } from './transactions.repository'

describe('TransactionsRepository', () => {
    let repository: TransactionsRepository
    let prisma: {
        $queryRaw: jest.Mock
    }

    beforeEach(() => {
        prisma = {
            $queryRaw: jest.fn(),
        }

        repository = new TransactionsRepository(prisma as never as PrismaService)
    })

    it('normalizes tags case-insensitively with LOWER() in the persistence layer', async () => {
        prisma.$queryRaw.mockResolvedValue([{ name: 'Food' }, { name: 'Work' }])

        await expect(
            repository.normalizeTagsCaseInsensitive([' Food ', 'food', ' Work ']),
        ).resolves.toEqual(['Food', 'Work'])

        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)

        const query = prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql
        const renderedQuery = query.strings.join(' ')

        expect(renderedQuery).toContain('LOWER(BTRIM(name))')
        expect(renderedQuery).toContain('SELECT DISTINCT ON')
        expect(renderedQuery).toContain('ORDER BY LOWER(BTRIM(name)), position ASC')
    })

    it('builds a paginated list query with dynamic filters, tag joins, and newest-first sorting', async () => {
        prisma.$queryRaw.mockResolvedValue([])

        await repository.listTransactions({
            workspaceId: 'workspace-1',
            categoryId: 'category-1',
            paymentSourceId: 'payment-source-2',
            tag: 'Food',
            dateFrom: new Date('2026-03-21T00:00:00.000Z'),
            dateTo: new Date('2026-03-22T23:59:59.999Z'),
            limit: 20,
            offset: 40,
        })

        expect(prisma.$queryRaw).toHaveBeenCalledTimes(1)

        const query = prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql
        const renderedQuery = query.strings.join(' ')

        expect(renderedQuery).toContain('FROM "transactions" t')
        expect(renderedQuery).toContain('LEFT JOIN "transaction_tags" tt')
        expect(renderedQuery).toContain('t."workspace_id" =')
        expect(renderedQuery).toContain('t."deleted_at" IS NULL')
        expect(renderedQuery).toContain('t."category_id" =')
        expect(renderedQuery).toContain('t."payment_source_id" =')
        expect(renderedQuery).toContain('LOWER(BTRIM(tt_filter."name")) = LOWER(BTRIM(')
        expect(renderedQuery).toContain('t."date" >=')
        expect(renderedQuery).toContain('t."date" <=')
        expect(renderedQuery).toContain('ARRAY_AGG(DISTINCT tt."name" ORDER BY tt."name")')
        expect(renderedQuery).toContain('ORDER BY t."date" DESC, t."created_at" DESC')
        expect(renderedQuery).toContain('LIMIT')
        expect(renderedQuery).toContain('OFFSET')
    })

    it('counts matching transactions with the same workspace and filter clauses', async () => {
        prisma.$queryRaw.mockResolvedValue([{ total: 3 }])

        await expect(
            repository.countTransactions({
                workspaceId: 'workspace-1',
                categoryId: 'category-1',
                tag: 'Food',
            }),
        ).resolves.toBe(3)

        const query = prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql
        const renderedQuery = query.strings.join(' ')

        expect(renderedQuery).toContain('SELECT COUNT(*)::INT AS "total"')
        expect(renderedQuery).toContain('FROM "transactions" t')
        expect(renderedQuery).toContain('t."workspace_id" =')
        expect(renderedQuery).toContain('t."deleted_at" IS NULL')
        expect(renderedQuery).toContain('t."category_id" =')
        expect(renderedQuery).toContain('EXISTS')
    })

    it('lists distinct workspace tags from non-deleted transactions', async () => {
        prisma.$queryRaw.mockResolvedValue([{ name: 'Food' }, { name: 'Travel' }])

        await expect(repository.listWorkspaceTags('workspace-1')).resolves.toEqual([
            'Food',
            'Travel',
        ])

        const query = prisma.$queryRaw.mock.calls[0][0] as Prisma.Sql
        const renderedQuery = query.strings.join(' ')

        expect(renderedQuery).toContain('SELECT DISTINCT BTRIM(tt."name") AS "name"')
        expect(renderedQuery).toContain('INNER JOIN "transactions" t')
        expect(renderedQuery).toContain('tt."workspace_id" =')
        expect(renderedQuery).toContain('t."deleted_at" IS NULL')
        expect(renderedQuery).toContain('ORDER BY "name" ASC')
    })

    it('skips querying when no tags are provided', async () => {
        await expect(repository.normalizeTagsCaseInsensitive([])).resolves.toEqual([])

        expect(prisma.$queryRaw).not.toHaveBeenCalled()
    })
})
