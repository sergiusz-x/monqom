import {
    Injectable,
    OnModuleDestroy,
    OnModuleInit,
    ServiceUnavailableException,
} from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { createHash } from 'crypto'
import { PrismaService } from '../../shared/database/prisma.service'
import { normalizeIntegrationClientIp } from './integration-network-policy'

const REQUEST_WINDOW_MS = 60_000
const AUTH_FAILURE_WINDOW_MS = 5 * 60_000
const CREDENTIAL_REQUEST_LIMIT = 120
const CREDENTIAL_MUTATION_LIMIT = 60
const SOURCE_FAILURE_LIMIT = 20
const SOURCE_BLOCK_MS = 15 * 60_000
const MANAGEMENT_STEP_UP_WINDOW_MS = 15 * 60_000
const MANAGEMENT_USER_ATTEMPT_LIMIT = 5
const MANAGEMENT_SOURCE_ATTEMPT_LIMIT = 20

export class IntegrationRateLimitExceededError extends Error {
    constructor(readonly retryAfterSeconds: number) {
        super('Integration rate limit exceeded')
    }
}

interface LimitState {
    request_times: Date[]
    mutation_times: Date[]
    blocked_until: Date | null
}

@Injectable()
export class IntegrationRateLimitService implements OnModuleInit, OnModuleDestroy {
    private cleanupTimer?: ReturnType<typeof setInterval>

    constructor(private readonly prisma: PrismaService) {}

    onModuleInit(): void {
        const cleanup = () => {
            void this.cleanupExpired().catch(() => undefined)
        }
        cleanup()
        this.cleanupTimer = setInterval(cleanup, 60 * 60_000)
        this.cleanupTimer.unref()
    }

    onModuleDestroy(): void {
        if (this.cleanupTimer) clearInterval(this.cleanupTimer)
    }

    async consumeCredential(
        credentialId: string,
        now?: Date,
        mutation = false,
        workspaceId = '',
    ): Promise<void> {
        // One locked row makes total and mutation decisions atomic across replicas.
        const retryAfter = await this.withState(
            rateLimitKey('credential', `${workspaceId}:${credentialId}`),
            now,
            async (tx, keyHash, state, now) => {
                const requests = rollingTimes(state.request_times, now, REQUEST_WINDOW_MS)
                const mutations = rollingTimes(state.mutation_times, now, REQUEST_WINDOW_MS)
                let until: Date | undefined
                if (requests.length >= CREDENTIAL_REQUEST_LIMIT)
                    until = expiresFirst(requests, REQUEST_WINDOW_MS)
                if (mutation && mutations.length >= CREDENTIAL_MUTATION_LIMIT) {
                    const mutationUntil = expiresFirst(mutations, REQUEST_WINDOW_MS)
                    if (!until || mutationUntil > until) until = mutationUntil
                }
                // Rejected mutations still consume the total budget while it has room.
                if (requests.length < CREDENTIAL_REQUEST_LIMIT) requests.push(now)
                if (!until && mutation) mutations.push(now)
                await tx.integrationRateLimit.update({
                    where: { keyHash },
                    data: {
                        requestTimes: requests,
                        mutationTimes: mutations,
                        blockedUntil: null,
                        expiresAt: new Date(now.getTime() + REQUEST_WINDOW_MS),
                    },
                })
                return until ? remainingSeconds(until, now) : null
            },
        )
        if (retryAfter !== null) throw new IntegrationRateLimitExceededError(retryAfter)
    }

    async assertSourceAllowed(clientIp: string | undefined, now?: Date): Promise<void> {
        try {
            const rows = await this.prisma.$queryRaw<
                { blocked_until: Date | null; checked_at: Date }[]
            >`
                SELECT "blocked_until", (clock_timestamp() AT TIME ZONE 'UTC') AS "checked_at"
                FROM "integration_rate_limits" WHERE "key_hash" = ${sourceKey(clientIp)}
            `
            const state = rows[0]
            const checkedAt = now ?? state?.checked_at
            if (state?.blocked_until && checkedAt && state.blocked_until > checkedAt) {
                throw new IntegrationRateLimitExceededError(
                    remainingSeconds(state.blocked_until, checkedAt),
                )
            }
        } catch (error) {
            if (error instanceof IntegrationRateLimitExceededError) throw error
            throw unavailable()
        }
    }

    async consumeFailedAuthentication(clientIp: string | undefined, now?: Date): Promise<void> {
        const retryAfter = await this.withState(
            sourceKey(clientIp),
            now,
            async (tx, keyHash, state, now) => {
                if (state.blocked_until && state.blocked_until > now) {
                    return remainingSeconds(state.blocked_until, now)
                }
                const requests = rollingTimes(state.request_times, now, AUTH_FAILURE_WINDOW_MS)
                const blockedUntil =
                    requests.length + 1 >= SOURCE_FAILURE_LIMIT
                        ? new Date(now.getTime() + SOURCE_BLOCK_MS)
                        : null
                if (!blockedUntil) requests.push(now)
                await tx.integrationRateLimit.update({
                    where: { keyHash },
                    data: {
                        requestTimes: requests,
                        mutationTimes: [],
                        blockedUntil,
                        expiresAt: blockedUntil ?? new Date(now.getTime() + AUTH_FAILURE_WINDOW_MS),
                    },
                })
                return blockedUntil ? remainingSeconds(blockedUntil, now) : null
            },
        )
        if (retryAfter !== null) throw new IntegrationRateLimitExceededError(retryAfter)
    }

