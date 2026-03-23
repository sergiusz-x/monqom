import { BadRequestException, UnauthorizedException } from '@nestjs/common'
import * as argon2 from 'argon2'
import * as speakeasy from 'speakeasy'
import { AuthRepository } from './auth.repository'
import { TwoFactorService } from './twoFactor.service'

describe('TwoFactorService', () => {
    let service: TwoFactorService
    let authRepository: jest.Mocked<
        Pick<
            AuthRepository,
            | 'findUserById'
            | 'replaceTwoFactorSetupSecret'
            | 'enableTwoFactorForUser'
            | 'listUnusedRecoveryCodes'
            | 'consumeRecoveryCode'
            | 'disableTwoFactorForUser'
        >
    >
    const originalNodeEnv = process.env.NODE_ENV
    const originalSessionSecret = process.env.SESSION_SECRET
    const originalTotpEncryptionKey = process.env.TOTP_ENCRYPTION_KEY

    beforeEach(() => {
        authRepository = {
            findUserById: jest.fn(),
            replaceTwoFactorSetupSecret: jest.fn(),
            enableTwoFactorForUser: jest.fn(),
            listUnusedRecoveryCodes: jest.fn(),
            consumeRecoveryCode: jest.fn(),
            disableTwoFactorForUser: jest.fn(),
        }

        process.env.NODE_ENV = 'test'
        process.env.SESSION_SECRET = 'test-session-secret'
        process.env.TOTP_ENCRYPTION_KEY = 'test-two-factor-encryption-key'
        service = new TwoFactorService(authRepository as unknown as AuthRepository)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    afterAll(() => {
        process.env.NODE_ENV = originalNodeEnv
        process.env.SESSION_SECRET = originalSessionSecret
        process.env.TOTP_ENCRYPTION_KEY = originalTotpEncryptionKey
    })

    it('creates a TOTP secret, stores it encrypted, and returns QR setup details', async () => {
        authRepository.findUserById.mockResolvedValue(createMockUser())

        const result = await service.setup('user-1')

        expect(result.secret).toMatch(/^[A-Z2-7]+$/)
        expect(result.otpauthUri).toContain('otpauth://totp/')
        expect(result.otpauthUri).toContain('Monqom')
        expect(result.otpauthUri).toContain('test@example.com')
        expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/)
        expect(authRepository.replaceTwoFactorSetupSecret).toHaveBeenCalledWith({
            userId: 'user-1',
            encryptedSecret: expect.any(String),
        })
        expect(
            authRepository.replaceTwoFactorSetupSecret.mock.calls[0][0].encryptedSecret,
        ).not.toBe(result.secret)
    })

    it('rejects setup when two-factor authentication is already enabled', async () => {
        authRepository.findUserById.mockResolvedValue(
            createMockUser({
                totpEnabled: true,
                totpSecretEncrypted: 'encrypted-secret',
            }),
        )

        await expect(service.setup('user-1')).rejects.toBeInstanceOf(BadRequestException)
        expect(authRepository.replaceTwoFactorSetupSecret).not.toHaveBeenCalled()
    })

    it('verifies setup with a valid token and persists hashed recovery codes', async () => {
        authRepository.findUserById.mockResolvedValue(createMockUser())

        const setupResult = await service.setup('user-1')
        const encryptedSecret =
            authRepository.replaceTwoFactorSetupSecret.mock.calls[0][0].encryptedSecret
        const token = speakeasy.totp({
            secret: setupResult.secret,
            encoding: 'base32',
        })

        authRepository.findUserById.mockResolvedValue(
            createMockUser({
                totpSecretEncrypted: encryptedSecret,
            }),
        )

        const result = await service.verifySetup('user-1', { token })

        expect(result.message).toBe('Two-factor authentication enabled')
        expect(result.recoveryCodes).toHaveLength(8)
        expect(authRepository.enableTwoFactorForUser).toHaveBeenCalledWith({
            userId: 'user-1',
            recoveryCodeHashes: expect.any(Array),
        })

        const storedHashes =
            authRepository.enableTwoFactorForUser.mock.calls[0][0].recoveryCodeHashes
        expect(storedHashes).toHaveLength(8)

        await Promise.all(
            result.recoveryCodes.map((recoveryCode, index) =>
                expect(
                    argon2.verify(
                        storedHashes[index],
                        recoveryCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(),
                    ),
                ).resolves.toBe(true),
            ),
        )
    })

    it('rejects setup verification when the TOTP token is invalid', async () => {
        authRepository.findUserById.mockResolvedValue(createMockUser())

        await service.setup('user-1')
        const encryptedSecret =
            authRepository.replaceTwoFactorSetupSecret.mock.calls[0][0].encryptedSecret

        authRepository.findUserById.mockResolvedValue(
            createMockUser({
                totpSecretEncrypted: encryptedSecret,
            }),
        )

        await expect(service.verifySetup('user-1', { token: '000000' })).rejects.toBeInstanceOf(
            BadRequestException,
        )
        expect(authRepository.enableTwoFactorForUser).not.toHaveBeenCalled()
    })

    it('verifies a login challenge with a valid TOTP token', async () => {
        authRepository.findUserById.mockResolvedValue(createMockUser())

        const setupResult = await service.setup('user-1')
        const encryptedSecret =
            authRepository.replaceTwoFactorSetupSecret.mock.calls[0][0].encryptedSecret
        const token = speakeasy.totp({
            secret: setupResult.secret,
            encoding: 'base32',
        })

        authRepository.findUserById.mockResolvedValue(
            createMockUser({
                totpEnabled: true,
                totpSecretEncrypted: encryptedSecret,
            }),
        )

        await expect(
            service.verifyLogin(
                {
                    userId: 'user-1',
                    sessionVersion: 0,
                },
                { token },
            ),
        ).resolves.toEqual({
            id: 'user-1',
            email: 'test@example.com',
            name: 'Ada Lovelace',
            emailVerified: true,
            sessionVersion: 0,
            recoveryCodeUsed: false,
            createdAt: new Date('2026-03-22T10:00:00.000Z'),
            updatedAt: new Date('2026-03-22T10:00:00.000Z'),
        })

        expect(authRepository.listUnusedRecoveryCodes).not.toHaveBeenCalled()
    })

    it('verifies a login challenge with a recovery code and marks it as used', async () => {
        authRepository.findUserById.mockResolvedValue(createMockUser())

        await service.setup('user-1')
        const encryptedSecret =
            authRepository.replaceTwoFactorSetupSecret.mock.calls[0][0].encryptedSecret
        const recoveryCode = 'ABCD-EFGH-JKLM'

        authRepository.findUserById.mockResolvedValue(
            createMockUser({
                totpEnabled: true,
                totpSecretEncrypted: encryptedSecret,
            }),
        )
        authRepository.listUnusedRecoveryCodes.mockResolvedValue([
            {
                id: 'recovery-code-1',
                userId: 'user-1',
                codeHash: await argon2.hash(
                    recoveryCode.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(),
                    {
                        type: argon2.argon2id,
                    },
                ),
                usedAt: null,
                createdAt: new Date('2026-03-22T10:00:00.000Z'),
                updatedAt: new Date('2026-03-22T10:00:00.000Z'),
            },
        ])
        authRepository.consumeRecoveryCode.mockResolvedValue(true)

        const result = await service.verifyLogin(
            {
                userId: 'user-1',
                sessionVersion: 0,
            },
            { token: recoveryCode },
        )

        expect(result.recoveryCodeUsed).toBe(true)
        expect(authRepository.consumeRecoveryCode).toHaveBeenCalledWith({
            recoveryCodeId: 'recovery-code-1',
            userId: 'user-1',
            usedAt: expect.any(Date),
        })
    })

    it('rejects a login challenge when the stored session version is stale', async () => {
        authRepository.findUserById.mockResolvedValue(createMockUser())

        const setupResult = await service.setup('user-1')
        const encryptedSecret =
            authRepository.replaceTwoFactorSetupSecret.mock.calls[0][0].encryptedSecret
        const token = speakeasy.totp({
            secret: setupResult.secret,
            encoding: 'base32',
        })

        authRepository.findUserById.mockResolvedValue(
            createMockUser({
                sessionVersion: 1,
                totpEnabled: true,
                totpSecretEncrypted: encryptedSecret,
            }),
        )

        await expect(
            service.verifyLogin(
                {
                    userId: 'user-1',
                    sessionVersion: 0,
                },
                { token },
            ),
        ).rejects.toBeInstanceOf(UnauthorizedException)

        expect(authRepository.listUnusedRecoveryCodes).not.toHaveBeenCalled()
        expect(authRepository.consumeRecoveryCode).not.toHaveBeenCalled()
    })

    it('disables two-factor authentication when the current password is valid', async () => {
        authRepository.findUserById.mockResolvedValue(
            createMockUser({
                passwordHash: await argon2.hash('GraniteHarbor!1234', {
                    type: argon2.argon2id,
                }),
                totpEnabled: true,
                totpSecretEncrypted: 'encrypted-secret',
            }),
        )

        await expect(
            service.disable('user-1', {
                currentPassword: 'GraniteHarbor!1234',
            }),
        ).resolves.toEqual({
            message: 'Two-factor authentication disabled',
        })

        expect(authRepository.disableTwoFactorForUser).toHaveBeenCalledWith('user-1')
    })

    it('rejects disabling two-factor authentication when the password is incorrect', async () => {
        authRepository.findUserById.mockResolvedValue(
            createMockUser({
                passwordHash: await argon2.hash('GraniteHarbor!1234', {
                    type: argon2.argon2id,
                }),
                totpEnabled: true,
                totpSecretEncrypted: 'encrypted-secret',
            }),
        )

        await expect(
            service.disable('user-1', {
                currentPassword: 'WrongPassword!9999',
            }),
        ).rejects.toBeInstanceOf(UnauthorizedException)

        expect(authRepository.disableTwoFactorForUser).not.toHaveBeenCalled()
    })
})

function createMockUser(
    overrides: Partial<{
        id: string
        email: string
        name: string
        passwordHash: string
        emailVerified: boolean
        sessionVersion: number
        totpEnabled: boolean
        totpSecretEncrypted: string | null
        createdAt: Date
        updatedAt: Date
    }> = {},
) {
    return {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Ada Lovelace',
        passwordHash: 'hash',
        emailVerified: true,
        sessionVersion: 0,
        totpEnabled: false,
        totpSecretEncrypted: null,
        createdAt: new Date('2026-03-22T10:00:00.000Z'),
        updatedAt: new Date('2026-03-22T10:00:00.000Z'),
        ...overrides,
    }
}
