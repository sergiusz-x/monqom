import { randomBytes, timingSafeEqual } from 'crypto'
import type { NextFunction, Request, Response } from 'express'

export const CSRF_HEADER_NAME = 'x-csrf-token'
export const CSRF_INVALID_CODE = 'CSRF_TOKEN_INVALID'
const CSRF_TOKEN_BYTES = 32
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const EXTERNAL_INTEGRATION_API_PATH =
    /^\/api\/v1\/workspaces\/[^/]+\/external-(?:transactions(?:\/[^/]+)?|categories|payment-sources)\/?$/

export function getOrCreateCsrfToken(req: Request): string {
    req.session.csrfToken ??= randomBytes(CSRF_TOKEN_BYTES).toString('base64url')
    return req.session.csrfToken
}

export function csrfProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (!isCsrfDenied(req)) {
        next()
        return
    }

    rejectCsrf(res)
}

export function createAuditedCsrfProtectionMiddleware(
    recordDenial: (request: Request) => Promise<void>,
) {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!isCsrfDenied(req)) {
            next()
            return
        }
        // Await the security evidence even when CSRF rejects before controller guards.
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Pragma', 'no-cache')
        void recordDenial(req)
            .then(() => rejectCsrf(res))
            .catch(() => {
                res.status(503).json({
                    statusCode: 503,
                    message: 'Security audit is unavailable',
                    error: 'Service Unavailable',
                    code: 'SERVICE_UNAVAILABLE',
                })
            })
    }
}

function isCsrfDenied(req: Request): boolean {
    if (SAFE_METHODS.has(req.method.toUpperCase()) || isExternalIntegrationApiRequest(req))
        return false

    const sessionToken = req.session.csrfToken
    const requestToken = req.get(CSRF_HEADER_NAME)

    return !sessionToken || !requestToken || !tokensMatch(sessionToken, requestToken)
}

function rejectCsrf(res: Response): void {
    res.status(403).json({
        statusCode: 403,
        message: 'Invalid CSRF token',
        error: 'Forbidden',
        code: CSRF_INVALID_CODE,
    })
}

function isExternalIntegrationApiRequest(req: Request): boolean {
    return EXTERNAL_INTEGRATION_API_PATH.test(req.path)
}

function tokensMatch(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected)
    const actualBuffer = Buffer.from(actual)

    return (
        expectedBuffer.length === actualBuffer.length &&
        timingSafeEqual(expectedBuffer, actualBuffer)
    )
}
