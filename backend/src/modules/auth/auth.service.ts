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
    validateRegistrationInput,
    validateVerificationTokenInput,
} from '../../shared/utils/validation'
import { AuthRepository } from './auth.repository'
import { logger } from '../../shared/utils/logger'

const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000
const INVALID_EMAIL_VERIFICATION_TOKEN_MESSAGE = 'Verification token is invalid or expired'
const EMAIL_VERIFIED_SUCCESS_MESSAGE = 'Email verified successfully'
const EMAIL_VERIFICATION_SENT_MESSAGE = 'Verification email sent'
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

export interface ResendVerificationRequestInput {
    email?: unknown
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
    createdAt: Date
    updatedAt: Date
}

export type AuthenticatedUserResponse = RegisteredUserResponse

@Injectable()
export class AuthService {
    constructor(private readonly authRepository: AuthRepository) {}

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

        const verificationTokenPayload = createEmailVerificationTokenPayload()

        try {
            const user = await this.authRepository.createUserWithVerificationToken({
                email,
                name,
                passwordHash,
                verificationToken: verificationTokenPayload.token,
                verificationTokenExpiresAt: verificationTokenPayload.expiresAt,
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

    async login(input: LoginRequestInput): Promise<AuthenticatedUserResponse> {
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

        return mapRegisteredUser(user)
    }

    async getAuthenticatedUser(userId: string): Promise<AuthenticatedUserResponse> {
        const user = await this.authRepository.findUserById(userId)

        if (!user) {
            throw new UnauthorizedException('Authentication required')
        }

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

        const verificationTokenPayload = createEmailVerificationTokenPayload()

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
}

function createEmailVerificationTokenPayload(): {
    token: string
    expiresAt: Date
} {
    return {
        token: randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
    }
}

function exposeVerificationToken(
    reason: 'registration' | 'resend',
    verificationToken: string,
): void {
    const message = `Email verification token generated for ${reason}`
    const shouldLogFullToken = process.env.NODE_ENV !== 'production'

    if (shouldLogFullToken) {
        logger.info(message, {
            context_name: AuthService.name,
            verification_token: verificationToken,
        })

        return
    }

    logger.info(message, {
        context_name: AuthService.name,
        verification_token_last6: verificationToken.slice(-6),
        verification_token_fingerprint: createHash('sha256')
            .update(verificationToken)
            .digest('hex'),
    })
}

function mapRegisteredUser(user: User): RegisteredUserResponse {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
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
