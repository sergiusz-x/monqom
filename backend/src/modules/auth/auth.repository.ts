import { Injectable } from '@nestjs/common'
import { EmailVerificationToken, PasswordResetToken, Prisma, User } from '@prisma/client'
import { PrismaService } from '../../shared/database/prisma.service'

const POSTGRES_UNDEFINED_TABLE_ERROR_CODE = '42P01'

export interface CreateUserWithVerificationTokenInput {
    email: string
    name: string
    passwordHash: string
    verificationToken: string
    verificationTokenExpiresAt: Date
}

export interface CreateVerificationTokenForUserInput {
    userId: string
    verificationToken: string
    verificationTokenExpiresAt: Date
}

export interface CreatePasswordResetTokenForUserInput {
    userId: string
    passwordResetToken: string
    passwordResetTokenExpiresAt: Date
}

export interface CreateUserAuditEventInput {
    action: string
    userId: string
    metadata?: Record<string, string>
}

export interface ConsumeVerificationTokensAndMarkEmailVerifiedInput {
    userId: string
    verifiedAt: Date
}

export interface ResetPasswordWithTokenInput {
    tokenId: string
    userId: string
    passwordHash: string
    resetAt: Date
}

export type EmailVerificationTokenWithUser = EmailVerificationToken & {
    user: User
}

export type PasswordResetTokenWithUser = PasswordResetToken & {
    user: User
}

@Injectable()
export class AuthRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findUserByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { email } })
    }

    async findUserById(id: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { id } })
    }

    async createUserWithVerificationToken(
        input: CreateUserWithVerificationTokenInput,
    ): Promise<User> {
        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const user = await tx.user.create({
                data: {
                    email: input.email,
                    name: input.name,
                    passwordHash: input.passwordHash,
                    emailVerified: false,
                },
            })

            await tx.emailVerificationToken.create({
                data: {
                    userId: user.id,
                    token: input.verificationToken,
                    expiresAt: input.verificationTokenExpiresAt,
                },
            })

            await tx.auditEvent.create({
                data: {
                    action: 'USER_REGISTERED',
                    userId: user.id,
                    entityType: 'USER',
                    entityId: user.id,
                    metadata: {
                        email: user.email,
                    },
                },
            })

            return user
        })
    }

    async findEmailVerificationTokenWithUser(
        token: string,
    ): Promise<EmailVerificationTokenWithUser | null> {
        return this.prisma.emailVerificationToken.findUnique({
            where: { token },
            include: { user: true },
        })
    }

    async consumeVerificationTokensAndMarkEmailVerified(
        input: ConsumeVerificationTokensAndMarkEmailVerifiedInput,
    ): Promise<boolean> {
        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const consumedTokens = await tx.emailVerificationToken.updateMany({
                where: {
                    userId: input.userId,
                    usedAt: null,
                },
                data: {
                    usedAt: input.verifiedAt,
                },
            })

            if (consumedTokens.count === 0) {
                return false
            }

            await tx.user.update({
                where: { id: input.userId },
                data: {
                    emailVerified: true,
                },
            })

            await tx.auditEvent.create({
                data: {
                    action: 'USER_EMAIL_VERIFIED',
                    userId: input.userId,
                    entityType: 'USER',
                    entityId: input.userId,
                    metadata: {
                        source: 'EMAIL_VERIFICATION_TOKEN',
                    },
                },
            })

            return true
        })
    }

    async createVerificationTokenForUser(
        input: CreateVerificationTokenForUserInput,
    ): Promise<void> {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.emailVerificationToken.create({
                data: {
                    userId: input.userId,
                    token: input.verificationToken,
                    expiresAt: input.verificationTokenExpiresAt,
                },
            })

            await tx.auditEvent.create({
                data: {
                    action: 'USER_EMAIL_VERIFICATION_RESENT',
                    userId: input.userId,
                    entityType: 'USER',
                    entityId: input.userId,
                    metadata: {
                        source: 'EMAIL_VERIFICATION_RESEND',
                    },
                },
            })
        })
    }

    async createPasswordResetTokenForUser(
        input: CreatePasswordResetTokenForUserInput,
    ): Promise<void> {
        await this.prisma.passwordResetToken.create({
            data: {
                userId: input.userId,
                token: input.passwordResetToken,
                expiresAt: input.passwordResetTokenExpiresAt,
            },
        })
    }

    async findPasswordResetTokenWithUser(
        token: string,
    ): Promise<PasswordResetTokenWithUser | null> {
        return this.prisma.passwordResetToken.findUnique({
            where: { token },
            include: { user: true },
        })
    }

    async resetPasswordWithToken(input: ResetPasswordWithTokenInput): Promise<boolean> {
        return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            const consumedToken = await tx.passwordResetToken.updateMany({
                where: {
                    id: input.tokenId,
                    userId: input.userId,
                    usedAt: null,
                    expiresAt: {
                        gt: input.resetAt,
                    },
                },
                data: {
                    usedAt: input.resetAt,
                },
            })

            if (consumedToken.count === 0) {
                return false
            }

            await tx.passwordResetToken.updateMany({
                where: {
                    userId: input.userId,
                    usedAt: null,
                },
                data: {
                    usedAt: input.resetAt,
                },
            })

            await tx.user.update({
                where: { id: input.userId },
                data: {
                    passwordHash: input.passwordHash,
                    sessionVersion: {
                        increment: 1,
                    },
                },
            })

            try {
                await tx.$executeRaw`
                    DELETE FROM "user_sessions"
                    WHERE sess -> 'auth' ->> 'userId' = ${input.userId}
                `
            } catch (error) {
                if (!isMissingSessionStoreTableError(error)) {
                    throw error
                }
            }

            await tx.auditEvent.create({
                data: {
                    action: 'USER_PASSWORD_RESET',
                    userId: input.userId,
                    entityType: 'USER',
                    entityId: input.userId,
                    metadata: {
                        source: 'PASSWORD_RESET_TOKEN',
                    },
                },
            })

            return true
        })
    }

    async createUserAuditEvent(input: CreateUserAuditEventInput): Promise<void> {
        await this.prisma.auditEvent.create({
            data: {
                action: input.action,
                userId: input.userId,
                entityType: 'USER',
                entityId: input.userId,
                metadata: input.metadata,
            },
        })
    }
}

function isMissingSessionStoreTableError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === POSTGRES_UNDEFINED_TABLE_ERROR_CODE
    )
}
