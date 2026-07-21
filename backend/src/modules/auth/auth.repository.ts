import { Injectable } from '@nestjs/common'
import {
    EmailVerificationToken,
    PasswordResetToken,
    Prisma,
    TwoFactorRecoveryCode,
    User,
} from '@prisma/client'
import { AuditService } from '../../shared/audit/audit.service'
import {
    AUDIT_ACTIONS,
    AUDIT_ENTITY_TYPES,
    AuditAction,
    AuditMetadata,
} from '../../shared/audit/audit.types'
import { PrismaService } from '../../shared/database/prisma.service'

const POSTGRES_UNDEFINED_TABLE_ERROR_CODE = '42P01'

export interface CreateUserWithVerificationTokenInput {
    email: string
    name: string
    passwordHash: string
    verificationToken: string
    verificationTokenExpiresAt: Date
    locale?: string
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
    action: AuditAction
    userId: string
    metadata?: AuditMetadata
}

export interface UpdateUserProfileInput {
    userId: string
    name?: string
    locale?: string
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

export interface ChangePasswordInput {
    userId: string
    passwordHash: string
}
export interface FailedLoginAttemptInput {
    userId: string
    failedLoginCount: number
    lockedUntil: Date | null
}

export interface ReplaceTwoFactorSetupSecretInput {
    userId: string
    encryptedSecret: string
}

export interface EnableTwoFactorForUserInput {
    userId: string
    recoveryCodeHashes: string[]
}

export interface ConsumeRecoveryCodeInput {
    recoveryCodeId: string
    userId: string
    usedAt: Date
}

export type EmailVerificationTokenWithUser = EmailVerificationToken & {
    user: User
}

export type PasswordResetTokenWithUser = PasswordResetToken & {
    user: User
}

export type RecoveryCodeRecord = TwoFactorRecoveryCode

export type AuthPersistenceClient = Prisma.TransactionClient | PrismaService

@Injectable()
export class AuthRepository {
    constructor(
        private readonly prisma: PrismaService,
        private readonly auditService: AuditService,
    ) {}

