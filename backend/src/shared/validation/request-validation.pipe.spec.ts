import 'reflect-metadata'
import { RegisterDto } from '../../modules/auth/auth.dto'
import { TransactionBodyDto } from '../../modules/transactions/transactions.dto'
import { createRequestValidationPipe } from './request-validation.pipe'

describe('request ValidationPipe', () => {
    const pipe = createRequestValidationPipe()

    it('transforms and accepts a valid DTO', async () => {
        const result = await pipe.transform(
            {
                email: 'alice@example.com',
                name: 'Alice',
                password: 'secure-password',
                locale: 'pl',
                base_currency: 'PLN',
            },
            { type: 'body', metatype: RegisterDto },
        )

        expect(result).toBeInstanceOf(RegisterDto)
    })

    it('rejects invalid values and unknown fields at the HTTP boundary', async () => {
        await expect(
            pipe.transform(
                {
                    email: 'not-an-email',
                    name: '',
                    password: 'short',
                    admin: true,
                },
                { type: 'body', metatype: RegisterDto },
            ),
        ).rejects.toMatchObject({ status: 400 })
    })

    it('rejects structurally invalid financial input before the service layer', async () => {
        await expect(
            pipe.transform(
                {
                    amount: 10.999,
                    date: 'not-a-date',
                    category_id: 'category-1',
                    payment_source_id: 'cash-1',
                    tags: ['valid', 123],
                },
                { type: 'body', metatype: TransactionBodyDto },
            ),
        ).rejects.toMatchObject({ status: 400 })

        await expect(
            pipe.transform(
                {
                    amount: 10.5,
                    date: '2026-03-23',
                    description: 'Lunch',
                    category_id: 'category-1',
                    payment_source_id: 'cash-1',
                    notes: 123,
                },
                { type: 'body', metatype: TransactionBodyDto },
            ),
        ).rejects.toMatchObject({ status: 400 })
    })
})
