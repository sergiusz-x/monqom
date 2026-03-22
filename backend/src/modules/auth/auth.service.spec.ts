import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common'
import * as argon2 from 'argon2'
import { createHash } from 'crypto'
import { AuthRepository } from './auth.repository'
import { AuthService } from './auth.service'
import { logger } from '../../shared/utils/logger'

jest.mock('../../shared/utils/logger', () => ({
    logger: {
        info: jest.fn(),
    },
}))

describe('AuthService', () => {
    let service: AuthService
    let authRepository: jest.Mocked<
        Pick<
            AuthRepository,
            | 'findUserByEmail'
            | 'findUserById'
            | 'createUserWithVerificationToken'
            | 'findEmailVerificationTokenWithUser'
            | 'consumeVerificationTokensAndMarkEmailVerified'
            | 'createVerificationTokenForUser'
            | 'createUserAuditEvent'
        >
    >
    const originalNodeEnv = process.env.NODE_ENV

    beforeEach(() => {
        authRepository = {
            findUserByEmail: jest.fn(),
            findUserById: jest.fn(),
            createUserWithVerificationToken: jest.fn(),
            findEmailVerificationTokenWithUser: jest.fn(),
            consumeVerificationTokensAndMarkEmailVerified: jest.fn(),
            createVerificationTokenForUser: jest.fn(),
            createUserAuditEvent: jest.fn(),
        }

        service = new AuthService(authRepository as unknown as AuthRepository)
        jest.clearAllMocks()
        process.env.NODE_ENV = 'test'
    })

    afterAll(() => {
        process.env.NODE_ENV = originalNodeEnv
    })

    it('registers a user with a hashed password and verification token', async () => {
        const now = Date.now()
        const password = 'GraniteHarbor!1234'

        process.env.NODE_ENV = 'development'

        authRepository.findUserByEmail.mockResolvedValue(null)
        authRepository.createUserWithVerificationToken.mockImplementation(async (input) => ({
            id: 'user-1',
            email: input.email,
            name: input.name,
            passwordHash: input.passwordHash,
            emailVerified: false,
            createdAt: new Date('2026-03-22T10:00:00.000Z'),
            updatedAt: new Date('2026-03-22T10:00:00.000Z'),
        }))

        const result = await service.register({
            email: ' Test@Example.com ',
            name: ' Ada Lovelace ',
            password,
        })

        const createCall = authRepository.createUserWithVerificationToken.mock.calls[0][0]

        expect(createCall.email).toBe('test@example.com')
        expect(createCall.name).toBe('Ada Lovelace')
        expect(createCall.passwordHash).not.toBe(password)
        await expect(argon2.verify(createCall.passwordHash, password)).resolves.toBe(true)
        expect(createCall.verificationToken).toMatch(/^[a-f0-9]{64}$/)
        expect(
            Math.abs(createCall.verificationTokenExpiresAt.getTime() - (now + 24 * 60 * 60 * 1000)),
        ).toBeLessThanOrEqual(5000)
        expect(logger.info).toHaveBeenCalledWith(
            'Email verification token generated for registration',
            expect.objectContaining({
                context_name: 'AuthService',
                verification_token: createCall.verificationToken,
            }),
        )
        expect(result).toEqual({
            id: 'user-1',
            email: 'test@example.com',
            name: 'Ada Lovelace',
            emailVerified: false,
            createdAt: new Date('2026-03-22T10:00:00.000Z'),
            updatedAt: new Date('2026-03-22T10:00:00.000Z'),
        })
    })

    it('rejects invalid registration input before hitting the repository', async () => {
        try {
            await service.register({
                email: 'invalid-email',
                name: '',
                password: 'weak',
            })
            fail('Expected register to throw a BadRequestException')
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException)
            const response = (error as BadRequestException).getResponse() as {
                message: string[]
            }

            expect(response.message).toEqual(
                expect.arrayContaining([
                    'Email must be a valid email address',
                    'Name is required',
                    'Password must be at least 16 characters long',
                ]),
            )
        }

        expect(authRepository.findUserByEmail).not.toHaveBeenCalled()
        expect(authRepository.createUserWithVerificationToken).not.toHaveBeenCalled()
    })

    it('returns a conflict when the email already exists', async () => {
        authRepository.findUserByEmail.mockResolvedValue({
            id: 'existing-user',
            email: 'test@example.com',
            name: 'Existing User',
            passwordHash: 'hash',
            emailVerified: false,
            createdAt: new Date('2026-03-22T10:00:00.000Z'),
            updatedAt: new Date('2026-03-22T10:00:00.000Z'),
        })

        await expect(
            service.register({
                email: 'test@example.com',
                name: 'Ada Lovelace',
                password: 'GraniteHarbor!1234',
            }),
        ).rejects.toBeInstanceOf(ConflictException)

        expect(authRepository.createUserWithVerificationToken).not.toHaveBeenCalled()
    })

    it('maps Prisma unique constraint errors to conflicts', async () => {
        authRepository.findUserByEmail.mockResolvedValue(null)
        authRepository.createUserWithVerificationToken.mockRejectedValue({
            code: 'P2002',
        })

        await expect(
            service.register({
                email: 'test@example.com',
                name: 'Ada Lovelace',
                password: 'GraniteHarbor!1234',
            }),
        ).rejects.toBeInstanceOf(ConflictException)
    })

    it('logs only masked token metadata in production for the MVP flow', async () => {
        authRepository.findUserByEmail.mockResolvedValue(null)
        authRepository.createUserWithVerificationToken.mockImplementation(async (input) => ({
            id: 'user-1',
            email: input.email,
            name: input.name,
            passwordHash: input.passwordHash,
            emailVerified: false,
            createdAt: new Date('2026-03-22T10:00:00.000Z'),
            updatedAt: new Date('2026-03-22T10:00:00.000Z'),
        }))

        process.env.NODE_ENV = 'production'

        await service.register({
            email: 'test@example.com',
            name: 'Ada Lovelace',
            password: 'GraniteHarbor!1234',
        })

        const createCall = authRepository.createUserWithVerificationToken.mock.calls[0][0]
        const expectedFingerprint = createHash('sha256')
            .update(createCall.verificationToken)
            .digest('hex')

        expect(logger.info).toHaveBeenCalledWith(
            'Email verification token generated for registration',
            expect.objectContaining({
                context_name: 'AuthService',
                verification_token_last6: createCall.verificationToken.slice(-6),
                verification_token_fingerprint: expectedFingerprint,
            }),
        )

        const verificationLogCall = (logger.info as jest.Mock).mock.calls.find(
            ([message]) => message === 'Email verification token generated for registration',
        )
        expect(verificationLogCall?.[1]).toEqual(
            expect.not.objectContaining({
                verification_token: expect.any(String),
            }),
        )
    })

    it('authenticates a verified user during login', async () => {
        const password = 'GraniteHarbor!1234'
        const passwordHash = await argon2.hash(password, {
            type: argon2.argon2id,
        })

        authRepository.findUserByEmail.mockResolvedValue(
            createMockUser({
                passwordHash,
                emailVerified: true,
            }),
        )

        await expect(
            service.login({
                email: ' Test@Example.com ',
                password,
            }),
        ).resolves.toEqual({
            id: 'user-1',
            email: 'test@example.com',
            name: 'Ada Lovelace',
            emailVerified: true,
            createdAt: new Date('2026-03-22T10:00:00.000Z'),
            updatedAt: new Date('2026-03-22T10:00:00.000Z'),
        })

        expect(authRepository.findUserByEmail).toHaveBeenCalledWith('test@example.com')
    })

    it('rejects invalid login input before hitting the repository', async () => {
        try {
            await service.login({
                email: 'invalid-email',
                password: '',
            })
            fail('Expected login to throw a BadRequestException')
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException)
            const response = (error as BadRequestException).getResponse() as {
                message: string[]
            }

            expect(response.message).toEqual([
                'Email must be a valid email address',
                'Password is required',
            ])
        }

        expect(authRepository.findUserByEmail).not.toHaveBeenCalled()
    })

    it('rejects login when the user does not exist', async () => {
        authRepository.findUserByEmail.mockResolvedValue(null)

        await expect(
            service.login({
                email: 'test@example.com',
                password: 'GraniteHarbor!1234',
            }),
        ).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('rejects login when the password is incorrect', async () => {
        const passwordHash = await argon2.hash('DifferentPassword!1234', {
            type: argon2.argon2id,
        })

        authRepository.findUserByEmail.mockResolvedValue(
            createMockUser({
                passwordHash,
                emailVerified: true,
            }),
        )

        await expect(
            service.login({
                email: 'test@example.com',
                password: 'GraniteHarbor!1234',
            }),
        ).rejects.toBeInstanceOf(UnauthorizedException)
    })

    it('rejects login for users whose email is not verified', async () => {
        const password = 'GraniteHarbor!1234'
        const passwordHash = await argon2.hash(password, {
            type: argon2.argon2id,
        })

        authRepository.findUserByEmail.mockResolvedValue(
            createMockUser({
                passwordHash,
                emailVerified: false,
            }),
        )

        await expect(
            service.login({
                email: 'test@example.com',
                password,
            }),
        ).rejects.toThrow('Email address must be verified before logging in')
    })

    it('returns the authenticated user for a valid session user id', async () => {
        authRepository.findUserById.mockResolvedValue(
            createMockUser({
                emailVerified: true,
            }),
        )

        await expect(service.getAuthenticatedUser('user-1')).resolves.toEqual({
            id: 'user-1',
            email: 'test@example.com',
            name: 'Ada Lovelace',
            emailVerified: true,
            createdAt: new Date('2026-03-22T10:00:00.000Z'),
            updatedAt: new Date('2026-03-22T10:00:00.000Z'),
        })
    })

    it('rejects missing users for authenticated session lookups', async () => {
        authRepository.findUserById.mockResolvedValue(null)

        await expect(service.getAuthenticatedUser('missing-user')).rejects.toThrow(
            'Authentication required',
        )
    })

    it('records login audit events for session-based auth', async () => {
        await service.recordSuccessfulLogin({
            userId: 'user-1',
            ipAddress: '127.0.0.1',
        })

        expect(authRepository.createUserAuditEvent).toHaveBeenCalledWith({
            action: 'USER_LOGGED_IN',
            userId: 'user-1',
            metadata: {
                auth_strategy: 'SESSION_COOKIE',
                ip_address: '127.0.0.1',
            },
        })
    })

    it('records logout audit events for session-based auth', async () => {
        await service.recordSuccessfulLogout({
            userId: 'user-1',
        })

        expect(authRepository.createUserAuditEvent).toHaveBeenCalledWith({
            action: 'USER_LOGGED_OUT',
            userId: 'user-1',
            metadata: {
                auth_strategy: 'SESSION_COOKIE',
            },
        })
    })

    it('verifies a valid email token and consumes outstanding tokens', async () => {
        const now = Date.now()

        authRepository.findEmailVerificationTokenWithUser.mockResolvedValue(
            createMockVerificationToken(),
        )
        authRepository.consumeVerificationTokensAndMarkEmailVerified.mockResolvedValue(true)

        await expect(service.verifyEmail({ token: '  verification-token  ' })).resolves.toEqual({
            message: 'Email verified successfully',
        })

        expect(authRepository.findEmailVerificationTokenWithUser).toHaveBeenCalledWith(
            'verification-token',
        )

        const consumeCall =
            authRepository.consumeVerificationTokensAndMarkEmailVerified.mock.calls[0][0]

        expect(consumeCall.userId).toBe('user-1')
        expect(Math.abs(consumeCall.verifiedAt.getTime() - now)).toBeLessThanOrEqual(5000)
    })

    it('rejects missing verification tokens before hitting the repository', async () => {
        try {
            await service.verifyEmail({ token: '   ' })
            fail('Expected verifyEmail to throw a BadRequestException')
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException)
            const response = (error as BadRequestException).getResponse() as {
                message: string[]
            }

            expect(response.message).toEqual(['Token is required'])
        }

        expect(authRepository.findEmailVerificationTokenWithUser).not.toHaveBeenCalled()
    })

    it.each([
        ['missing token', null],
        [
            'used token',
            createMockVerificationToken({
                usedAt: new Date('2026-03-23T10:00:00.000Z'),
            }),
        ],
        [
            'expired token',
            createMockVerificationToken({
                expiresAt: new Date('2026-03-21T10:00:00.000Z'),
            }),
        ],
        [
            'already verified user',
            createMockVerificationToken({
                user: createMockUser({ emailVerified: true }),
            }),
        ],
    ])('rejects %s during email verification', async (_, tokenRecord) => {
        authRepository.findEmailVerificationTokenWithUser.mockResolvedValue(tokenRecord)

        await expect(service.verifyEmail({ token: 'verification-token' })).rejects.toThrow(
            'Verification token is invalid or expired',
        )

        expect(authRepository.consumeVerificationTokensAndMarkEmailVerified).not.toHaveBeenCalled()
    })

    it('rejects verification if the token is consumed during the update transaction', async () => {
        authRepository.findEmailVerificationTokenWithUser.mockResolvedValue(
            createMockVerificationToken(),
        )
        authRepository.consumeVerificationTokensAndMarkEmailVerified.mockResolvedValue(false)

        await expect(service.verifyEmail({ token: 'verification-token' })).rejects.toThrow(
            'Verification token is invalid or expired',
        )
    })

    it('resends a verification token for an existing unverified user', async () => {
        const now = Date.now()

        process.env.NODE_ENV = 'development'
        authRepository.findUserByEmail.mockResolvedValue(createMockUser())
        authRepository.createVerificationTokenForUser.mockResolvedValue(undefined)

        await expect(service.resendVerification({ email: ' Test@Example.com ' })).resolves.toEqual({
            message: 'Verification email sent',
        })

        const createCall = authRepository.createVerificationTokenForUser.mock.calls[0][0]

        expect(authRepository.findUserByEmail).toHaveBeenCalledWith('test@example.com')
        expect(createCall.userId).toBe('user-1')
        expect(createCall.verificationToken).toMatch(/^[a-f0-9]{64}$/)
        expect(
            Math.abs(createCall.verificationTokenExpiresAt.getTime() - (now + 24 * 60 * 60 * 1000)),
        ).toBeLessThanOrEqual(5000)
        expect(logger.info).toHaveBeenCalledWith(
            'Email verification token generated for resend',
            expect.objectContaining({
                context_name: 'AuthService',
                verification_token: createCall.verificationToken,
            }),
        )
    })

    it('rejects invalid resend-verification input before hitting the repository', async () => {
        try {
            await service.resendVerification({ email: 'invalid-email' })
            fail('Expected resendVerification to throw a BadRequestException')
        } catch (error) {
            expect(error).toBeInstanceOf(BadRequestException)
            const response = (error as BadRequestException).getResponse() as {
                message: string[]
            }

            expect(response.message).toEqual(['Email must be a valid email address'])
        }

        expect(authRepository.findUserByEmail).not.toHaveBeenCalled()
    })

    it.each([
        ['missing user', null],
        ['verified user', createMockUser({ emailVerified: true })],
    ])('returns a generic resend response for %s', async (_, userRecord) => {
        authRepository.findUserByEmail.mockResolvedValue(userRecord)

        await expect(service.resendVerification({ email: 'test@example.com' })).resolves.toEqual({
            message: 'Verification email sent',
        })

        expect(authRepository.createVerificationTokenForUser).not.toHaveBeenCalled()
    })
})

function createMockUser(
    overrides: Partial<{
        id: string
        email: string
        name: string
        passwordHash: string
        emailVerified: boolean
        createdAt: Date
        updatedAt: Date
    }> = {},
) {
    return {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Ada Lovelace',
        passwordHash: 'hash',
        emailVerified: false,
        createdAt: new Date('2026-03-22T10:00:00.000Z'),
        updatedAt: new Date('2026-03-22T10:00:00.000Z'),
        ...overrides,
    }
}

function createMockVerificationToken(
    overrides: Partial<{
        id: string
        userId: string
        token: string
        expiresAt: Date
        usedAt: Date | null
        createdAt: Date
        updatedAt: Date
        user: ReturnType<typeof createMockUser>
    }> = {},
) {
    return {
        id: 'verification-token-1',
        userId: 'user-1',
        token: 'verification-token',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
        createdAt: new Date('2026-03-22T10:00:00.000Z'),
        updatedAt: new Date('2026-03-22T10:00:00.000Z'),
        user: createMockUser(),
        ...overrides,
    }
}
