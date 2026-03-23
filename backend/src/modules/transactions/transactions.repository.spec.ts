import { Prisma } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'
import { TransactionsRepository } from './transactions.repository'

describe('TransactionsRepository', () => {
    let repository: TransactionsRepository
    let prisma: {
        $queryRaw: jest.Mock
        $transaction: jest.Mock
        auditEvent: {
            create: jest.Mock
        }
        transaction: {
            findFirst: jest.Mock
            updateMany: jest.Mock
        }
        transactionTag: {
            create: jest.Mock
            deleteMany: jest.Mock
        }
    }

    beforeEach(() => {
        prisma = {
            $queryRaw: jest.fn(),
            $transaction: jest.fn(async (callback: (tx: typeof prisma) => Promise<unknown>) =>
                callback(prisma),
            ),
            auditEvent: {
                create: jest.fn(),
            },
            transaction: {
                findFirst: jest.fn(),
                updateMany: jest.fn(),
            },
            transactionTag: {
                create: jest.fn(),
                deleteMany: jest.fn(),
            },
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

    it('loads a single non-deleted transaction scoped to its workspace with ordered tags', async () => {
        const transaction = {
            id: 'transaction-1',
            workspaceId: 'workspace-1',
            categoryId: 'category-1',
            paymentSourceId: 'payment-source-1',
            type: 'expense',
            amount: 1050,
            currency: 'USD',
            date: new Date('2026-03-23T00:00:00.000Z'),
            notes: 'Lunch',
            createdAt: new Date('2026-03-23T12:00:00.000Z'),
            updatedAt: new Date('2026-03-23T12:00:00.000Z'),
            deletedAt: null,
            tags: [],
        }

        prisma.transaction.findFirst.mockResolvedValue(transaction)

        await expect(
            repository.findTransactionById('workspace-1', 'transaction-1'),
        ).resolves.toEqual(transaction)

        expect(prisma.transaction.findFirst).toHaveBeenCalledWith({
            where: {
                workspaceId: 'workspace-1',
                id: 'transaction-1',
                deletedAt: null,
            },
            include: {
                tags: {
                    orderBy: {
                        name: 'asc',
                    },
                },
            },
        })
    })

    it('updates a transaction and replaces its tags with normalized values', async () => {
        prisma.$queryRaw.mockResolvedValue([{ name: 'Travel' }, { name: 'Work' }])
        prisma.transaction.updateMany.mockResolvedValue({ count: 1 })
        prisma.transactionTag.deleteMany.mockResolvedValue({ count: 2 })
        prisma.transactionTag.create
            .mockResolvedValueOnce({
                id: 'tag-1',
                workspaceId: 'workspace-1',
                transactionId: 'transaction-1',
                name: 'Travel',
                createdAt: new Date('2026-03-24T09:00:01.000Z'),
                updatedAt: new Date('2026-03-24T09:00:01.000Z'),
            })
            .mockResolvedValueOnce({
                id: 'tag-2',
                workspaceId: 'workspace-1',
                transactionId: 'transaction-1',
                name: 'Work',
                createdAt: new Date('2026-03-24T09:00:02.000Z'),
                updatedAt: new Date('2026-03-24T09:00:02.000Z'),
            })
        prisma.transaction.findFirst.mockResolvedValue({
            id: 'transaction-1',
            workspaceId: 'workspace-1',
            categoryId: 'category-2',
            paymentSourceId: 'payment-source-2',
            type: 'expense',
            amount: 1275,
            currency: 'USD',
            date: new Date('2026-03-24T08:30:00.000Z'),
            notes: 'Bus pass',
            createdAt: new Date('2026-03-23T12:00:00.000Z'),
            updatedAt: new Date('2026-03-24T09:00:00.000Z'),
            deletedAt: null,
        })

        await expect(
            repository.updateTransactionWithTags({
                workspaceId: 'workspace-1',
                transactionId: 'transaction-1',
                categoryId: 'category-2',
                paymentSourceId: 'payment-source-2',
                type: 'expense',
                amount: 1275,
                currency: 'USD',
                date: new Date('2026-03-24T08:30:00.000Z'),
                notes: 'Bus pass',
                tags: [' Travel ', 'travel', ' Work '],
            }),
        ).resolves.toEqual({
            id: 'transaction-1',
            workspaceId: 'workspace-1',
            categoryId: 'category-2',
            paymentSourceId: 'payment-source-2',
            type: 'expense',
            amount: 1275,
            currency: 'USD',
            date: new Date('2026-03-24T08:30:00.000Z'),
            notes: 'Bus pass',
            createdAt: new Date('2026-03-23T12:00:00.000Z'),
            updatedAt: new Date('2026-03-24T09:00:00.000Z'),
            deletedAt: null,
            tags: [
                {
                    id: 'tag-1',
                    workspaceId: 'workspace-1',
                    transactionId: 'transaction-1',
                    name: 'Travel',
                    createdAt: new Date('2026-03-24T09:00:01.000Z'),
                    updatedAt: new Date('2026-03-24T09:00:01.000Z'),
                },
                {
                    id: 'tag-2',
                    workspaceId: 'workspace-1',
                    transactionId: 'transaction-1',
                    name: 'Work',
                    createdAt: new Date('2026-03-24T09:00:02.000Z'),
                    updatedAt: new Date('2026-03-24T09:00:02.000Z'),
                },
            ],
        })

        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
        expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
            where: {
                workspaceId: 'workspace-1',
                id: 'transaction-1',
                deletedAt: null,
            },
            data: {
                categoryId: 'category-2',
                paymentSourceId: 'payment-source-2',
                type: 'expense',
                amount: 1275,
                currency: 'USD',
                date: new Date('2026-03-24T08:30:00.000Z'),
                notes: 'Bus pass',
            },
        })
        expect(prisma.transactionTag.deleteMany).toHaveBeenCalledWith({
            where: {
                workspaceId: 'workspace-1',
                transactionId: 'transaction-1',
            },
        })
        expect(prisma.transactionTag.create).toHaveBeenNthCalledWith(1, {
            data: {
                workspaceId: 'workspace-1',
                transactionId: 'transaction-1',
                name: 'Travel',
            },
        })
        expect(prisma.transactionTag.create).toHaveBeenNthCalledWith(2, {
            data: {
                workspaceId: 'workspace-1',
                transactionId: 'transaction-1',
                name: 'Work',
            },
        })
    })

    it('returns null without replacing tags when no active transaction row is updated', async () => {
        prisma.transaction.updateMany.mockResolvedValue({ count: 0 })

        await expect(
            repository.updateTransactionWithTags({
                workspaceId: 'workspace-1',
                transactionId: 'transaction-1',
                categoryId: 'category-2',
                paymentSourceId: 'payment-source-2',
                type: 'expense',
                amount: 1275,
                currency: 'USD',
                date: new Date('2026-03-24T08:30:00.000Z'),
                notes: 'Bus pass',
                tags: [' Travel ', 'travel', ' Work '],
            }),
        ).resolves.toBeNull()

        expect(prisma.$queryRaw).not.toHaveBeenCalled()
        expect(prisma.transactionTag.deleteMany).not.toHaveBeenCalled()
        expect(prisma.transactionTag.create).not.toHaveBeenCalled()
        expect(prisma.transaction.findFirst).not.toHaveBeenCalled()
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

    it('soft deletes a transaction and records the previous transaction snapshot in the audit log', async () => {
        const deletedAt = new Date('2026-03-24T10:00:00.000Z')
        prisma.transaction.updateMany.mockResolvedValue({ count: 1 })
        prisma.auditEvent.create.mockResolvedValue({ id: 'audit-event-1' })

        await expect(
            repository.softDeleteTransaction({
                workspaceId: 'workspace-1',
                transactionId: 'transaction-1',
                userId: 'user-1',
                deletedAt,
                transaction: {
                    id: 'transaction-1',
                    workspaceId: 'workspace-1',
                    categoryId: 'category-1',
                    paymentSourceId: 'payment-source-1',
                    type: 'expense',
                    amount: 1050,
                    currency: 'USD',
                    date: new Date('2026-03-23T00:00:00.000Z'),
                    notes: 'Lunch',
                    createdAt: new Date('2026-03-23T12:00:00.000Z'),
                    updatedAt: new Date('2026-03-23T12:00:00.000Z'),
                    deletedAt: null,
                    tags: [
                        {
                            id: 'tag-1',
                            workspaceId: 'workspace-1',
                            transactionId: 'transaction-1',
                            name: 'Food',
                            createdAt: new Date('2026-03-23T12:00:01.000Z'),
                            updatedAt: new Date('2026-03-23T12:00:01.000Z'),
                        },
                    ],
                },
            }),
        ).resolves.toBe(true)

        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
        expect(prisma.transaction.updateMany).toHaveBeenCalledWith({
            where: {
                workspaceId: 'workspace-1',
                id: 'transaction-1',
                deletedAt: null,
            },
            data: {
                deletedAt,
            },
        })
        expect(prisma.auditEvent.create).toHaveBeenCalledWith({
            data: {
                action: 'TRANSACTION_DELETED',
                workspaceId: 'workspace-1',
                userId: 'user-1',
                entityType: 'TRANSACTION',
                entityId: 'transaction-1',
                metadata: {
                    id: 'transaction-1',
                    workspace_id: 'workspace-1',
                    category_id: 'category-1',
                    payment_source_id: 'payment-source-1',
                    type: 'expense',
                    amount: 1050,
                    currency: 'USD',
                    date: '2026-03-23T00:00:00.000Z',
                    notes: 'Lunch',
                    tags: ['Food'],
                    created_at: '2026-03-23T12:00:00.000Z',
                    updated_at: '2026-03-23T12:00:00.000Z',
                },
            },
        })
    })

    it('returns false and skips audit logging when no active transaction row is deleted', async () => {
        prisma.transaction.updateMany.mockResolvedValue({ count: 0 })

        await expect(
            repository.softDeleteTransaction({
                workspaceId: 'workspace-1',
                transactionId: 'transaction-1',
                userId: 'user-1',
                deletedAt: new Date('2026-03-24T10:00:00.000Z'),
                transaction: {
                    id: 'transaction-1',
                    workspaceId: 'workspace-1',
                    categoryId: 'category-1',
                    paymentSourceId: 'payment-source-1',
                    type: 'expense',
                    amount: 1050,
                    currency: 'USD',
                    date: new Date('2026-03-23T00:00:00.000Z'),
                    notes: 'Lunch',
                    createdAt: new Date('2026-03-23T12:00:00.000Z'),
                    updatedAt: new Date('2026-03-23T12:00:00.000Z'),
                    deletedAt: null,
                    tags: [],
                },
            }),
        ).resolves.toBe(false)

        expect(prisma.auditEvent.create).not.toHaveBeenCalled()
    })

    it('skips querying when no tags are provided', async () => {
        await expect(repository.normalizeTagsCaseInsensitive([])).resolves.toEqual([])

        expect(prisma.$queryRaw).not.toHaveBeenCalled()
    })
})
