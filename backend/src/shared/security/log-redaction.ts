import type { Request } from 'express'

const SECRET_FIELD =
    /^(?:authorization|proxy-authorization|cookie|set-cookie|password|current_password|two_factor_token|passwordHash|password_hash|token|access_token|secret|tokenDigest|token_digest|idempotency[-_]key|sessionSecret|session_secret|body|payload)$/i
const URL_FIELD = /^(?:url|originalUrl|original_url|request_uri)$/i

export function redactSensitiveText(value: string): string {
    return value
        .replace(/\bmqic(?:_|%5f)[A-Za-z0-9_%.-]+/gi, '[REDACTED]')
        .replace(/\bBearer\s+[^\s"',;]+/gi, 'Bearer [REDACTED]')
        .replace(
            /\b(?:authorization|idempotency[-_]key|token[-_]?digest|token|access_token|api_key|secret|current_password|two_factor_token|password)["']?\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
            '[REDACTED]',
        )
        .replace(/(https?:\/\/[^\s?#]+)\?[^\s#]*/gi, '$1')
}

export function safeRequestLogPath(request: Pick<Request, 'originalUrl'>): string {
    return redactSensitiveText(request.originalUrl.split(/[?#]/, 1)[0] ?? '/').replace(
        /[\r\n\u0000-\u001f\u007f]/g,
        '',
    )
}

export function isMachineApiRequest(request: Pick<Request, 'originalUrl'>): boolean {
    return /^\/api\/v1\/workspaces\/[^/]+\/(?:external-|integrations(?:\/|$))/i.test(
        request.originalUrl.split('?', 1)[0] ?? '',
    )
}

export function redactSensitiveValue(value: unknown, seen = new WeakSet<object>()): unknown {
    if (typeof value === 'string') return redactSensitiveText(value)
    if (value === null || typeof value !== 'object' || value instanceof Date) return value
    if (seen.has(value)) return '[Circular]'
    seen.add(value)
    if (Array.isArray(value)) return value.map((entry) => redactSensitiveValue(entry, seen))
    const result: Record<string | symbol, unknown> = {}
    for (const key of Reflect.ownKeys(value)) {
        const entry = (value as Record<string | symbol, unknown>)[key]
        result[key] =
            typeof key === 'string' && SECRET_FIELD.test(key)
                ? '[REDACTED]'
                : typeof key === 'string' && URL_FIELD.test(key) && typeof entry === 'string'
                  ? redactSensitiveText(entry.split(/[?#]/, 1)[0] ?? '')
                  : redactSensitiveValue(entry, seen)
    }
    return result
}