    async consumeManagementStepUp(
        userId: string,
        clientIp: string | undefined,
        now?: Date,
    ): Promise<void> {
        // Share one user budget across workspaces, sessions and high-risk management actions.
        // The source budget also bounds attempts spread over different human accounts.
        const budgets: [string, number][] = [
            [rateLimitKey('management-step-up-user', userId), MANAGEMENT_USER_ATTEMPT_LIMIT],
            [
                rateLimitKey(
                    'management-step-up-source',
                    normalizeIntegrationClientIp(clientIp) ?? 'unknown',
                ),
                MANAGEMENT_SOURCE_ATTEMPT_LIMIT,
            ],
        ]
        for (const [keyHash, limit] of budgets) {
            const retryAfter = await this.withState(
                keyHash,
                now,
                async (tx, keyHash, state, checkedAt) => {
                    const requests = rollingTimes(
                        state.request_times,
                        checkedAt,
                        MANAGEMENT_STEP_UP_WINDOW_MS,
                    )
                    const until =
                        requests.length >= limit
                            ? expiresFirst(requests, MANAGEMENT_STEP_UP_WINDOW_MS)
                            : null
                    if (!until) requests.push(checkedAt)
                    await tx.integrationRateLimit.update({
                        where: { keyHash },
                        data: {
                            requestTimes: requests,
                            mutationTimes: [],
                            blockedUntil: null,
                            expiresAt: new Date(checkedAt.getTime() + MANAGEMENT_STEP_UP_WINDOW_MS),
                        },
                    })
                    return until ? remainingSeconds(until, checkedAt) : null
                },
            )
            if (retryAfter !== null) throw new IntegrationRateLimitExceededError(retryAfter)
        }
    }

    async cleanupExpired(now?: Date): Promise<number> {
        try {
            return await this.prisma.$executeRaw`
                DELETE FROM "integration_rate_limits"
                WHERE "expires_at" <= COALESCE(${now ?? null}::timestamp, clock_timestamp() AT TIME ZONE 'UTC')
                  AND ("blocked_until" IS NULL OR "blocked_until" <= COALESCE(${now ?? null}::timestamp, clock_timestamp() AT TIME ZONE 'UTC'))
            `
        } catch {
            throw unavailable()
        }
    }

    private async withState(
        keyHash: string,
        now: Date | undefined,
        operation: (
            tx: Prisma.TransactionClient,
            keyHash: string,
            state: LimitState,
            checkedAt: Date,
        ) => Promise<number | null>,
    ): Promise<number | null> {
        try {
            return await this.prisma.$transaction(async (tx) => {
                await tx.$executeRaw`
                    INSERT INTO "integration_rate_limits" ("key_hash", "expires_at", "updated_at")
                    VALUES (${keyHash}, clock_timestamp() AT TIME ZONE 'UTC', clock_timestamp() AT TIME ZONE 'UTC') ON CONFLICT ("key_hash") DO NOTHING
                `
                const rows = await tx.$queryRaw<LimitState[]>`
                    SELECT "request_times", "mutation_times", "blocked_until"
                    FROM "integration_rate_limits" WHERE "key_hash" = ${keyHash} FOR UPDATE
                `
                if (!rows[0]) throw unavailable()
                const clock = await tx.$queryRaw<
                    { checked_at: Date }[]
                >`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS "checked_at"`
                const checkedAt = now ?? clock[0]?.checked_at
                if (!checkedAt) throw unavailable()
                return operation(tx, keyHash, rows[0], checkedAt)
            })
        } catch {
            throw unavailable()
        }
    }
}

function sourceKey(clientIp: string | undefined): string {
    return rateLimitKey('failed-auth-source', normalizeIntegrationClientIp(clientIp) ?? 'unknown')
}

function rateLimitKey(dimension: string, value: string): string {
    return createHash('sha256')
        .update(`monqom-integration-rate-limit:v2:${dimension}:${value}`, 'utf8')
        .digest('hex')
}

function rollingTimes(times: Date[], now: Date, windowMs: number): Date[] {
    // All replicas use the database clock; keep future timestamps conservatively after clock changes.
    return times.filter((time) => time.getTime() > now.getTime() - windowMs)
}

function expiresFirst(times: Date[], windowMs: number): Date {
    return new Date(Math.min(...times.map((time) => time.getTime())) + windowMs)
}

function remainingSeconds(until: Date, now: Date): number {
    return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000))
}

function unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException('Integration authentication is unavailable')
}
