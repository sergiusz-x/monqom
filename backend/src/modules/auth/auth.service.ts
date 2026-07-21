import {
    BadRequestException,
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common'
import { randomBytes } from 'crypto'
import * as argon2 from 'argon2'
import { User } from '@prisma/client'
import {
    validateEmailInput,
    validateLoginInput,
    validatePassword,
    validateRegistrationInput,
    validateResetPasswordInput,
    validateVerificationTokenInput,
} from '../../shared/utils/validation'
import { PrismaService } from '../../shared/database/prisma.service'
import { AuthRepository } from './auth.repository'
import { logger } from '../../shared/utils/logger'
import { WorkspaceService } from '../workspace/workspace.service'
import { normalizeCurrency } from '../../shared/currency/currency.service'
import { sendTransactionalEmail } from '../../shared/email/resend'

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000
const INVALID_EMAIL_VERIFICATION_TOKEN_MESSAGE = 'Verification token is invalid or expired'
const INVALID_PASSWORD_RESET_TOKEN_MESSAGE = 'Password reset token is invalid or expired'
const EMAIL_VERIFIED_SUCCESS_MESSAGE = 'Email verified successfully'
const EMAIL_VERIFICATION_SENT_MESSAGE = 'Verification email sent'
const PASSWORD_RESET_SENT_MESSAGE =
    'If an account with that email exists, a password reset link has been generated'
const PASSWORD_RESET_SUCCESS_MESSAGE = 'Password reset successfully'
const PASSWORD_CHANGE_SUCCESS_MESSAGE = 'Password changed successfully'
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password'
const EMAIL_NOT_VERIFIED_MESSAGE = 'Email address must be verified before logging in'
const ACCOUNT_LOCKOUT_MS = 15 * 60 * 1000
const MAX_FAILED_LOGIN_ATTEMPTS = 5

export interface RegisterCommand {
    email: string
    name: string
    password: string
    locale?: 'en' | 'pl'
    baseCurrency?: string
}

export interface VerifyEmailCommand {
    token: string
}

export interface LoginCommand {
    email: string
    password: string
}

export type LoginServiceResult =
    | {
          type: 'authenticated'
          user: AuthenticatedSessionUserResponse
      }
    | {
          type: 'two_factor_required'
          userId: string
          sessionVersion: number
      }

export interface ResendVerificationCommand {
    email: string
}

export interface ForgotPasswordCommand {
    email: string
}

export interface ResetPasswordCommand {
    token: string
    newPassword: string
}

export interface ChangePasswordCommand {
    currentPassword: string
    newPassword: string
}

export interface UpdateUserProfileCommand {
    name?: string
    locale?: 'en' | 'pl'
}

export interface AuthAuditEventInput {
    userId: string
    ipAddress?: string
}

export interface AuthActionResponse {
    message: string
}

export interface RegisteredUserResponse {
    id: string
    email: string
    name: string
    locale: string
    emailVerified: boolean
    totpEnabled: boolean
    createdAt: Date
    updatedAt: Date
}

export type AuthenticatedUserResponse = RegisteredUserResponse
export type AuthenticatedSessionUserResponse = AuthenticatedUserResponse & {
    sessionVersion: number
}

@Injectable()
export class AuthService {
    constructor(
        private readonly authRepository: AuthRepository,
        private readonly workspaceService: WorkspaceService,
        private readonly prisma: PrismaService,
    ) {}

    async register(input: RegisterCommand): Promise<RegisteredUserResponse> {
        const { email, name, password, errors } = validateRegistrationInput(input)

        if (errors.length > 0 || !email || !name || !password) {
            throw new BadRequestException(errors)
        }

        const locale = input.locale === undefined ? 'en' : input.locale
        if (locale !== 'en' && locale !== 'pl')
            throw new BadRequestException(['Locale must be one of: en, pl'])
        const baseCurrency = normalizeCurrency(
            input.baseCurrency ?? (locale === 'pl' ? 'PLN' : 'USD'),
        )

        const existingUser = await this.authRepository.findUserByEmail(email)

        if (existingUser) {
            throw new ConflictException({
                code: 'EMAIL_ALREADY_EXISTS',
                message: 'A user with this email already exists',
            })
        }

        const passwordHash = await argon2.hash(password, {
            type: argon2.argon2id,
        })

        const verificationTokenPayload = createTokenPayload(EMAIL_VERIFICATION_TOKEN_TTL_MS)

        try {
            const user = await this.prisma.$transaction(async (tx) => {
                const createdUser = await this.authRepository.createUserWithVerificationToken(
                    {
                        email,
                        name,
                        passwordHash,
                        verificationToken: verificationTokenPayload.token,
                        verificationTokenExpiresAt: verificationTokenPayload.expiresAt,
                        ...(input.locale !== undefined ? { locale } : {}),
                    },
                    tx,
                )

                if (input.baseCurrency !== undefined || input.locale !== undefined) {
                    await this.workspaceService.createPersonalWorkspace(
                        createdUser.id,
                        createdUser.name,
                        tx,
                        baseCurrency,
                    )
                } else {
                    await this.workspaceService.createPersonalWorkspace(
                        createdUser.id,
                        createdUser.name,
                        tx,
                    )
                }

                return createdUser
            })

            await deliverVerificationEmail(user.email, verificationTokenPayload.token)
            exposeVerificationToken('registration', verificationTokenPayload.token)

            return mapRegisteredUser(user)
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                throw new ConflictException({
                    code: 'EMAIL_ALREADY_EXISTS',
                    message: 'A user with this email already exists',
                })
            }

            throw error
        }
    }

    async verifyEmail(input: VerifyEmailCommand): Promise<AuthActionResponse> {
        const { token, errors } = validateVerificationTokenInput(input)

        if (errors.length > 0 || !token) {
            throw new BadRequestException(errors)
        }

        const now = new Date()
        const storedToken = await this.authRepository.findEmailVerificationTokenWithUser(token)

        if (
            !storedToken ||
            storedToken.usedAt !== null ||
            storedToken.user.emailVerified ||
            storedToken.expiresAt.getTime() <= now.getTime()
        ) {
            throw new BadRequestException({
                code: 'INVALID_EMAIL_VERIFICATION_TOKEN',
                message: INVALID_EMAIL_VERIFICATION_TOKEN_MESSAGE,
            })
        }

        const wasVerified = await this.authRepository.consumeVerificationTokensAndMarkEmailVerified(
            {
                userId: storedToken.userId,
                verifiedAt: now,
            },
        )

        if (!wasVerified) {
            throw new BadRequestException({
                code: 'INVALID_EMAIL_VERIFICATION_TOKEN',
                message: INVALID_EMAIL_VERIFICATION_TOKEN_MESSAGE,
            })
        }

        return {
            message: EMAIL_VERIFIED_SUCCESS_MESSAGE,
        }
    }

    async login(input: LoginCommand): Promise<LoginServiceResult> {
        const { email, password, errors } = validateLoginInput(input)

        if (errors.length > 0 || !email || !password) {
            throw new BadRequestException(errors)
        }

        const user = await this.authRepository.findUserByEmail(email)

        if (!user) {
            throw new UnauthorizedException({
                code: 'INVALID_CREDENTIALS',
                message: INVALID_CREDENTIALS_MESSAGE,
            })
        }
        if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
            throw new UnauthorizedException({
                code: 'ACCOUNT_TEMPORARILY_LOCKED',
                message: INVALID_CREDENTIALS_MESSAGE,
            })
        }

        const isPasswordValid = await argon2.verify(user.passwordHash, password)

        if (!isPasswordValid) {
            const failedLoginCount =
                typeof user.failedLoginCount === 'number' ? user.failedLoginCount + 1 : 1
            const lockedUntil =
                failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS
                    ? new Date(Date.now() + ACCOUNT_LOCKOUT_MS)
                    : null
            if (typeof user.failedLoginCount === 'number' || user.lockedUntil) {
                await this.authRepository.recordFailedLoginAttempt?.({
                    userId: user.id,
                    failedLoginCount: lockedUntil ? 0 : failedLoginCount,
                    lockedUntil,
                })
            }
            throw new UnauthorizedException({
                code: 'INVALID_CREDENTIALS',
                message: INVALID_CREDENTIALS_MESSAGE,
            })
        }
        if (typeof user.failedLoginCount === 'number' || user.lockedUntil) {
            await this.authRepository.clearFailedLoginAttempts?.(user.id)
        }

        if (!user.emailVerified) {
            throw new UnauthorizedException({
                code: 'EMAIL_NOT_VERIFIED',
                message: EMAIL_NOT_VERIFIED_MESSAGE,
            })
        }

        if (user.totpEnabled) {
            return {
                type: 'two_factor_required',
                userId: user.id,
                sessionVersion: user.sessionVersion,
            }
        }

        return {
            type: 'authenticated',
            user: mapAuthenticatedSessionUser(user),
        }
    }

    async getAuthenticatedUser(userId: string): Promise<AuthenticatedUserResponse> {
        const user = await this.authRepository.findUserById(userId)

        if (!user) {
            throw new UnauthorizedException('Authentication required')
        }

        return mapRegisteredUser(user)
    }

    async updateAuthenticatedUser(
        userId: string,
        input: UpdateUserProfileCommand,
    ): Promise<AuthenticatedUserResponse> {
        const { name, locale, errors } = validateUserProfileInput(input)

        if (errors.length > 0 || (!name && !locale)) {
            throw new BadRequestException(errors)
        }

        await this.getAuthenticatedUser(userId)

        const user = await this.authRepository.updateUserProfile({
            userId,
            name,
            ...(locale !== undefined ? { locale } : {}),
        })

        return mapRegisteredUser(user)
    }

    async recordSuccessfulLogin(input: AuthAuditEventInput): Promise<void> {
        await this.authRepository.createUserAuditEvent({
            action: 'USER_LOGGED_IN',
            userId: input.userId,
            metadata: createSessionAuditMetadata(input.ipAddress),
        })
    }

    async recordSuccessfulLogout(input: AuthAuditEventInput): Promise<void> {
        await this.authRepository.createUserAuditEvent({
            action: 'USER_LOGGED_OUT',
            userId: input.userId,
            metadata: createSessionAuditMetadata(input.ipAddress),
        })
    }

    async resendVerification(input: ResendVerificationCommand): Promise<AuthActionResponse> {
        const { email, errors } = validateEmailInput(input)

        if (errors.length > 0 || !email) {
            throw new BadRequestException(errors)
        }

        const user = await this.authRepository.findUserByEmail(email)

        if (!user || user.emailVerified) {
            return {
                message: EMAIL_VERIFICATION_SENT_MESSAGE,
            }
        }

        const verificationTokenPayload = createTokenPayload(EMAIL_VERIFICATION_TOKEN_TTL_MS)

        await this.authRepository.createVerificationTokenForUser({
            userId: user.id,
            verificationToken: verificationTokenPayload.token,
            verificationTokenExpiresAt: verificationTokenPayload.expiresAt,
        })

        await deliverVerificationEmail(user.email, verificationTokenPayload.token)
        exposeVerificationToken('resend', verificationTokenPayload.token)

        return {
            message: EMAIL_VERIFICATION_SENT_MESSAGE,
        }
    }

    async forgotPassword(input: ForgotPasswordCommand): Promise<AuthActionResponse> {
        const { email, errors } = validateEmailInput(input)

        if (errors.length > 0 || !email) {
            throw new BadRequestException(errors)
        }

        const user = await this.authRepository.findUserByEmail(email)

        if (!user) {
            return {
                message: PASSWORD_RESET_SENT_MESSAGE,
            }
        }

        const passwordResetTokenPayload = createTokenPayload(PASSWORD_RESET_TOKEN_TTL_MS)

        await this.authRepository.createPasswordResetTokenForUser({
            userId: user.id,
            passwordResetToken: passwordResetTokenPayload.token,
            passwordResetTokenExpiresAt: passwordResetTokenPayload.expiresAt,
        })

        await deliverPasswordResetEmail(user.email, passwordResetTokenPayload.token)
        exposePasswordResetToken(passwordResetTokenPayload.token)

        return {
            message: PASSWORD_RESET_SENT_MESSAGE,
        }
    }

    async resetPassword(input: ResetPasswordCommand): Promise<AuthActionResponse> {
        const { token, newPassword, errors } = validateResetPasswordInput(input)

        if (errors.length > 0 || !token || !newPassword) {
            throw new BadRequestException(errors)
        }

        const now = new Date()
        const storedToken = await this.authRepository.findPasswordResetTokenWithUser(token)

        if (
            !storedToken ||
            storedToken.usedAt !== null ||
            storedToken.expiresAt.getTime() <= now.getTime()
        ) {
            throw new BadRequestException({
                code: 'INVALID_PASSWORD_RESET_TOKEN',
                message: INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
            })
        }

        const passwordHash = await argon2.hash(newPassword, {
            type: argon2.argon2id,
        })

        const wasReset = await this.authRepository.resetPasswordWithToken({
            tokenId: storedToken.id,
            userId: storedToken.userId,
            passwordHash,
            resetAt: now,
        })

        if (!wasReset) {
            throw new BadRequestException({
                code: 'INVALID_PASSWORD_RESET_TOKEN',
                message: INVALID_PASSWORD_RESET_TOKEN_MESSAGE,
            })
        }

        return {
            message: PASSWORD_RESET_SUCCESS_MESSAGE,
        }
    }

    async changePassword(
        userId: string,
        input: ChangePasswordCommand,
    ): Promise<AuthActionResponse> {
        const { currentPassword, newPassword, errors } = validateChangePasswordInput(input)

        if (errors.length > 0 || !currentPassword || !newPassword) {
            throw new BadRequestException(errors)
        }

        const user = await this.authRepository.findUserById(userId)

        if (!user) {
            throw new UnauthorizedException('Authentication required')
        }

        const isCurrentPasswordValid = await argon2.verify(user.passwordHash, currentPassword)

        if (!isCurrentPasswordValid) {
            throw new UnauthorizedException('Current password is incorrect')
        }

        const passwordHash = await argon2.hash(newPassword, {
            type: argon2.argon2id,
        })

        await this.authRepository.changePassword({
            userId,
            passwordHash,
        })

        return {
            message: PASSWORD_CHANGE_SUCCESS_MESSAGE,
        }
    }

    async deleteAuthenticatedUser(userId: string): Promise<AuthActionResponse> {
        await this.getAuthenticatedUser(userId)
        await this.authRepository.deleteUserAccount(userId)

        return {
            message: 'Account deleted successfully',
        }
    }
}

