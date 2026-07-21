import { Prisma, type Transaction, type User } from '@prisma/client'

export function createUserFixture(overrides: Partial<User> = {}): User {
    return {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Ada Lovelace',
        locale: 'en',
        passwordHash: 'hash',
        emailVerified: false,
        sessionVersion: 0,
        failedLoginCount: 0,
        lockedUntil: null,
        totpEnabled: false,
        totpSecretEncrypted: null,
        createdAt: new Date('2026-03-22T10:00:00.000Z'),
        updatedAt: new Date('2026-03-22T10:00:00.000Z'),
        ...overrides,
    }
}

export function createTransactionFixture(overrides: Partial<Transaction> = {}): Transaction {
    const date = new Date('2026-03-23T00:00:00.000Z')

    return {
        id: 'transaction-1',
        workspaceId: 'workspace-1',
        categoryId: 'category-1',
        paymentSourceId: 'payment-source-1',
        type: 'expense',
        amount: 1050,
        currency: 'USD',
        baseAmount: 1050,
        fxRate: new Prisma.Decimal(1),
        fxRateDate: date,
        fxSource: 'legacy',
        date,
        description: 'Lunch',
        notes: null,
        createdAt: new Date('2026-03-23T12:00:00.000Z'),
        updatedAt: new Date('2026-03-23T12:00:00.000Z'),
        deletedAt: null,
        ...overrides,
    }
}
