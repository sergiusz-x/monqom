import { Request, Response } from 'express'
import { AuthRateLimitMiddleware } from './authRateLimit'

describe('AuthRateLimitMiddleware', () => {
    let middleware: AuthRateLimitMiddleware
    let nextFunction: jest.Mock
    let response: Partial<Response>
    let statusMock: jest.Mock
    let jsonMock: jest.Mock

    beforeEach(() => {
        middleware = new AuthRateLimitMiddleware()
        nextFunction = jest.fn()
        jsonMock = jest.fn()
        statusMock = jest.fn(() => ({ json: jsonMock }))
        response = {
            setHeader: jest.fn(),
            status: statusMock,
        }
    })

    it('uses req.ip when trust proxy is disabled, ignoring spoofed forwarded headers', () => {
        const request = createRequest({
            ip: '127.0.0.1',
            path: '/api/v1/auth/register',
            forwardedFor: '198.51.100.10',
            trustProxy: false,
        })

        for (let attempt = 0; attempt < 5; attempt += 1) {
            middleware.use(request, response as Response, nextFunction)
        }

        middleware.use(request, response as Response, nextFunction)

        expect(nextFunction).toHaveBeenCalledTimes(5)
        expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '900')
        expect(statusMock).toHaveBeenCalledWith(429)
        expect(jsonMock).toHaveBeenCalledWith({
            statusCode: 429,
            message: 'Too many registration attempts. Please try again later.',
            error: 'Too Many Requests',
        })
    })

    it('uses forwarded headers only when trust proxy is enabled', () => {
        const request = createRequest({
            ip: '127.0.0.1',
            path: '/api/v1/auth/register',
            forwardedFor: '198.51.100.10, 203.0.113.5',
            trustProxy: true,
        })

        middleware.use(request, response as Response, nextFunction)

        expect(nextFunction).toHaveBeenCalledTimes(1)
        expect(statusMock).not.toHaveBeenCalled()
    })

    it('tracks rate limits separately for register and forgot-password', () => {
        const registerRequest = createRequest({
            ip: '127.0.0.1',
            path: '/api/v1/auth/register',
            trustProxy: false,
        })
        const forgotPasswordRequest = createRequest({
            ip: '127.0.0.1',
            path: '/api/v1/auth/forgot-password',
            trustProxy: false,
        })

        for (let attempt = 0; attempt < 5; attempt += 1) {
            middleware.use(registerRequest, response as Response, nextFunction)
        }

        middleware.use(forgotPasswordRequest, response as Response, nextFunction)

        expect(nextFunction).toHaveBeenCalledTimes(6)
        expect(statusMock).not.toHaveBeenCalled()
    })

    it('returns an endpoint-specific message for verification requests', () => {
        const request = createRequest({
            ip: '127.0.0.1',
            path: '/api/v1/auth/verify-email',
            trustProxy: false,
        })

        for (let attempt = 0; attempt < 5; attempt += 1) {
            middleware.use(request, response as Response, nextFunction)
        }

        middleware.use(request, response as Response, nextFunction)

        expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '900')
        expect(statusMock).toHaveBeenCalledWith(429)
        expect(jsonMock).toHaveBeenCalledWith({
            statusCode: 429,
            message: 'Too many email verification attempts. Please try again later.',
            error: 'Too Many Requests',
        })
    })

    it('returns an endpoint-specific message for password reset requests', () => {
        const request = createRequest({
            ip: '127.0.0.1',
            path: '/api/v1/auth/forgot-password',
            trustProxy: false,
        })

        for (let attempt = 0; attempt < 5; attempt += 1) {
            middleware.use(request, response as Response, nextFunction)
        }

        middleware.use(request, response as Response, nextFunction)

        expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '900')
        expect(statusMock).toHaveBeenCalledWith(429)
        expect(jsonMock).toHaveBeenCalledWith({
            statusCode: 429,
            message: 'Too many password reset requests. Please try again later.',
            error: 'Too Many Requests',
        })
    })

    it('returns an endpoint-specific message for two-factor verification requests', () => {
        const request = createRequest({
            ip: '127.0.0.1',
            path: '/api/v1/auth/2fa/verify',
            trustProxy: false,
        })

        for (let attempt = 0; attempt < 5; attempt += 1) {
            middleware.use(request, response as Response, nextFunction)
        }

        middleware.use(request, response as Response, nextFunction)

        expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '900')
        expect(statusMock).toHaveBeenCalledWith(429)
        expect(jsonMock).toHaveBeenCalledWith({
            statusCode: 429,
            message: 'Too many two-factor verification attempts. Please try again later.',
            error: 'Too Many Requests',
        })
    })
})

function createRequest(input: {
    ip: string
    path: string
    forwardedFor?: string
    trustProxy: boolean
}): Request {
    return {
        ip: input.ip,
        path: input.path,
        originalUrl: input.path,
        url: input.path,
        headers: input.forwardedFor
            ? {
                  'x-forwarded-for': input.forwardedFor,
              }
            : {},
        app: {
            get: jest.fn((key: string) => (key === 'trust proxy' ? input.trustProxy : undefined)),
        },
    } as unknown as Request
}
