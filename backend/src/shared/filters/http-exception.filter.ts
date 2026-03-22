import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Request, Response } from 'express'
import { logger } from '../utils/logger'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp()
        const response = ctx.getResponse<Response>()
        const request = ctx.getRequest<Request>()

        let statusCode = HttpStatus.INTERNAL_SERVER_ERROR
        let message: string | string[] = 'Internal server error'
        let error = 'Internal Server Error'

        if (
            exception instanceof HttpException ||
            (exception && typeof exception === 'object' && 'getStatus' in exception)
        ) {
            const httpException = exception as HttpException
            statusCode = httpException.getStatus()
            const exceptionResponse = httpException.getResponse()

            if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                const res = exceptionResponse as Record<string, unknown>
                message = (res.message as string | string[]) || httpException.message
                error = (res.error as string) || httpException.name
            } else if (typeof exceptionResponse === 'string') {
                message = exceptionResponse
                error = httpException.name
            } else {
                message = httpException.message
                error = httpException.name
            }
        } else if (exception instanceof Error) {
            // Keep default "Internal server error" message for generic errors
            // but the original error is available in the 'exception' variable for logging
        }

        const responseBody: Record<string, unknown> = {
            statusCode,
            message,
            error,
        }

        if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
            responseBody.stack = exception.stack
        }

        logger.error(exception instanceof Error ? exception.message : String(exception), {
            request_id: request.id,
            context: {
                method: request.method,
                path: request.originalUrl,
                status_code: statusCode,
                stack: exception instanceof Error ? exception.stack : undefined,
            },
        })

        response.status(statusCode).json(responseBody)
    }
}
