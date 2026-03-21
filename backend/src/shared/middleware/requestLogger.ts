import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger'

/**
 * Middleware that logs the incoming request and the outgoing response.
 * Calculates duration and includes the request metadata via winston logging.
 */
export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now()

    res.on('finish', () => {
        const duration = Date.now() - start

        logger.info(`HTTP ${req.method} ${req.originalUrl}`, {
            request_id: req.id,
            context: {
                method: req.method,
                path: req.originalUrl,
                status_code: res.statusCode,
                duration_ms: duration,
            },
        })
    })

    next()
}
