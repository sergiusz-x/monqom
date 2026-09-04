import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { createHash } from 'crypto'
import { PrismaService } from '../../shared/database/prisma.service'

const REQUEST_WINDOW_MS = 60_000
const AUTH_FAILURE_WINDOW_MS = 5 * 60_000
const CREDENTIAL_REQUEST_LIMIT = 120
const SOURCE_FAILURE_LIMIT = 20
const SOURCE_BLOCK_MS = 15 * 60_000

export class IntegrationRateLimitExceededError extends Error {
    constructor(readonly retryAfterSeconds: number) {
        super('Integration rate limit exceeded')
    }
}

@Injectable()
export class IntegrationRateLimitService {
    constructor(private readonly prisma: PrismaService) {}

    async consumeCredential(credentialId: string, now = new Date()): Promise<void> {
        const result = await this.consume(
            rateLimitKey('credential', credentialId),
            CREDENTIAL_REQUEST_LIMIT,
            REQUEST_WINDOW_MS,
            REQUEST_WINDOW_MS,
            now,
        )
        if (result.blocked_until && result.blocked_until > now) {
            throw new IntegrationRateLimitExceededError(remainingSeconds(result.blocked_until, now))
        }
    }

    async consumeFailedAuthentication(
        clientIp: string | undefined,
        now = new Date(),
    ): Promise<void> {
        const result = await this.consume(
            rateLimitKey('failed-auth-source', clientIp || 'unknown'),
            SOURCE_FAILURE_LIMIT,
            AUTH_FAILURE_WINDOW_MS,
            SOURCE_BLOCK_MS,
            now,
        )
        if (result.blocked_until && result.blocked_until > now) {
            throw new IntegrationRateLimitExceededError(remainingSeconds(result.blocked_until, now))
        }
    }

    private async consume(
        keyHash: string,
        limit: number,
        windowMs: number,
        blockMs: number,
        now: Date,
    ): Promise<{ blocked_until: Date | null }> {
        const expiresAt = new Date(now.getTime() + windowMs)
        const blockedUntil = new Date(now.getTime() + blockMs)
        const rows = await this.prisma.$queryRaw<{ blocked_until: Date | null }[]>(Prisma.sql`
            INSERT INTO "auth_rate_limits" ("key_hash", "attempt_count", "window_started_at", "expires_at", "updated_at")
            VALUES (${keyHash}, 1, ${now}, ${expiresAt}, ${now})
            ON CONFLICT ("key_hash") DO UPDATE SET
                "attempt_count" = CASE WHEN "auth_rate_limits"."expires_at" <= ${now} THEN 1 ELSE "auth_rate_limits"."attempt_count" + 1 END,
                "window_started_at" = CASE WHEN "auth_rate_limits"."expires_at" <= ${now} THEN ${now} ELSE "auth_rate_limits"."window_started_at" END,
                "blocked_until" = CASE
                    WHEN "auth_rate_limits"."blocked_until" > ${now} THEN "auth_rate_limits"."blocked_until"
                    WHEN "auth_rate_limits"."expires_at" <= ${now} THEN NULL
                    WHEN "auth_rate_limits"."attempt_count" + 1 > ${limit} THEN ${blockedUntil}
                    ELSE NULL
                END,
                "expires_at" = CASE WHEN "auth_rate_limits"."expires_at" <= ${now} THEN ${expiresAt} ELSE "auth_rate_limits"."expires_at" END,
                "updated_at" = ${now}
            RETURNING "blocked_until"
        `)
        if (!rows[0]) throw new Error('Integration rate limiter did not return a result')
        return rows[0]
    }
}

function rateLimitKey(dimension: string, value: string): string {
    return createHash('sha256')
        .update(`monqom-integration-rate-limit:v1:${dimension}:${value}`, 'utf8')
        .digest('hex')
}

function remainingSeconds(until: Date, now: Date): number {
    return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000))
}
