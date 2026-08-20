import { createHash } from 'crypto'
import { Injectable, NestMiddleware } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { NextFunction, Request, Response } from 'express'
import { PrismaService } from '../database/prisma.service'

const AUTH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const DEFAULT_LIMIT = 5
const CLEANUP_INTERVAL = 100

interface AuthRateLimitPolicy {
    key: string
    message: string
    limit: number
}
interface ConsumedRateLimit {
    attempt_count: number
    blocked_until: Date | null
}

const DEFAULT_AUTH_RATE_LIMIT_POLICY: AuthRateLimitPolicy = {
    key: 'auth',
    message: 'Too many authentication attempts. Please try again later.',
    limit: DEFAULT_LIMIT,
}

const AUTH_RATE_LIMIT_POLICIES = [
    policy('/auth/csrf-token', 'csrf-token', 'Too many security token requests.', 60),
    policy('/auth/register', 'register', 'Too many registration attempts. Please try again later.'),
    policy('/auth/login', 'login', 'Too many login attempts. Please try again later.'),
    policy(
        '/auth/verify-email',
        'verify-email',
        'Too many email verification attempts. Please try again later.',
    ),
    policy(
        '/auth/forgot-password',
        'forgot-password',
        'Too many password reset requests. Please try again later.',
    ),
    policy(
        '/auth/reset-password',
        'reset-password',
        'Too many password reset attempts. Please try again later.',
    ),
    policy(
        '/auth/resend-verification',
        'resend-verification',
        'Too many verification email requests. Please try again later.',
    ),
    policy('/auth/2fa/setup', '2fa-setup', 'Too many two-factor setup attempts.'),
    policy(
        '/auth/2fa/verify-setup',
        '2fa-verify-setup',
        'Too many two-factor setup verification attempts.',
    ),
    policy('/auth/2fa/verify', '2fa-verify', 'Too many two-factor verification attempts.'),
    policy('/auth/2fa/disable', '2fa-disable', 'Too many two-factor disable attempts.'),
]

@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
    private requestsSinceCleanup = 0
    constructor(private readonly prisma: PrismaService) {}

    async use(req: Request, res: Response, next: NextFunction): Promise<void> {
        const now = new Date()
        const ratePolicy = getAuthRateLimitPolicy(req)
        try {
            const results = await this.prisma.$transaction(async (tx) => {
                const consumed: ConsumedRateLimit[] = []
                for (const key of getRateLimitKeys(req, ratePolicy))
                    consumed.push(await consumeRateLimit(tx, key, ratePolicy.limit, now))
                return consumed
            })

            if (results.some((result) => (result.blocked_until?.getTime() ?? 0) > now.getTime())) {
                res.setHeader('Retry-After', String(Math.ceil(AUTH_RATE_LIMIT_WINDOW_MS / 1000)))
                res.status(429).json({
                    statusCode: 429,
                    message: ratePolicy.message,
                    error: 'Too Many Requests',
                })
                return
            }

            this.requestsSinceCleanup += 1
            if (this.requestsSinceCleanup >= CLEANUP_INTERVAL) {
                this.requestsSinceCleanup = 0
                await this.prisma.authRateLimit.deleteMany({ where: { expiresAt: { lt: now } } })
            }
            next()
        } catch {
            res.status(503).json({
                statusCode: 503,
                message: 'Authentication protection is temporarily unavailable',
                error: 'Service Unavailable',
            })
        }
    }
}

async function consumeRateLimit(
    tx: Prisma.TransactionClient,
    keyHash: string,
    limit: number,
    now: Date,
): Promise<ConsumedRateLimit> {
    const expiresAt = new Date(now.getTime() + AUTH_RATE_LIMIT_WINDOW_MS)
    const rows = await tx.$queryRaw<ConsumedRateLimit[]>(Prisma.sql`
        INSERT INTO "auth_rate_limits" ("key_hash", "attempt_count", "window_started_at", "expires_at", "updated_at")
        VALUES (${keyHash}, 1, ${now}, ${expiresAt}, ${now})
        ON CONFLICT ("key_hash") DO UPDATE SET
            "attempt_count" = CASE WHEN "auth_rate_limits"."expires_at" <= ${now} THEN 1 ELSE "auth_rate_limits"."attempt_count" + 1 END,
            "window_started_at" = CASE WHEN "auth_rate_limits"."expires_at" <= ${now} THEN ${now} ELSE "auth_rate_limits"."window_started_at" END,
            "blocked_until" = CASE
                WHEN "auth_rate_limits"."blocked_until" > ${now} THEN "auth_rate_limits"."blocked_until"
                WHEN "auth_rate_limits"."expires_at" <= ${now} THEN NULL
                WHEN "auth_rate_limits"."attempt_count" + 1 > ${limit} THEN ${expiresAt}
                ELSE NULL
            END,
            "expires_at" = CASE WHEN "auth_rate_limits"."expires_at" <= ${now} THEN ${expiresAt} ELSE "auth_rate_limits"."expires_at" END,
            "updated_at" = ${now}
        RETURNING "attempt_count", "blocked_until"
    `)
    if (!rows[0]) throw new Error('Rate limiter did not return a result')
    return rows[0]
}

function policy(routeSuffix: string, key: string, message: string, limit = DEFAULT_LIMIT) {
    return { routeSuffix, policy: { key, message, limit } satisfies AuthRateLimitPolicy }
}

function getRateLimitKeys(req: Request, ratePolicy: AuthRateLimitPolicy): string[] {
    const keys = [hashRateLimitKey(ratePolicy.key, 'ip', req.ip || 'unknown')]
    const email = getRequestEmail(req)
    if (email) keys.push(hashRateLimitKey(ratePolicy.key, 'email', email))
    return keys
}

function hashRateLimitKey(policyKey: string, dimension: string, value: string): string {
    return createHash('sha256').update(`${policyKey}:${dimension}:${value}`).digest('hex')
}

function getRequestEmail(req: Request): string | undefined {
    const email = req.body?.email
    if (typeof email !== 'string') return undefined
    const normalized = email.trim().toLowerCase()
    return normalized.length > 0 ? normalized : undefined
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
    return (
        joinedPath ||
        [req.originalUrl, req.url].find(
            (value): value is string => typeof value === 'string' && value.length > 0,
        ) ||
        ''
    ).toLowerCase()
}
