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
        const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
        const metadata = {
            context_name: 'HTTP',
            request_id: req.id,
        }

        if (res.statusCode >= 500) {
            logger.error(message, metadata)
            return
        }

        if (res.statusCode >= 400) {
            logger.warn(message, metadata)
            return
        }

        logger.info(message, metadata)
    })

    next()
}
