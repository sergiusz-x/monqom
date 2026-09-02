import { randomBytes } from 'crypto'
import session from 'express-session'
import type { CookieOptions as ResponseCookieOptions } from 'express'
import connectPgSimple from 'connect-pg-simple'
import { logger } from '../utils/logger'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const SESSION_STORE_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000)

export const SESSION_COOKIE_NAME = 'monqom.sid'
const SESSION_STORE_TABLE_NAME = 'user_sessions'

let generatedDevelopmentSessionSecret: string | undefined
let hasLoggedGeneratedSessionSecret = false

export interface SessionConfigurationInput {
    nodeEnv: string
    databaseUrl?: string
    sessionSecret?: string
}

export function createSessionOptions(input: SessionConfigurationInput): session.SessionOptions {
    const PgSessionStore = connectPgSimple(session)
    const shouldUsePostgresStore = isDeployedEnvironment(input.nodeEnv)

    if (shouldUsePostgresStore && !input.databaseUrl) {
        throw new Error(
            'DATABASE_URL environment variable is missing for the PostgreSQL session store',
        )
    }

    return {
        name: SESSION_COOKIE_NAME,
        secret: resolveSessionSecret(input),
        resave: false,
        saveUninitialized: false,
        proxy: shouldUsePostgresStore,
        cookie: createSessionCookieOptions(input.nodeEnv),
        store: shouldUsePostgresStore
            ? new PgSessionStore({
                  conString: input.databaseUrl,
                  createTableIfMissing: false,
                  tableName: SESSION_STORE_TABLE_NAME,
                  ttl: SESSION_STORE_TTL_SECONDS,
              })
            : undefined,
    }
}

export function createSessionCookieOptions(nodeEnv: string): session.CookieOptions {
    return {
        httpOnly: true,
        maxAge: SESSION_TTL_MS,
        path: '/',
        sameSite: 'lax',
        secure: isDeployedEnvironment(nodeEnv),
    }
}

export function createSessionCookieClearingOptions(nodeEnv: string): ResponseCookieOptions {
    return {
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        secure: isDeployedEnvironment(nodeEnv),
    }
}

function resolveSessionSecret(input: SessionConfigurationInput): string {
    const configuredSessionSecret = input.sessionSecret?.trim()

    if (configuredSessionSecret) {
        return configuredSessionSecret
    }

    if (isDeployedEnvironment(input.nodeEnv)) {
        throw new Error('SESSION_SECRET environment variable is missing')
    }

    generatedDevelopmentSessionSecret ??= randomBytes(32).toString('hex')

    if (!hasLoggedGeneratedSessionSecret) {
        logger.warn(
            'SESSION_SECRET environment variable is missing. Generated an ephemeral session secret.',
            {
                context_name: 'SessionConfig',
            },
        )
        hasLoggedGeneratedSessionSecret = true
    }

    return generatedDevelopmentSessionSecret
}

function isDeployedEnvironment(nodeEnv: string): boolean {
    return nodeEnv === 'production' || nodeEnv === 'staging'
}
