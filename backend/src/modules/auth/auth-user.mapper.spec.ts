import type { User } from '@prisma/client'
import { mapAuthenticatedSessionUser, mapRegisteredUser } from './auth-user.mapper'

function createUser(): User {
    const now = new Date('2026-09-05T12:00:00.000Z')

    return {
        id: 'user-1',
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        passwordHash: 'password-hash',
        locale: 'en',
        hideSalaryAmounts: true,
        emailVerified: true,
        totpEnabled: true,
        failedLoginCount: 0,
        lockedUntil: null,
        totpSecretEncrypted: null,
        sessionVersion: 3,
        createdAt: now,
        updatedAt: now,
    }
}

describe('auth user mapper', () => {
    it('maps public profile fields without password or two-factor secrets', () => {
        expect(mapRegisteredUser(createUser())).toEqual({
            id: 'user-1',
            email: 'ada@example.com',
            name: 'Ada Lovelace',
            locale: 'en',
            hideSalaryAmounts: true,
            emailVerified: true,
            totpEnabled: true,
            createdAt: new Date('2026-09-05T12:00:00.000Z'),
            updatedAt: new Date('2026-09-05T12:00:00.000Z'),
        })
    })

    it('adds the session version only for authenticated session responses', () => {
        expect(mapAuthenticatedSessionUser(createUser())).toMatchObject({ sessionVersion: 3 })
    })
})
