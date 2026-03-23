import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common'
import * as argon2 from 'argon2'
import {
    createCipheriv,
    createDecipheriv,
    createHash,
    randomBytes,
    type CipherGCMTypes,
} from 'crypto'
import type { User } from '@prisma/client'
import * as QRCode from 'qrcode'
import * as speakeasy from 'speakeasy'
import { type RecoveryCodeRecord, AuthRepository } from './auth.repository'
import type { AuthActionResponse, AuthenticatedSessionUserResponse } from './auth.service'
import {
    validateCurrentPasswordInput,
    validateVerificationTokenInput,
} from '../../shared/utils/validation'

const TWO_FACTOR_ISSUER = 'Monqom'
const TWO_FACTOR_ENABLED_MESSAGE = 'Two-factor authentication enabled'
const TWO_FACTOR_DISABLED_MESSAGE = 'Two-factor authentication disabled'
const TWO_FACTOR_ALREADY_ENABLED_MESSAGE = 'Two-factor authentication is already enabled'
const TWO_FACTOR_NOT_ENABLED_MESSAGE = 'Two-factor authentication is not enabled'
const TWO_FACTOR_SETUP_MISSING_MESSAGE = 'Two-factor authentication setup has not been started'
const INVALID_TWO_FACTOR_TOKEN_MESSAGE = 'Two-factor authentication token is invalid'
const INVALID_TWO_FACTOR_CHALLENGE_MESSAGE = 'Two-factor authentication challenge is invalid'
const CURRENT_PASSWORD_INCORRECT_MESSAGE = 'Current password is incorrect'
const RECOVERY_CODE_COUNT = 8
const RECOVERY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const RECOVERY_CODE_SEGMENT_LENGTH = 4
const RECOVERY_CODE_SEGMENT_COUNT = 3
const ENCRYPTION_ALGORITHM: CipherGCMTypes = 'aes-256-gcm'
const ENCRYPTION_IV_BYTES = 12

export interface TwoFactorSetupResponse {
    secret: string
    otpauthUri: string
    qrCodeDataUrl: string
}

export interface TwoFactorTokenRequestInput {
    token?: unknown
}

export interface TwoFactorLoginChallengeInput {
    userId: string
    sessionVersion: number
}

export interface TwoFactorVerifySetupResponse extends AuthActionResponse {
    recoveryCodes: string[]
}

export type TwoFactorLoginVerificationResponse = AuthenticatedSessionUserResponse & {
    recoveryCodeUsed: boolean
}

@Injectable()
export class TwoFactorService {
    constructor(private readonly authRepository: AuthRepository) {}

    async setup(userId: string): Promise<TwoFactorSetupResponse> {
        const user = await this.authRepository.findUserById(userId)

        if (!user) {
            throw new UnauthorizedException('Authentication required')
        }

        if (user.totpEnabled) {
            throw new BadRequestException(TWO_FACTOR_ALREADY_ENABLED_MESSAGE)
        }

        const generatedSecret = speakeasy.generateSecret({
            length: 20,
        })
        const secret = generatedSecret.base32
        const otpauthUri = secret
            ? speakeasy.otpauthURL({
                  secret,
                  label: user.email,
                  issuer: TWO_FACTOR_ISSUER,
                  encoding: 'base32',
              })
            : undefined

        if (!secret || !otpauthUri) {
            throw new Error('Failed to generate two-factor authentication secret')
        }

        await this.authRepository.replaceTwoFactorSetupSecret({
            userId,
            encryptedSecret: encryptTwoFactorSecret(secret),
        })

        return {
            secret,
            otpauthUri,
            qrCodeDataUrl: await QRCode.toDataURL(otpauthUri),
        }
    }

    async verifySetup(
        userId: string,
        input: TwoFactorTokenRequestInput,
    ): Promise<TwoFactorVerifySetupResponse> {
        const { token, errors } = validateVerificationTokenInput(input)

        if (errors.length > 0 || !token) {
            throw new BadRequestException(errors)
        }

        const user = await this.authRepository.findUserById(userId)

        if (!user) {
            throw new UnauthorizedException('Authentication required')
        }

        if (user.totpEnabled) {
            throw new BadRequestException(TWO_FACTOR_ALREADY_ENABLED_MESSAGE)
        }

        if (!user.totpSecretEncrypted) {
            throw new BadRequestException(TWO_FACTOR_SETUP_MISSING_MESSAGE)
        }

        const secret = decryptSetupSecret(user.totpSecretEncrypted)

        if (!isValidTotpToken(secret, token)) {
            throw new BadRequestException(INVALID_TWO_FACTOR_TOKEN_MESSAGE)
        }

        const recoveryCodes = generateRecoveryCodes()
        const recoveryCodeHashes = await Promise.all(
            recoveryCodes.map((recoveryCode) => hashRecoveryCode(recoveryCode)),
        )

        await this.authRepository.enableTwoFactorForUser({
            userId,
            recoveryCodeHashes,
        })

        return {
            message: TWO_FACTOR_ENABLED_MESSAGE,
            recoveryCodes,
        }
    }

