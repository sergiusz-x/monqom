import { registerAs } from '@nestjs/config'

export interface RuntimeConfig {
    port: number
    nodeEnv: 'development' | 'test' | 'staging' | 'production'
    databaseUrl?: string
    sessionSecret?: string
    totpEncryptionKey?: string
    frontendUrl?: string
    corsAllowedOrigins: string[]
    logLevel: string
    resendApiKey?: string
    emailFrom?: string
    turnstileSecretKey?: string
    turnstileEnabled: boolean
    appVersion: string
    gitSha: string
}

const SUPPORTED_ENVS = new Set(['development', 'test', 'staging', 'production'])

export default registerAs('env', (): RuntimeConfig => {
    const nodeEnv = parseNodeEnv(process.env.NODE_ENV)
    const config: RuntimeConfig = {
        port: parsePort(process.env.PORT),
        nodeEnv,
        databaseUrl: optional(process.env.DATABASE_URL),
        sessionSecret: optional(process.env.SESSION_SECRET),
        totpEncryptionKey: optional(process.env.TOTP_ENCRYPTION_KEY),
        frontendUrl: optional(process.env.FRONTEND_URL),
        corsAllowedOrigins: parseCorsAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS),
        logLevel: optional(process.env.LOG_LEVEL) ?? 'info',
        resendApiKey: optional(process.env.RESEND_API_KEY),
        emailFrom: optional(process.env.EMAIL_FROM),
        turnstileSecretKey: optional(process.env.TURNSTILE_SECRET_KEY),
        turnstileEnabled: parseBoolean(process.env.TURNSTILE_ENABLED, nodeEnv === 'production'),
        appVersion: optional(process.env.APP_VERSION) ?? 'dev',
        gitSha: optional(process.env.GIT_SHA) ?? 'unknown',
    }

    validateRuntimeConfig(config)
    return config
})

function validateRuntimeConfig(config: RuntimeConfig): void {
    if (!config.databaseUrl && config.nodeEnv !== 'test')
        throw new Error('DATABASE_URL environment variable is required')
    if (config.nodeEnv !== 'production') return

    const required = [
        ['SESSION_SECRET', config.sessionSecret],
        ['TOTP_ENCRYPTION_KEY', config.totpEncryptionKey],
        ['FRONTEND_URL', config.frontendUrl],
        ['RESEND_API_KEY', config.resendApiKey],
        ['EMAIL_FROM', config.emailFrom],
    ] as const
    const missing = required.filter(([, value]) => !value).map(([name]) => name)
    if (missing.length)
        throw new Error(`Missing required production environment variables: ${missing.join(', ')}`)
    if ((config.sessionSecret?.length ?? 0) < 32)
        throw new Error('SESSION_SECRET must contain at least 32 characters in production')
    if ((config.totpEncryptionKey?.length ?? 0) < 32)
        throw new Error('TOTP_ENCRYPTION_KEY must contain at least 32 characters in production')
    if (!isHttpsUrl(config.frontendUrl!))
        throw new Error('FRONTEND_URL must be an HTTPS URL in production')
    if (!config.corsAllowedOrigins.length)
        throw new Error('CORS_ALLOWED_ORIGINS is required in production')
    if (!config.corsAllowedOrigins.includes(config.frontendUrl!))
        throw new Error('CORS_ALLOWED_ORIGINS must include FRONTEND_URL in production')
    if (config.turnstileEnabled && !config.turnstileSecretKey)
        throw new Error('TURNSTILE_SECRET_KEY is required when TURNSTILE_ENABLED is true')
}

function parseNodeEnv(value: string | undefined): RuntimeConfig['nodeEnv'] {
    const nodeEnv = optional(value) ?? 'development'
    if (!SUPPORTED_ENVS.has(nodeEnv))
        throw new Error(`NODE_ENV must be one of: ${[...SUPPORTED_ENVS].join(', ')}`)
    return nodeEnv as RuntimeConfig['nodeEnv']
}
function parsePort(value: string | undefined): number {
    const port = Number(value ?? 3000)
    if (!Number.isInteger(port) || port < 1 || port > 65535)
        throw new Error('PORT must be an integer between 1 and 65535')
    return port
}
function parseCorsAllowedOrigins(input?: string): string[] {
    return (input ?? '')
        .split(',')
        .map((origin) => origin.trim().replace(/\/+$/, ''))
        .filter(Boolean)
}
function parseBoolean(value: string | undefined, fallback: boolean): boolean {
    if (value === undefined || value.trim() === '') return fallback
    if (value === 'true') return true
    if (value === 'false') return false
    throw new Error('TURNSTILE_ENABLED must be true or false')
}
function optional(value: string | undefined): string | undefined {
    const trimmed = value?.trim()
    return trimmed ? trimmed : undefined
}
function isHttpsUrl(value: string): boolean {
    try {
        return new URL(value).protocol === 'https:'
    } catch {
        return false
    }
}
