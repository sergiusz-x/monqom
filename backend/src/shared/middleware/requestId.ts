import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

const MAX_REQUEST_ID_LENGTH = 128
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/

/**
 * Extend Express Request interface to include id.
 */
// Express declaration merging requires augmenting its namespace.
/* eslint-disable @typescript-eslint/no-namespace */
declare global {
    namespace Express {
        interface Request {
            id: string
        }
    }
}
/* eslint-enable @typescript-eslint/no-namespace */

/**
 * Middleware that generates and assigns a unique request ID.
 * It also sets the 'x-request-id' header on the response.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const suppliedId = req.headers['x-request-id']
    const id = isSafeRequestId(suppliedId) ? suppliedId : crypto.randomUUID()

    req.id = id
    res.setHeader('x-request-id', id)

    next()
}

function isSafeRequestId(value: string | string[] | undefined): value is string {
    return (
        typeof value === 'string' &&
        value.length > 0 &&
        value.length <= MAX_REQUEST_ID_LENGTH &&
        REQUEST_ID_PATTERN.test(value)
    )
}
