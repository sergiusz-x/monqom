import { LoggerService } from '@nestjs/common'
import { createLogger, format, transports, Logger, Logform } from 'winston'

const { combine, errors, json, printf, timestamp } = format
const colorizer = format.colorize()

const DEV_RESERVED_FIELDS = new Set([
    'context_name',
    'level',
    'message',
    'request_id',
    'service',
    'stack',
    'timestamp',
])

type SupportedLogLevel = 'debug' | 'error' | 'info' | 'verbose' | 'warn'

const devFormat = printf((info: Logform.TransformableInfo) => {
    const contextName = resolveContextName(info)
    const details = formatLogDetails(info)
    const level = colorizer.colorize(
        String(info.level),
        String(info.level).toUpperCase().padEnd(5, ' '),
    )
    const message = `${info.timestamp} ${level} [${contextName}] ${String(info.message)}${details}`

    if (typeof info.stack === 'string' && info.stack.length > 0) {
        return `${message}\n${info.stack}`
    }

    return message
})

export const logger: Logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: 'api' },
    format: combine(
        errors({ stack: true }),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        process.env.NODE_ENV === 'production' ? json() : devFormat,
    ),
    transports: [new transports.Console()],
})

export class AppLogger implements LoggerService {
    log(message: unknown, ...optionalParams: unknown[]): void {
        this.write('info', message, {
            context_name: getContextName(optionalParams),
        })
    }

    error(message: unknown, ...optionalParams: unknown[]): void {
        const { contextName, stack } = getErrorMetadata(optionalParams)

        this.write('error', message, {
            context_name: contextName,
            stack,
        })
    }

    warn(message: unknown, ...optionalParams: unknown[]): void {
        this.write('warn', message, {
            context_name: getContextName(optionalParams),
        })
    }

    debug(message: unknown, ...optionalParams: unknown[]): void {
        this.write('debug', message, {
            context_name: getContextName(optionalParams),
        })
    }

    verbose(message: unknown, ...optionalParams: unknown[]): void {
        this.write('verbose', message, {
            context_name: getContextName(optionalParams),
        })
    }

    fatal(message: unknown, ...optionalParams: unknown[]): void {
        this.write('error', message, {
            context_name: getContextName(optionalParams),
        })
    }

    private write(
        level: SupportedLogLevel,
        message: unknown,
        metadata: Record<string, unknown>,
    ): void {
        logger.log(level, normalizeMessage(message), removeUndefinedValues(metadata))
    }
}

export const appLogger = new AppLogger()

function resolveContextName(info: Logform.TransformableInfo): string {
    if (typeof info.context_name === 'string' && info.context_name.length > 0) {
        return info.context_name
    }

    if (typeof info.service === 'string' && info.service.length > 0) {
        return info.service
    }

    return 'App'
}

function formatLogDetails(info: Logform.TransformableInfo): string {
    const parts: string[] = []

    if (typeof info.request_id === 'string' && info.request_id.length > 0) {
        parts.push(`req=${info.request_id}`)
    }

    for (const [key, value] of Object.entries(info)) {
        if (DEV_RESERVED_FIELDS.has(key) || value === undefined) {
            continue
        }

        parts.push(`${key}=${formatValue(value)}`)
    }

    return parts.length > 0 ? ` ${parts.join(' ')}` : ''
}

function formatValue(value: unknown): string {
    if (typeof value === 'string') {
        return /\s/.test(value) ? JSON.stringify(value) : value
    }

    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value)
    }

    if (value instanceof Date) {
        return value.toISOString()
    }

    if (value === null) {
        return 'null'
    }

    return JSON.stringify(value)
}

function normalizeMessage(message: unknown): string {
    if (typeof message === 'string') {
        return message
    }

    if (message instanceof Error) {
        return message.message
    }

    return JSON.stringify(message)
}

function getContextName(optionalParams: unknown[]): string | undefined {
    const [firstParam] = optionalParams

    return typeof firstParam === 'string' ? firstParam : undefined
}

function getErrorMetadata(optionalParams: unknown[]): {
    contextName?: string
    stack?: string
} {
    if (optionalParams.length === 0) {
        return {}
    }

    if (optionalParams.length === 1 && typeof optionalParams[0] === 'string') {
        return looksLikeStack(optionalParams[0])
            ? { stack: optionalParams[0] }
            : { contextName: optionalParams[0] }
    }

    const [possibleStack, possibleContext] = optionalParams

    return {
        stack: typeof possibleStack === 'string' ? possibleStack : undefined,
        contextName: typeof possibleContext === 'string' ? possibleContext : undefined,
    }
}

function looksLikeStack(value: string): boolean {
    return value.includes('\n') || value.includes(' at ')
}

function removeUndefinedValues(metadata: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(metadata).filter(([, value]) => value !== undefined))
}
