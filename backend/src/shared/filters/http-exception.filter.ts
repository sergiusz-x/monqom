import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { logger } from '../utils/logger';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Internal server error';
        let error = 'Internal Server Error';

        if (exception instanceof HttpException) {
            statusCode = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                const res = exceptionResponse as Record<string, any>;
                message = res.message || exception.message;
                error = res.error || exception.name;
            } else if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else {
                message = exception.message;
                error = exception.name;
            }
        } else if (exception instanceof Error) {
            // Keep default "Internal server error" message for generic errors
            // but the original error is available in the 'exception' variable for logging
        }

        const responseBody: Record<string, any> = {
            statusCode,
            message,
            error,
        };

        if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
            responseBody.stack = exception.stack;
        }

        logger.error(exception instanceof Error ? exception.message : String(exception), {
            request_id: (request as any).id,
            context: {
                method: request.method,
                path: request.originalUrl,
                status_code: statusCode,
                stack: exception instanceof Error ? exception.stack : undefined,
            },
        });

        response.status(statusCode).json(responseBody);
    }
}
