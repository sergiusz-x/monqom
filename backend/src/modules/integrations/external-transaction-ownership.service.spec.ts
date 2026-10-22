import { BadRequestException } from '@nestjs/common'
import {
    ExternalTransactionCreateCommand,
    ExternalTransactionOwnershipService,
    fingerprintExternalTransactionCreate,
    fingerprintExternalTransactionUpdate,
    fingerprintExternalTransactionDelete,
    IDEMPOTENCY_RETENTION_MS,
} from './external-transaction-ownership.service'

describe('external transaction intent', () => {
    const command: ExternalTransactionCreateCommand = {
        externalId: 'account:record',
        type: 'expense',
        amount: 1234,
        currency: 'PLN',
        date: new Date('2026-09-04'),
        description: 'Coffee',
        notes: null,
        tags: ['daily', 'food'],
        categoryId: null,
        paymentSourceId: 'source',
    }

    it('normalizes defaults, whitespace, currency, and tag set ordering', () => {
        expect(
            fingerprintExternalTransactionCreate({
                ...command,
                externalId: ' account:record ',
                description: ' Coffee ',
                currency: 'pln',
                notes: ' ',
                categoryId: undefined,
                tags: ['FOOD', ' DAILY ', 'food'],
            }),
        ).toBe(fingerprintExternalTransactionCreate(command))
    })

    it('excludes all derived FX values from request identity', () => {
        expect(
            fingerprintExternalTransactionCreate({
                ...command,
                baseAmount: 9999,
                fxRate: 99,
                fxRateDate: new Date('2025-01-01'),
                fxSource: 'changed',
            }),
        ).toBe(fingerprintExternalTransactionCreate(command))
    })

    it('includes operation, precondition, target, and financial intent', () => {
        const original = fingerprintExternalTransactionCreate(command)
        expect(fingerprintExternalTransactionCreate({ ...command, amount: 999 })).not.toBe(original)
        expect(fingerprintExternalTransactionCreate({ ...command, tags: ['changed'] })).not.toBe(
            original,
        )
        expect(fingerprintExternalTransactionCreate({ ...command, externalId: 'other' })).not.toBe(
            original,
        )
        expect(fingerprintExternalTransactionUpdate(command, 1)).not.toBe(original)
        expect(fingerprintExternalTransactionUpdate(command, 2)).not.toBe(
            fingerprintExternalTransactionUpdate(command, 1),
        )
        expect(fingerprintExternalTransactionDelete('account:record', 1)).not.toBe(original)
    })

    it('allows missing external identity without making one up', () => {
        expect(fingerprintExternalTransactionCreate({ ...command, externalId: undefined })).toBe(
            fingerprintExternalTransactionCreate({ ...command, externalId: null }),
        )
    })

    it.each([
        { externalId: '' },
        { externalId: 'ą'.repeat(101) },
        { amount: 2_147_483_648 },
        { amount: 1.2 },
        { currency: 'XXX' },
        { categoryId: ' ' },
        { tags: ['x'.repeat(101)] },
        { description: ' ' },
        { date: new Date('invalid') },
        { date: new Date('2026-09-04T12:00:00Z') },
    ])('rejects invalid intent before acquiring database claims: %j', (invalid) => {
        expect(() => fingerprintExternalTransactionCreate({ ...command, ...invalid })).toThrow(
            BadRequestException,
        )
    })

    it('runs cleanup on startup and hourly, and releases its timer', async () => {
        jest.useFakeTimers()
        const now = new Date('2026-10-17T12:00:00Z')
        jest.setSystemTime(now)
        const deleteMany = jest.fn().mockResolvedValue({ count: 1 })
        const service = new ExternalTransactionOwnershipService(
            { integrationIdempotencyRecord: { deleteMany } } as never,
            {} as never,
            {} as never,
            {} as never,
        )
        try {
            service.onModuleInit()
            expect(deleteMany).toHaveBeenCalledWith({
                where: {
                    status: 'completed',
                    completedAt: { lte: new Date(now.getTime() - IDEMPOTENCY_RETENTION_MS) },
                    expiresAt: { lte: now },
                },
            })
            await jest.advanceTimersByTimeAsync(60 * 60 * 1000)
            expect(deleteMany).toHaveBeenCalledTimes(2)
            service.onModuleDestroy()
            await jest.advanceTimersByTimeAsync(60 * 60 * 1000)
            expect(deleteMany).toHaveBeenCalledTimes(2)
        } finally {
            service.onModuleDestroy()
            jest.useRealTimers()
        }
    })
})
