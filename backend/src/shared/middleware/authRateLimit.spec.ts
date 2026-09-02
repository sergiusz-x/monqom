import { Request, Response } from 'express'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../database/prisma.service'
import { AuthRateLimitMiddleware } from './authRateLimit'

describe('AuthRateLimitMiddleware', () => {
    it('continues when the shared limiter accepts the request', async () => {
        const prisma = createPrisma([{ attempt_count: 1, blocked_until: null }])
        const middleware = new AuthRateLimitMiddleware(prisma, createConfigService())
        const next = jest.fn()

        await middleware.use(createRequest('/api/v1/auth/login'), createResponse().response, next)

        expect(next).toHaveBeenCalledTimes(1)
        expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('returns the endpoint-specific response when PostgreSQL blocks the key', async () => {
        const blockedUntil = new Date(Date.now() + 60_000)
        const prisma = createPrisma([{ attempt_count: 6, blocked_until: blockedUntil }])
        const middleware = new AuthRateLimitMiddleware(prisma, createConfigService())
        const { response, status, json, setHeader } = createResponse()
        const next = jest.fn()

        await middleware.use(createRequest('/api/v1/auth/register'), response, next)

        expect(next).not.toHaveBeenCalled()
        expect(setHeader).toHaveBeenCalledWith('Retry-After', '900')
        expect(status).toHaveBeenCalledWith(429)
        expect(json).toHaveBeenCalledWith({
            statusCode: 429,
            message: 'Too many registration attempts. Please try again later.',
            error: 'Too Many Requests',
        })
    })

    it('fails closed when the shared limiter is unavailable', async () => {
        const nodeEnv = process.env.NODE_ENV
        process.env.NODE_ENV = 'production'
        const prisma = {
            $transaction: jest.fn().mockRejectedValue(new Error('database unavailable')),
        } as unknown as PrismaService
        const middleware = new AuthRateLimitMiddleware(prisma, createConfigService())
        const { response, status, json } = createResponse()

        try {
            await middleware.use(createRequest('/api/v1/auth/login'), response, jest.fn())
        } finally {
            process.env.NODE_ENV = nodeEnv
        }

        expect(status).toHaveBeenCalledWith(503)
        expect(json).toHaveBeenCalledWith({
            statusCode: 503,
            message: 'Authentication protection is temporarily unavailable',
            error: 'Service Unavailable',
        })
    })
})

function createConfigService(): ConfigService {
    return { get: jest.fn().mockReturnValue('test-session-secret') } as unknown as ConfigService
}

function createPrisma(
    rows: Array<{ attempt_count: number; blocked_until: Date | null }>,
): PrismaService {
    const tx = { $queryRaw: jest.fn().mockResolvedValue(rows) }
    return {
        $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
        authRateLimit: { deleteMany: jest.fn() },
    } as unknown as PrismaService
}

function createRequest(path: string): Request {
    return {
        ip: '127.0.0.1',
        path,
        originalUrl: path,
        url: path,
        body: {},
    } as Request
}

function createResponse(): {
    response: Response
    status: jest.Mock
    json: jest.Mock
    setHeader: jest.Mock
} {
    const json = jest.fn()
    const status = jest.fn(() => ({ json }))
    const setHeader = jest.fn()
    return { response: { status, setHeader } as unknown as Response, status, json, setHeader }
}
