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
        let code: string | undefined

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
                code = typeof res.code === 'string' ? res.code : undefined
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

        code ??= errorCodeForStatus(statusCode)

        const responseBody: Record<string, unknown> = {
            statusCode,
            message,
            error,
        }

        responseBody.code = code

        if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
            responseBody.stack = exception.stack
        }

        if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
            logger.error(
                `${request.method} ${request.originalUrl} ${statusCode} ${formatLogMessage(message)}`,
                {
                    context_name: 'ExceptionsHandler',
                    request_id: request.id,
                    stack: exception instanceof Error ? exception.stack : undefined,
                },
            )
        }

        response.status(statusCode).json(responseBody)
    }
}

function errorCodeForStatus(status: number): string {
    const codes: Partial<Record<number, string>> = {
        [HttpStatus.BAD_REQUEST]: 'VALIDATION_ERROR',
        [HttpStatus.UNAUTHORIZED]: 'AUTHENTICATION_REQUIRED',
        [HttpStatus.FORBIDDEN]: 'ACCESS_DENIED',
        [HttpStatus.NOT_FOUND]: 'RESOURCE_NOT_FOUND',
        [HttpStatus.CONFLICT]: 'CONFLICT',
        [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
    }

    return codes[status] ?? 'INTERNAL_ERROR'
}

function formatLogMessage(message: string | string[]): string {
    if (Array.isArray(message)) {
        return message.join('; ')
    }

    return message
}
