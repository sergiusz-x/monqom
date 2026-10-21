import {
    CallHandler,
    ExecutionContext,
    HttpException,
    Injectable,
    NestInterceptor,
    ServiceUnavailableException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'
import { catchError, from, mergeMap, type Observable } from 'rxjs'
import {
    IntegrationManagementAuditService,
    managementFailureStatus,
    managementOperation,
} from './integration-management-audit.service'

@Injectable()
export class IntegrationManagementInterceptor implements NestInterceptor {
    constructor(
        private readonly audit: IntegrationManagementAuditService,
        private readonly reflector: Reflector,
    ) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest<Request>()
        const operation = managementOperation(this.reflector, context)
        const actor = {
            userId: request.session.auth?.userId,
            workspaceId: request.workspace?.workspaceId,
        }
        return next.handle().pipe(
            mergeMap(async (result: unknown) => {
                // Mutations record their success in the same transaction as the state change.
                if (operation === 'list' || operation === 'get')
                    await this.audit.read(request, operation, actor)
                return result
            }),
            catchError((error: unknown) =>
                from(
                    (async () => {
                        await this.audit.denied(
                            request,
                            operation,
                            actor,
                            managementFailureStatus(error),
                            'REQUEST',
                            true,
                        )
                        if (error instanceof HttpException) throw error
                        throw new ServiceUnavailableException(
                            'Integration management is unavailable',
                        )
                    })(),
                ),
            ),
        )
    }
}
