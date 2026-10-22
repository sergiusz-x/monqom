import {
    BadRequestException,
    CallHandler,
    ExecutionContext,
    HttpException,
    Injectable,
    NestInterceptor,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { catchError, type Observable } from 'rxjs'
import { IdempotencyInProgressException } from './external-transaction-ownership.service'
import { normalizeIdempotencyKey } from './external-transaction-contract'
import { externalBodyError } from './external-api-body.middleware'

/** Validate protocol fields once, after machine authorization and before DTO/controller execution. */
@Injectable()
export class ExternalTransactionsInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest<Request>()
        const response = context.switchToHttp().getResponse<Response>()
        const parseError = externalBodyError(request)
        if (parseError)
            throw new HttpException(
                {
                    statusCode: parseError,
                    message:
                        parseError === 413
                            ? 'Request body exceeds 64 KiB'
                            : parseError === 415
                              ? 'Content-Type must be application/json'
                              : 'Request body must be valid JSON',
                    error:
                        parseError === 413
                            ? 'Payload Too Large'
                            : parseError === 415
                              ? 'Unsupported Media Type'
                              : 'Bad Request',
                    code:
                        parseError === 413
                            ? 'PAYLOAD_TOO_LARGE'
                            : parseError === 415
                              ? 'UNSUPPORTED_MEDIA_TYPE'
                              : 'VALIDATION_ERROR',
                },
                parseError,
            )
        if (Object.keys(request.query).length)
            throw new BadRequestException('Query parameters are not supported')
        const method = request.method.toUpperCase()
        if (['POST', 'PUT', 'DELETE'].includes(method)) {
            const keyCount = headerCount(request, 'idempotency-key')
            if (keyCount > 1 || (method !== 'POST' && keyCount !== 1))
                throw new BadRequestException('Send one Idempotency-Key header')
            if (keyCount) normalizeIdempotencyKey(request.get('idempotency-key')!)
        }
        if (['PUT', 'DELETE'].includes(method) && headerCount(request, 'if-match') > 1)
            throw new BadRequestException('Send one If-Match header')
        if (
            ['GET', 'HEAD', 'DELETE'].includes(method) &&
            request.body !== undefined &&
            (typeof request.body !== 'object' ||
                request.body === null ||
                Object.keys(request.body).length)
        )
            throw new BadRequestException('This operation does not accept a request body')
        return next.handle().pipe(
            catchError((error: unknown) => {
                if (error instanceof IdempotencyInProgressException)
                    response.setHeader('Retry-After', String(error.retryAfterSeconds))
                throw error
            }),
        )
    }
}

function headerCount(request: Request, name: string): number {
    return request.rawHeaders.filter(
        (value, index) => index % 2 === 0 && value.toLowerCase() === name,
    ).length
}
