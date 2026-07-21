import 'reflect-metadata'
import { BadRequestException } from '@nestjs/common'
import { BudgetBodyDto, ListBudgetsQueryDto } from '../../modules/budgets/budgets.dto'
import { CategoriesQueryDto } from '../../modules/categories/categories.dto'
import { ListTransactionsQueryDto } from '../../modules/transactions/transactions.dto'
import { ExportTransactionsQueryDto } from '../../modules/export/export.dto'
import { PaymentSourceBodyDto } from '../../modules/payment-sources/payment-sources.dto'
import { DashboardMonthQueryDto } from '../../modules/dashboard/dashboard.dto'
import { createRequestValidationPipe } from './request-validation.pipe'

describe('query DTO transformations', () => {
    const pipe = createRequestValidationPipe()

    it('transforms numeric query values and repeated/comma-separated arrays', async () => {
        const result = await pipe.transform(
            {
                category_ids: ['food,travel', 'bills'],
                limit: '25',
                offset: '5',
            },
            { type: 'query', metatype: ListTransactionsQueryDto },
        )

        expect(result).toEqual(
            expect.objectContaining({
                category_ids: ['food,travel', 'bills'],
                limit: 25,
                offset: 5,
            }),
        )

        const commaSeparated = await pipe.transform(
            { category_ids: 'food,travel' },
            { type: 'query', metatype: ListTransactionsQueryDto },
        )
        expect(commaSeparated.category_ids).toEqual(['food', 'travel'])
    })

    it('transforms boolean and budget query values', async () => {
        await expect(
            pipe.transform(
                { include_archived: 'true' },
                { type: 'query', metatype: CategoriesQueryDto },
            ),
        ).resolves.toEqual(expect.objectContaining({ include_archived: true }))

        await expect(
            pipe.transform(
                { year: '2026', month: '7' },
                { type: 'query', metatype: ListBudgetsQueryDto },
            ),
        ).resolves.toEqual(expect.objectContaining({ year: 2026, month: 7 }))
    })

    it('rejects unknown properties and invalid query types', async () => {
        await expect(
            pipe.transform(
                { year: '2026', month: '7', unexpected: 'value' },
                { type: 'query', metatype: ListBudgetsQueryDto },
            ),
        ).rejects.toBeInstanceOf(BadRequestException)

        await expect(
            pipe.transform(
                { limit: 'not-a-number' },
                { type: 'query', metatype: ListTransactionsQueryDto },
            ),
        ).rejects.toBeInstanceOf(BadRequestException)

        await expect(
            pipe.transform(
                { limit: '0', offset: '-1', sort_by: 'unsupported', tag: '' },
                { type: 'query', metatype: ListTransactionsQueryDto },
            ),
        ).rejects.toBeInstanceOf(BadRequestException)

        await expect(
            pipe.transform(
                { year: '1999', month: '13' },
                { type: 'query', metatype: ListBudgetsQueryDto },
            ),
        ).rejects.toBeInstanceOf(BadRequestException)

        await expect(
            pipe.transform(
                { format: 'xml' },
                { type: 'query', metatype: ExportTransactionsQueryDto },
            ),
        ).rejects.toBeInstanceOf(BadRequestException)

        await expect(
            pipe.transform({}, { type: 'query', metatype: DashboardMonthQueryDto }),
        ).rejects.toBeInstanceOf(BadRequestException)

        await expect(
            pipe.transform(
                { name: 'Card', type: 'crypto' },
                { type: 'body', metatype: PaymentSourceBodyDto },
            ),
        ).rejects.toBeInstanceOf(BadRequestException)
    })

    it('accepts representative financial input and rejects excessive precision', async () => {
        await expect(
            pipe.transform(
                { amount: 125.5, category_id: 'groceries', year: 2026, month: 7 },
                { type: 'body', metatype: BudgetBodyDto },
            ),
        ).resolves.toBeInstanceOf(BudgetBodyDto)

        await expect(
            pipe.transform(
                { amount: 125.555, category_id: 'groceries', year: 2026, month: 7 },
                { type: 'body', metatype: BudgetBodyDto },
            ),
        ).rejects.toBeInstanceOf(BadRequestException)
    })
})
