import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'

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
    const id = (req.headers['x-request-id'] as string) || crypto.randomUUID()

    req.id = id
    res.setHeader('x-request-id', id)

    next()
}
