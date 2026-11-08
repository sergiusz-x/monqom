import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { TransactionsRepository } from '../src/modules/transactions/transactions.repository'
import { AuditService } from '../src/shared/audit/audit.service'

const databaseUrl = process.env.INTEGRATION_TEST_DATABASE_URL
if (!databaseUrl || !/(^|[_-])test([_-]|$)/i.test(new URL(databaseUrl).pathname.slice(1)))
    throw new Error('INTEGRATION_TEST_DATABASE_URL must point to a disposable test database')
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
const repository = new TransactionsRepository(prisma as never, new AuditService(prisma as never))

describe('editing transactions with hidden tags', () => {
    it('preserves existing tag values when other fields are updated', async () => {
        const workspace = await prisma.workspace.create({ data: { name: 'Synthetic tag test' } })
        try {
            const source = await prisma.paymentSource.create({
                data: { workspaceId: workspace.id, name: 'Cash', type: 'cash' },
            })
            const tx = await prisma.transaction.create({
                data: {
                    workspaceId: workspace.id,
                    paymentSourceId: source.id,
                    type: 'expense',
                    amount: 500,
                    currency: 'PLN',
                    date: new Date('2026-01-01'),
                    description: 'Before',
                },
            })
            for (const name of ['Food', 'Holiday'])
                await prisma.transactionTag.create({
                    data: { workspaceId: workspace.id, transactionId: tx.id, name },
                })
            const result = await repository.updateTransactionWithTags({
                workspaceId: workspace.id,
                transactionId: tx.id,
                categoryId: null,
                paymentSourceId: source.id,
                type: 'expense',
                amount: 750,
                currency: 'PLN',
                date: new Date('2026-01-01'),
                description: 'After',
                notes: null,
                tags: ['Food', 'Holiday'],
            })
            expect(result?.description).toBe('After')
            const persisted = await prisma.transactionTag.findMany({
                where: { workspaceId: workspace.id, transactionId: tx.id },
                orderBy: { name: 'asc' },
            })
            expect(persisted.map((tag) => tag.name)).toEqual(['Food', 'Holiday'])
        } finally {
            await prisma.workspace.delete({ where: { id: workspace.id } })
        }
    })
    it('assigns a category without changing money, tags, notes, or the payment source', async () => {
        const workspace = await prisma.workspace.create({
            data: { name: 'Synthetic category test' },
        })
        const user = await prisma.user.create({
            data: {
                email: `category-${workspace.id}@example.test`,
                name: 'Test',
                passwordHash: 'unused',
            },
        })
        try {
            const source = await prisma.paymentSource.create({
                data: { workspaceId: workspace.id, name: 'Cash', type: 'cash' },
            })
            const category = await prisma.category.create({
                data: { workspaceId: workspace.id, name: 'Food', type: 'expense' },
            })
            const tx = await prisma.transaction.create({
                data: {
                    workspaceId: workspace.id,
                    paymentSourceId: source.id,
                    type: 'expense',
                    amount: 500,
                    currency: 'EUR',
                    baseAmount: 2150,
                    fxRate: '4.3',
                    fxRateDate: new Date('2026-01-01'),
                    fxSource: 'test',
                    date: new Date('2026-01-01'),
                    description: 'Synthetic transaction',
                    notes: 'Keep me',
                },
            })
            const tag = await prisma.transactionTag.create({
                data: { workspaceId: workspace.id, transactionId: tx.id, name: 'Hidden' },
            })
            const previous = await repository.findTransactionById(workspace.id, tx.id)
            expect(previous).not.toBeNull()
            const input = {
                workspaceId: workspace.id,
                transactionId: tx.id,
                userId: user.id,
                categoryId: category.id,
                previousTransaction: previous!,
            }
            expect(
                await prisma.$transaction((client) => repository.assignCategory(input, client)),
            ).toBe(true)
            const current = await prisma.transaction.findUniqueOrThrow({ where: { id: tx.id } })
            expect(current).toMatchObject({
                categoryId: category.id,
                paymentSourceId: source.id,
                amount: 500,
                currency: 'EUR',
                baseAmount: 2150,
                fxSource: 'test',
                notes: 'Keep me',
                version: tx.version + 1,
            })
            expect(current.fxRate.toString()).toBe('4.3')
            expect(await prisma.transactionTag.findUnique({ where: { id: tag.id } })).toMatchObject(
                { name: 'Hidden' },
            )
            expect(
                await prisma.auditEvent.count({
                    where: { workspaceId: workspace.id, action: 'TRANSACTION_UPDATED' },
                }),
            ).toBe(1)
            expect(
                await prisma.$transaction((client) => repository.assignCategory(input, client)),
            ).toBe(false)
        } finally {
            await prisma.workspace.delete({ where: { id: workspace.id } })
            await prisma.user.delete({ where: { id: user.id } })
        }
    })
    afterAll(async () => {
        await prisma.$disconnect()
    })
})