    async verifyLogin(
        challenge: TwoFactorLoginChallengeInput,
        input: TwoFactorTokenRequestInput,
    ): Promise<TwoFactorLoginVerificationResponse> {
        const { token, errors } = validateVerificationTokenInput(input)

        if (errors.length > 0 || !token) {
            throw new BadRequestException(errors)
        }

        const user = await this.authRepository.findUserById(challenge.userId)

        if (
            !user ||
            user.sessionVersion !== challenge.sessionVersion ||
            !user.totpEnabled ||
            !user.totpSecretEncrypted
        ) {
            throw new UnauthorizedException(INVALID_TWO_FACTOR_CHALLENGE_MESSAGE)
        }

        const secret = decryptLoginSecret(user.totpSecretEncrypted)

        if (isValidTotpToken(secret, token)) {
            return {
                ...mapAuthenticatedSessionUser(user),
                recoveryCodeUsed: false,
            }
        }

        const recoveryCodeUsed = await this.consumeRecoveryCode(challenge.userId, token)

        if (recoveryCodeUsed) {
            return {
                ...mapAuthenticatedSessionUser(user),
                recoveryCodeUsed: true,
            }
        }

        throw new UnauthorizedException(INVALID_TWO_FACTOR_TOKEN_MESSAGE)
    }

    async disable(userId: string, input: Record<string, unknown>): Promise<AuthActionResponse> {
        const { currentPassword, errors } = validateCurrentPasswordInput(input)

        if (errors.length > 0 || !currentPassword) {
            throw new BadRequestException(errors)
        }

        const user = await this.authRepository.findUserById(userId)

        if (!user) {
            throw new UnauthorizedException('Authentication required')
        }

        if (!user.totpEnabled) {
            throw new BadRequestException(TWO_FACTOR_NOT_ENABLED_MESSAGE)
        }

        const isCurrentPasswordValid = await argon2.verify(user.passwordHash, currentPassword)

        if (!isCurrentPasswordValid) {
            throw new UnauthorizedException(CURRENT_PASSWORD_INCORRECT_MESSAGE)
        }

        await this.authRepository.disableTwoFactorForUser(userId)

        return {
            message: TWO_FACTOR_DISABLED_MESSAGE,
        }
    }

    private async consumeRecoveryCode(userId: string, token: string): Promise<boolean> {
        const normalizedToken = normalizeRecoveryCode(token)
        const recoveryCodes = await this.authRepository.listUnusedRecoveryCodes(userId)

        for (const recoveryCode of recoveryCodes) {
            const isMatch = await verifyRecoveryCode(recoveryCode, normalizedToken)

            if (!isMatch) {
                continue
            }

            return this.authRepository.consumeRecoveryCode({
                recoveryCodeId: recoveryCode.id,
                userId,
                usedAt: new Date(),
            })
        }

        return false
    }
}

function mapAuthenticatedSessionUser(user: User): AuthenticatedSessionUserResponse {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        emailVerified: user.emailVerified,
        sessionVersion: user.sessionVersion,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    }
}

function isValidTotpToken(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: normalizeTotpToken(token),
        window: 1,
    })
}

function generateRecoveryCodes(): string[] {
    return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
        const rawCode = createRandomCode(RECOVERY_CODE_SEGMENT_LENGTH * RECOVERY_CODE_SEGMENT_COUNT)
        return rawCode.match(/.{1,4}/g)?.join('-') ?? rawCode
    })
}

function createRandomCode(length: number): string {
    const bytes = randomBytes(length)

    return Array.from(bytes, (byte) => RECOVERY_CODE_ALPHABET[byte % RECOVERY_CODE_ALPHABET.length])
        .join('')
        .slice(0, length)
}

async function hashRecoveryCode(recoveryCode: string): Promise<string> {
    return argon2.hash(normalizeRecoveryCode(recoveryCode), {
        type: argon2.argon2id,
    })
}

async function verifyRecoveryCode(record: RecoveryCodeRecord, input: string): Promise<boolean> {
    return argon2.verify(record.codeHash, input)
}

function normalizeTotpToken(token: string): string {
    return token.replace(/\s+/g, '')
}

function normalizeRecoveryCode(token: string): string {
    return token.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
}

function encryptTwoFactorSecret(secret: string): string {
    const iv = randomBytes(ENCRYPTION_IV_BYTES)
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, resolveEncryptionKey(), iv)
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

function decryptSetupSecret(encryptedSecret: string): string {
    try {
        return decryptTwoFactorSecret(encryptedSecret)
    } catch {
        throw new BadRequestException(TWO_FACTOR_SETUP_MISSING_MESSAGE)
    }
}

function decryptLoginSecret(encryptedSecret: string): string {
    try {
        return decryptTwoFactorSecret(encryptedSecret)
    } catch {
        throw new UnauthorizedException(INVALID_TWO_FACTOR_CHALLENGE_MESSAGE)
    }
}

function decryptTwoFactorSecret(encryptedSecret: string): string {
    const [ivHex, authTagHex, encryptedHex] = encryptedSecret.split(':')

    if (!ivHex || !authTagHex || !encryptedHex) {
        throw new Error('Encrypted two-factor secret is invalid')
    }

    const decipher = createDecipheriv(
        ENCRYPTION_ALGORITHM,
        resolveEncryptionKey(),
        Buffer.from(ivHex, 'hex'),
    )

    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedHex, 'hex')),
        decipher.final(),
    ])

    return decrypted.toString('utf8')
}

function resolveEncryptionKey(): Buffer {
    const configuredSecret = process.env.TOTP_ENCRYPTION_KEY?.trim()

    if (configuredSecret) {
        return createHash('sha256').update(configuredSecret).digest()
    }

    if (process.env.NODE_ENV !== 'production') {
        const sessionSecret = process.env.SESSION_SECRET?.trim()

        if (sessionSecret) {
            return createHash('sha256').update(sessionSecret).digest()
        }
    }

    throw new Error('TOTP_ENCRYPTION_KEY environment variable is missing')
}