    async findUserByEmail(email: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { email } })
    }

    async findUserById(id: string): Promise<User | null> {
        return this.prisma.user.findUnique({ where: { id } })
    }

    async recordFailedLoginAttempt(input: FailedLoginAttemptInput): Promise<void> {
        await this.prisma.user.update({
            where: { id: input.userId },
            data: { failedLoginCount: input.failedLoginCount, lockedUntil: input.lockedUntil },
        })
    }

    async clearFailedLoginAttempts(userId: string): Promise<void> {
        await this.prisma.user.update({
            where: { id: userId },
            data: { failedLoginCount: 0, lockedUntil: null },
        })
    }

    async updateUserProfile(input: UpdateUserProfileInput): Promise<User> {
        return this.prisma.user.update({
            where: { id: input.userId },
            data: {
                name: input.name,
                locale: input.locale,
            },
        })
    }

    async createUserWithVerificationToken(
        input: CreateUserWithVerificationTokenInput,
        prisma: AuthPersistenceClient = this.prisma,
    ): Promise<User> {
        const createUser = async (tx: AuthPersistenceClient): Promise<User> => {
            const user = await tx.user.create({
                data: {
                    email: input.email,
                    name: input.name,
                    locale: input.locale,
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

            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.USER_REGISTERED,
                    userId: user.id,
                    entityType: AUDIT_ENTITY_TYPES.USER,
                    entityId: user.id,
                    metadata: {
                        email: user.email,
                    },
                },
                tx,
            )

            return user
        }

        if (prisma === this.prisma) {
            return this.prisma.$transaction((tx: Prisma.TransactionClient) => createUser(tx))
        }

        return createUser(prisma)
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

            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.USER_EMAIL_VERIFIED,
                    userId: input.userId,
                    entityType: AUDIT_ENTITY_TYPES.USER,
                    entityId: input.userId,
                    metadata: {
                        source: 'EMAIL_VERIFICATION_TOKEN',
                    },
                },
                tx,
            )

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

            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.USER_EMAIL_VERIFICATION_RESENT,
                    userId: input.userId,
                    entityType: AUDIT_ENTITY_TYPES.USER,
                    entityId: input.userId,
                    metadata: {
                        source: 'EMAIL_VERIFICATION_RESEND',
                    },
                },
                tx,
            )
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

            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
                    userId: input.userId,
                    entityType: AUDIT_ENTITY_TYPES.USER,
                    entityId: input.userId,
                    metadata: {
                        source: 'PASSWORD_RESET_TOKEN',
                    },
                },
                tx,
            )

            return true
        })
    }

    async changePassword(input: ChangePasswordInput): Promise<void> {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.user.update({
                where: { id: input.userId },
                data: {
                    passwordHash: input.passwordHash,
                    sessionVersion: {
                        increment: 1,
                    },
                },
            })

            await deleteUserSessions(tx, input.userId)

            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.USER_PASSWORD_CHANGED,
                    userId: input.userId,
                    entityType: AUDIT_ENTITY_TYPES.USER,
                    entityId: input.userId,
                    metadata: {
                        source: 'SETTINGS_SECURITY',
                    },
                },
                tx,
            )
        })
    }

    async deleteUserAccount(userId: string): Promise<void> {
        await this.prisma.$transaction(
            async (tx: Prisma.TransactionClient) => {
                const memberships = await tx.workspaceMembership.findMany({
                    where: { userId },
                    select: { workspaceId: true, role: true },
                })

                for (const membership of memberships) {
                    const remainingMemberships = await tx.workspaceMembership.findMany({
                        where: {
                            workspaceId: membership.workspaceId,
                            userId: { not: userId },
                        },
                        select: { id: true, role: true },
                        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                    })

                    if (remainingMemberships.length === 0) {
                        await tx.workspace.delete({
                            where: { id: membership.workspaceId },
                        })
                        continue
                    }

                    const hasRemainingOwner = remainingMemberships.some(
                        (remainingMembership) => remainingMembership.role === 'owner',
                    )

                    if (membership.role === 'owner' && !hasRemainingOwner) {
                        const successor =
                            remainingMemberships.find(
                                (remainingMembership) => remainingMembership.role === 'admin',
                            ) ?? remainingMemberships[0]

                        await tx.workspaceMembership.update({
                            where: { id: successor.id },
                            data: { role: 'owner' },
                        })
                    }
                }

                await this.auditService.record(
                    {
                        action: AUDIT_ACTIONS.USER_DELETED,
                        userId,
                        entityType: AUDIT_ENTITY_TYPES.USER,
                        entityId: userId,
                        metadata: {
                            source: 'SETTINGS_DATA',
                        },
                    },
                    tx,
                )

                await deleteUserSessions(tx, userId)
                await tx.user.delete({ where: { id: userId } })
            },
            {
                isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            },
        )
    }

    async replaceTwoFactorSetupSecret(input: ReplaceTwoFactorSetupSecretInput): Promise<void> {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.twoFactorRecoveryCode.deleteMany({
                where: {
                    userId: input.userId,
                },
            })

            await tx.user.update({
                where: { id: input.userId },
                data: {
                    totpEnabled: false,
                    totpSecretEncrypted: input.encryptedSecret,
                },
            })
        })
    }

    async enableTwoFactorForUser(input: EnableTwoFactorForUserInput): Promise<void> {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.twoFactorRecoveryCode.deleteMany({
                where: {
                    userId: input.userId,
                },
            })

            await tx.user.update({
                where: { id: input.userId },
                data: {
                    totpEnabled: true,
                },
            })

            if (input.recoveryCodeHashes.length > 0) {
                await tx.twoFactorRecoveryCode.createMany({
                    data: input.recoveryCodeHashes.map((codeHash) => ({
                        userId: input.userId,
                        codeHash,
                    })),
                })
            }

            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.USER_2FA_ENABLED,
                    userId: input.userId,
                    entityType: AUDIT_ENTITY_TYPES.USER,
                    entityId: input.userId,
                    metadata: {
                        method: 'TOTP',
                    },
                },
                tx,
            )
        })
    }

    async listUnusedRecoveryCodes(userId: string): Promise<RecoveryCodeRecord[]> {
        return this.prisma.twoFactorRecoveryCode.findMany({
            where: {
                userId,
                usedAt: null,
            },
        })
    }

    async consumeRecoveryCode(input: ConsumeRecoveryCodeInput): Promise<boolean> {
        const result = await this.prisma.twoFactorRecoveryCode.updateMany({
            where: {
                id: input.recoveryCodeId,
                userId: input.userId,
                usedAt: null,
            },
            data: {
                usedAt: input.usedAt,
            },
        })

        return result.count > 0
    }

    async disableTwoFactorForUser(userId: string): Promise<void> {
        await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            await tx.twoFactorRecoveryCode.deleteMany({
                where: {
                    userId,
                },
            })

            await tx.user.update({
                where: { id: userId },
                data: {
                    totpEnabled: false,
                    totpSecretEncrypted: null,
                },
            })

            await this.auditService.record(
                {
                    action: AUDIT_ACTIONS.USER_2FA_DISABLED,
                    userId,
                    entityType: AUDIT_ENTITY_TYPES.USER,
                    entityId: userId,
                    metadata: {
                        method: 'TOTP',
                    },
                },
                tx,
            )
        })
    }

    async createUserAuditEvent(input: CreateUserAuditEventInput): Promise<void> {
        await this.auditService.record({
            action: input.action,
            userId: input.userId,
            entityType: AUDIT_ENTITY_TYPES.USER,
            entityId: input.userId,
            metadata: input.metadata,
        })
    }
}

async function deleteUserSessions(tx: Prisma.TransactionClient, userId: string): Promise<void> {
    try {
        await tx.$executeRaw`
            DELETE FROM "user_sessions"
            WHERE sess -> 'auth' ->> 'userId' = ${userId}
        `
    } catch (error) {
        if (!isMissingSessionStoreTableError(error)) {
            throw error
        }
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