function createTokenPayload(ttlMs: number): {
    token: string
    expiresAt: Date
} {
    return {
        token: randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + ttlMs),
    }
}

function exposeVerificationToken(
    reason: 'registration' | 'resend',
    verificationToken: string,
): void {
    const verificationUrl = buildEmailVerificationUrl(verificationToken)

    exposeSensitiveToken({
        message: `Email verification token generated for ${reason}`,
        fullTokenKey: 'verification_token',
        maskedTokenKey: 'verification_token_last6',
        token: verificationToken,
        developmentMetadata: {
            verification_url: verificationUrl,
        },
    })
}

function exposePasswordResetToken(passwordResetToken: string): void {
    exposeSensitiveToken({
        message: 'Password reset token generated for forgot-password',
        fullTokenKey: 'password_reset_token',
        maskedTokenKey: 'password_reset_token_last6',
        token: passwordResetToken,
    })
}

function exposeSensitiveToken(input: {
    message: string
    fullTokenKey: string
    maskedTokenKey: string
    token: string
    developmentMetadata?: Record<string, string>
}): void {
    const shouldLogFullToken = process.env.NODE_ENV === 'development'

    if (shouldLogFullToken) {
        logger.info(input.message, {
            context_name: AuthService.name,
            [input.fullTokenKey]: input.token,
            ...input.developmentMetadata,
        })

        return
    }

    logger.info(input.message, {
        context_name: AuthService.name,
        [input.maskedTokenKey]: input.token.slice(-6),
    })
}

