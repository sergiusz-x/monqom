import { BadRequestException } from '@nestjs/common'
import {
    ExportTransactionRecord,
    TransactionsRepository,
} from '../transactions/transactions.repository'
import { ExportService } from './export.service'

describe('ExportService', () => {
    let service: ExportService
    let transactionsRepository: jest.Mocked<
        Pick<TransactionsRepository, 'listTransactionsForExport'>
    >

    beforeEach(() => {
        transactionsRepository = {
            listTransactionsForExport: jest.fn(),
        }

        service = new ExportService(transactionsRepository as unknown as TransactionsRepository)
    })

    it('exports CSV rows with headers, escaped values, and inclusive date filters', async () => {
        transactionsRepository.listTransactionsForExport.mockResolvedValueOnce([
            createExportTransactionRecord({
                date: new Date('2026-03-22T09:30:00.000Z'),
                amount: 4050,
                category: 'Food',
                notes: 'Lunch, with team',
                tags: ['commute', 'food'],
                payment_source: 'Main Card',
            }),
        ])

        const exportFile = await service.exportTransactions(
            {
                format: 'csv',
                date_from: '2026-03-21',
                date_to: '2026-03-22',
            },
            ' workspace-1 ',
        )

        await expect(readExportChunks(exportFile.chunks)).resolves.toBe(
            [
                'date,amount,category,notes,tags,payment_source',
                '2026-03-22T09:30:00.000Z,40.50,Food,"Lunch, with team","commute, food",Main Card',
                '',
            ].join('\n'),
        )
        expect(exportFile.contentType).toBe('text/csv; charset=utf-8')
        expect(exportFile.contentDisposition).toMatch(
            /^attachment; filename="transactions-export-\d{4}-\d{2}-\d{2}\.csv"$/,
        )
        expect(transactionsRepository.listTransactionsForExport).toHaveBeenCalledWith({
            workspaceId: 'workspace-1',
            dateFrom: new Date('2026-03-21T00:00:00.000Z'),
            dateTo: new Date('2026-03-22T23:59:59.999Z'),
            limit: 500,
            offset: 0,
        })
    })

    it('sanitizes CSV formula-like values to prevent spreadsheet injection', async () => {
        transactionsRepository.listTransactionsForExport.mockResolvedValueOnce([
            createExportTransactionRecord({
                category: '=Category',
                notes: ' +SUM(A1:A2)',
                tags: ['-unsafe', ' @meta'],
                payment_source: '=Wallet',
            }),
        ])

        const exportFile = await service.exportTransactions({ format: 'csv' }, 'workspace-1')

        await expect(readExportChunks(exportFile.chunks)).resolves.toBe(
            [
                'date,amount,category,notes,tags,payment_source',
                `2026-03-22T09:30:00.000Z,40.50,'=Category,' +SUM(A1:A2),"'-unsafe,  @meta",'=Wallet`,
                '',
            ].join('\n'),
        )
    })

    it('streams JSON exports across repository batches', async () => {
        transactionsRepository.listTransactionsForExport
            .mockResolvedValueOnce(
                Array.from({ length: 500 }, (_, index) =>
                    createExportTransactionRecord({
                        date: new Date(
                            `2026-03-${String((index % 28) + 1).padStart(2, '0')}T08:00:00.000Z`,
                        ),
                        amount: 1000 + index,
                        category: 'Food',
                        notes: `Expense ${index + 1}`,
                        tags: ['Recurring'],
                        payment_source: 'Main Card',
                    }),
                ),
            )
            .mockResolvedValueOnce([
                createExportTransactionRecord({
                    date: new Date('2026-03-29T08:00:00.000Z'),
                    amount: 2500,
                    category: 'Transport',
                    notes: 'Expense 501',
                    tags: ['Travel'],
                    payment_source: null,
                }),
            ])

        const exportFile = await service.exportTransactions({ format: 'json' }, 'workspace-1')
        const transactions = JSON.parse(await readExportChunks(exportFile.chunks)) as Array<{
            amount: string
            payment_source: string | null
        }>

        expect(exportFile.contentType).toBe('application/json; charset=utf-8')
        expect(exportFile.contentDisposition).toMatch(
            /^attachment; filename="transactions-export-\d{4}-\d{2}-\d{2}\.json"$/,
        )
        expect(transactions).toHaveLength(501)
        expect(transactions[0]?.amount).toBe('10.00')
        expect(transactions[500]).toEqual(
            expect.objectContaining({
                amount: '25.00',
                payment_source: null,
            }),
        )
        expect(transactionsRepository.listTransactionsForExport).toHaveBeenNthCalledWith(1, {
            workspaceId: 'workspace-1',
            dateFrom: undefined,
            dateTo: undefined,
            limit: 500,
            offset: 0,
        })
        expect(transactionsRepository.listTransactionsForExport).toHaveBeenNthCalledWith(2, {
            workspaceId: 'workspace-1',
            dateFrom: undefined,
            dateTo: undefined,
            limit: 500,
            offset: 500,
        })
    })

    it('rejects invalid export query params before hitting the repository', async () => {
        await expect(
            service.exportTransactions(
                {
                    format: 'xml',
                    date_from: '2026-03-24',
                    date_to: '2026-03-23',
                },
                'workspace-1',
            ),
        ).rejects.toBeInstanceOf(BadRequestException)

        expect(transactionsRepository.listTransactionsForExport).not.toHaveBeenCalled()
    })
})

function createExportTransactionRecord(
    overrides: Partial<ExportTransactionRecord> = {},
): ExportTransactionRecord {
    return {
        date: new Date('2026-03-22T09:30:00.000Z'),
        amount: 4050,
        category: 'Food',
        notes: 'Lunch',
        tags: ['commute', 'food'],
        payment_source: 'Main Card',
        ...overrides,
    }
}

async function readExportChunks(chunks: AsyncIterable<string>): Promise<string> {
    let output = ''

    for await (const chunk of chunks) {
        output += chunk
    }

    return output
}
