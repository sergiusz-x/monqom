import type { User } from '@prisma/client'
import type { AuthenticatedSessionUserResponse, RegisteredUserResponse } from './auth.service'

export function mapRegisteredUser(user: User): RegisteredUserResponse {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        locale: user.locale,
        hideSalaryAmounts: user.hideSalaryAmounts,
        emailVerified: user.emailVerified,
        totpEnabled: user.totpEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    }
}

export function mapAuthenticatedSessionUser(user: User): AuthenticatedSessionUserResponse {
    return {
        ...mapRegisteredUser(user),
        sessionVersion: user.sessionVersion,
    }
}
