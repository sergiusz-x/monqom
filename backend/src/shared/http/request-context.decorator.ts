import {
    BadRequestException,
    createParamDecorator,
    type ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'

const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required'
const WORKSPACE_CONTEXT_REQUIRED_MESSAGE = 'Workspace context is required'

export function getAuthenticatedUserId(request: Request): string {
    const userId = request.session?.auth?.userId

    if (!userId) {
        throw new UnauthorizedException(AUTHENTICATION_REQUIRED_MESSAGE)
    }

    return userId
}

export function getWorkspaceId(request: Request): string {
    const workspaceId = request.workspace?.workspaceId

    if (!workspaceId) {
        throw new BadRequestException(WORKSPACE_CONTEXT_REQUIRED_MESSAGE)
    }

    return workspaceId
}

export const CurrentUserId = createParamDecorator((_: unknown, context: ExecutionContext): string =>
    getAuthenticatedUserId(context.switchToHttp().getRequest<Request>()),
)

export const CurrentWorkspaceId = createParamDecorator(
    (_: unknown, context: ExecutionContext): string =>
        getWorkspaceId(context.switchToHttp().getRequest<Request>()),
)
