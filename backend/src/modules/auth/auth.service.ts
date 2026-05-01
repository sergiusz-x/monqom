import {
    BadRequestException,
    ConflictException,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common'
import { createHash, randomBytes } from 'crypto'
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

export interface RegisterRequestInput {
    email?: unknown
    name?: unknown
    password?: unknown
}

export interface VerifyEmailRequestInput {
    token?: unknown
}

export interface LoginRequestInput {
    email?: unknown
    password?: unknown
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

export interface ResendVerificationRequestInput {
    email?: unknown
}

export interface ForgotPasswordRequestInput {
    email?: unknown
}

export interface ResetPasswordRequestInput {
    token?: unknown
    newPassword?: unknown
}

export interface ChangePasswordRequestInput {
    currentPassword?: unknown
    newPassword?: unknown
}

export interface UpdateUserProfileRequestInput {
    name?: unknown
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

    async register(input: RegisterRequestInput): Promise<RegisteredUserResponse> {
        const { email, name, password, errors } = validateRegistrationInput(input)

        if (errors.length > 0 || !email || !name || !password) {
            throw new BadRequestException(errors)
        }

        const existingUser = await this.authRepository.findUserByEmail(email)

        if (existingUser) {
            throw new ConflictException('A user with this email already exists')
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
                    },
                    tx,
                )

                await this.workspaceService.createPersonalWorkspace(
                    createdUser.id,
                    createdUser.name,
                    tx,
                )

                return createdUser
            })

            exposeVerificationToken('registration', verificationTokenPayload.token)

            return mapRegisteredUser(user)
        } catch (error) {
            if (isUniqueConstraintError(error)) {
                throw new ConflictException('A user with this email already exists')
            }

            throw error
        }
    }

    async verifyEmail(input: VerifyEmailRequestInput): Promise<AuthActionResponse> {
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
            throw new BadRequestException(INVALID_EMAIL_VERIFICATION_TOKEN_MESSAGE)
        }

        const wasVerified = await this.authRepository.consumeVerificationTokensAndMarkEmailVerified(
            {
                userId: storedToken.userId,
                verifiedAt: now,
            },
        )

        if (!wasVerified) {
            throw new BadRequestException(INVALID_EMAIL_VERIFICATION_TOKEN_MESSAGE)
        }

        return {
            message: EMAIL_VERIFIED_SUCCESS_MESSAGE,
        }
    }

    async login(input: LoginRequestInput): Promise<LoginServiceResult> {
        const { email, password, errors } = validateLoginInput(input)

        if (errors.length > 0 || !email || !password) {
            throw new BadRequestException(errors)
        }

        const user = await this.authRepository.findUserByEmail(email)

        if (!user) {
            throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE)
        }

        const isPasswordValid = await argon2.verify(user.passwordHash, password)

        if (!isPasswordValid) {
            throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE)
        }

        if (!user.emailVerified) {
            throw new UnauthorizedException(EMAIL_NOT_VERIFIED_MESSAGE)
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
        input: UpdateUserProfileRequestInput,
    ): Promise<AuthenticatedUserResponse> {
        const { name, errors } = validateUserProfileInput(input)

        if (errors.length > 0 || !name) {
            throw new BadRequestException(errors)
        }

        await this.getAuthenticatedUser(userId)

        const user = await this.authRepository.updateUserProfile({
            userId,
            name,
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

    async resendVerification(input: ResendVerificationRequestInput): Promise<AuthActionResponse> {
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

        exposeVerificationToken('resend', verificationTokenPayload.token)

        return {
            message: EMAIL_VERIFICATION_SENT_MESSAGE,
        }
    }

    async forgotPassword(input: ForgotPasswordRequestInput): Promise<AuthActionResponse> {
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

        exposePasswordResetToken(passwordResetTokenPayload.token)

        return {
            message: PASSWORD_RESET_SENT_MESSAGE,
        }
    }

    async resetPassword(input: ResetPasswordRequestInput): Promise<AuthActionResponse> {
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
            throw new BadRequestException(INVALID_PASSWORD_RESET_TOKEN_MESSAGE)
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
            throw new BadRequestException(INVALID_PASSWORD_RESET_TOKEN_MESSAGE)
        }

        return {
            message: PASSWORD_RESET_SUCCESS_MESSAGE,
        }
    }

    async changePassword(
        userId: string,
        input: ChangePasswordRequestInput,
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
        fingerprintKey: 'verification_token_fingerprint',
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
        fingerprintKey: 'password_reset_token_fingerprint',
        token: passwordResetToken,
    })
}

function exposeSensitiveToken(input: {
    message: string
    fullTokenKey: string
    maskedTokenKey: string
    fingerprintKey: string
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
        [input.fingerprintKey]: createHash('sha256').update(input.token).digest('hex'),
    })
}

function buildEmailVerificationUrl(token: string): string {
    const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173'
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')

    return `${normalizedBaseUrl}/verify-email?token=${encodeURIComponent(token)}`
}

function mapRegisteredUser(user: User): RegisteredUserResponse {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        totpEnabled: user.totpEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    }
}

function validateChangePasswordInput(input: ChangePasswordRequestInput): {
    currentPassword?: string
    newPassword?: string
    errors: string[]
} {
    const errors: string[] = []
    let currentPassword: string | undefined
    let newPassword: string | undefined

    if (typeof input.currentPassword !== 'string' || input.currentPassword.length === 0) {
        errors.push('Current password is required')
    } else {
        currentPassword = input.currentPassword
    }

    if (typeof input.newPassword !== 'string' || input.newPassword.length === 0) {
        errors.push('New password is required')
    } else {
        newPassword = input.newPassword
        errors.push(...validatePassword(newPassword))
    }

    return { currentPassword, newPassword, errors }
}

function validateUserProfileInput(input: UpdateUserProfileRequestInput): {
    name?: string
    errors: string[]
} {
    const errors: string[] = []
    let name: string | undefined

    if (typeof input.name !== 'string' || input.name.trim().length === 0) {
        errors.push('Name is required')
    } else {
        name = input.name.trim()
        if (name.length < 2) {
            errors.push('Name must be at least 2 characters long')
        }
        if (name.length > 100) {
            errors.push('Name must be 100 characters or fewer')
        }
    }

    return { name, errors }
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
