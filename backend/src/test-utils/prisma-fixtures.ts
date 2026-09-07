import { Prisma, type Transaction, type User } from '@prisma/client'

/** Read a mock argument while failing clearly when the expected call was not made. */
export function getMockCallArgument<T>(
    mock: { mock: { calls: ReadonlyArray<ReadonlyArray<unknown>> } },
    callIndex = 0,
    argumentIndex = 0,
): T {
    const call = mock.mock.calls[callIndex]
    const argument = call?.[argumentIndex]

    if (argument === undefined) {
        throw new Error(`Expected mock call ${callIndex + 1} argument ${argumentIndex + 1}`)
    }

    return argument as T
}

/** Read an expected test value from an array without hiding a missing fixture. */
export function getRequiredArrayItem<T>(items: readonly T[], index: number): T {
    const item = items[index]
    if (item === undefined) throw new Error(`Expected array item at index ${index}`)
    return item
}

export function createUserFixture(overrides: Partial<User> = {}): User {
    return {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Ada Lovelace',
        locale: 'en',
        hideSalaryAmounts: false,
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
    } as User
}

export function createTransactionFixture(overrides: Partial<Transaction> = {}): Transaction {
    const date = new Date('2026-03-23T00:00:00.000Z')

    return {
        id: 'transaction-1',
        workspaceId: 'workspace-1',
        categoryId: 'category-1',
        paymentSourceId: 'payment-source-1',
        integrationId: null,
        externalId: null,
        version: 1,
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
