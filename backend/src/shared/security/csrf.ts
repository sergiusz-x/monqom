import { randomBytes, timingSafeEqual } from 'crypto'
import type { NextFunction, Request, Response } from 'express'

export const CSRF_HEADER_NAME = 'x-csrf-token'
export const CSRF_INVALID_CODE = 'CSRF_TOKEN_INVALID'
const CSRF_TOKEN_BYTES = 32
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function getOrCreateCsrfToken(req: Request): string {
    req.session.csrfToken ??= randomBytes(CSRF_TOKEN_BYTES).toString('base64url')
    return req.session.csrfToken
}

export function csrfProtectionMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
        next()
        return
    }

    const sessionToken = req.session.csrfToken
    const requestToken = req.get(CSRF_HEADER_NAME)

    if (!sessionToken || !requestToken || !tokensMatch(sessionToken, requestToken)) {
        res.status(403).json({
            statusCode: 403,
            message: 'Invalid CSRF token',
            error: 'Forbidden',
            code: CSRF_INVALID_CODE,
        })
        return
    }

    next()
}

function tokensMatch(expected: string, actual: string): boolean {
    const expectedBuffer = Buffer.from(expected)
    const actualBuffer = Buffer.from(actual)

    return (
        expectedBuffer.length === actualBuffer.length &&
        timingSafeEqual(expectedBuffer, actualBuffer)
    )
}
