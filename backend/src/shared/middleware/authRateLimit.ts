import { Injectable, NestMiddleware } from '@nestjs/common'
import { NextFunction, Request, Response } from 'express'

const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const AUTH_RATE_LIMIT_MAX_ATTEMPTS = 5

interface AuthRateLimitPolicy {
    key: string
    message: string
}

const DEFAULT_AUTH_RATE_LIMIT_POLICY: AuthRateLimitPolicy = {
    key: 'auth',
    message: 'Too many authentication attempts. Please try again later.',
}

const AUTH_RATE_LIMIT_POLICIES: Array<{
    routeSuffix: string
    policy: AuthRateLimitPolicy
}> = [
    {
        routeSuffix: '/auth/register',
        policy: {
            key: 'register',
            message: 'Too many registration attempts. Please try again later.',
        },
    },
    {
        routeSuffix: '/auth/verify-email',
        policy: {
            key: 'verify-email',
            message: 'Too many email verification attempts. Please try again later.',
        },
    },
    {
        routeSuffix: '/auth/forgot-password',
        policy: {
            key: 'forgot-password',
            message: 'Too many password reset requests. Please try again later.',
        },
    },
    {
        routeSuffix: '/auth/reset-password',
        policy: {
            key: 'reset-password',
            message: 'Too many password reset attempts. Please try again later.',
        },
    },
    {
        routeSuffix: '/auth/resend-verification',
        policy: {
            key: 'resend-verification',
            message: 'Too many verification email requests. Please try again later.',
        },
    },
]

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
    private readonly attemptsByIp = new Map<string, number[]>()

    use(req: Request, res: Response, next: NextFunction): void {
        const now = Date.now()
        const ip = getRequestIp(req)
        const policy = getAuthRateLimitPolicy(req)
        const rateLimitKey = `${policy.key}:${ip}`
        const recentAttempts = (this.attemptsByIp.get(rateLimitKey) ?? []).filter(
            (attemptedAt) => now - attemptedAt < AUTH_RATE_LIMIT_WINDOW_MS,
        )

        if (recentAttempts.length >= AUTH_RATE_LIMIT_MAX_ATTEMPTS) {
            res.setHeader('Retry-After', String(Math.ceil(AUTH_RATE_LIMIT_WINDOW_MS / 1000)))
            res.status(429).json({
                statusCode: 429,
                message: policy.message,
                error: 'Too Many Requests',
            })
            return
        }

        recentAttempts.push(now)
        this.attemptsByIp.set(rateLimitKey, recentAttempts)
        next()
    }
}

function getAuthRateLimitPolicy(req: Request): AuthRateLimitPolicy {
    const requestPath = getRequestPath(req)

    return (
        AUTH_RATE_LIMIT_POLICIES.find(({ routeSuffix }) => requestPath.endsWith(routeSuffix))
            ?.policy ?? DEFAULT_AUTH_RATE_LIMIT_POLICY
    )
}

function getRequestPath(req: Request): string {
    const joinedPath = [req.baseUrl, req.path]
        .filter((value): value is string => typeof value === 'string' && value.length > 0)
        .join('')

    const path =
        joinedPath ||
        [req.originalUrl, req.url].find(
            (value): value is string => typeof value === 'string' && value.length > 0,
        )

    return path?.toLowerCase() ?? ''
}

function getRequestIp(req: Request): string {
    const trustProxy = req.app.get('trust proxy')
    const forwardedForHeader = req.headers['x-forwarded-for']

    if (
        trustProxy &&
        typeof forwardedForHeader === 'string' &&
        forwardedForHeader.trim().length > 0
    ) {
        return forwardedForHeader.split(',')[0].trim()
    }

    return req.ip || 'unknown'
}