function buildEmailVerificationUrl(token: string): string {
    const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')

    return `${normalizedBaseUrl}/verify-email?token=${encodeURIComponent(token)}`
}

function buildPasswordResetUrl(token: string): string {
    const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
    return baseUrl.replace(/\/+$/, '') + '/reset-password?token=' + encodeURIComponent(token)
}

async function deliverVerificationEmail(email: string, token: string): Promise<void> {
    const url = buildEmailVerificationUrl(token)
    await sendTransactionalEmail({
        to: email,
        subject: 'Verify your Monqom email address',
        html:
            '<p>Verify your email address to activate Monqom.</p><p><a href="' +
            url +
            '">Verify email</a></p>',
    })
}

async function deliverPasswordResetEmail(email: string, token: string): Promise<void> {
    const url = buildPasswordResetUrl(token)
    await sendTransactionalEmail({
        to: email,
        subject: 'Reset your Monqom password',
        html:
            '<p>Use this link to reset your password.</p><p><a href="' +
            url +
            '">Reset password</a></p>',
    })
}

function mapRegisteredUser(user: User): RegisteredUserResponse {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        locale: user.locale,
        emailVerified: user.emailVerified,
        totpEnabled: user.totpEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    }
}

function validateChangePasswordInput(input: ChangePasswordCommand): {
    currentPassword?: string
    newPassword?: string
    errors: string[]
} {
    const errors: string[] = []
    let currentPassword: string | undefined
    let newPassword: string | undefined

    if (input.currentPassword.length === 0) {
        errors.push('Current password is required')
    } else {
        currentPassword = input.currentPassword
    }

    if (input.newPassword.length === 0) {
        errors.push('New password is required')
    } else {
        newPassword = input.newPassword
        errors.push(...validatePassword(newPassword))
    }

    return { currentPassword, newPassword, errors }
}

function validateUserProfileInput(input: UpdateUserProfileCommand): {
    name?: string
    locale?: 'en' | 'pl'
    errors: string[]
} {
    const errors: string[] = []
    let name: string | undefined
    let locale: 'en' | 'pl' | undefined

    if (input.name !== undefined) {
        name = input.name.trim()
        if (name.length === 0) errors.push('Name is required')
        else if (name.length < 2) errors.push('Name must be at least 2 characters long')
        if (name.length > 100) errors.push('Name must be 100 characters or fewer')
    }
    if (input.locale !== undefined) {
        locale = input.locale
    }

    return { name, locale, errors }
}

function mapAuthenticatedSessionUser(user: User): AuthenticatedSessionUserResponse {
    return {
        ...mapRegisteredUser(user),
        sessionVersion: user.sessionVersion,
    }
}

function isUniqueConstraintError(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
    )
}

function createSessionAuditMetadata(ipAddress?: string): Record<string, string> {
    return {
        auth_strategy: 'SESSION_COOKIE',
        ...(ipAddress ? { ip_address: ipAddress } : {}),
    }
}
