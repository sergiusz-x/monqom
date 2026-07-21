import {
    BadRequestException,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common'
import type { Request } from 'express'
import { WorkspaceRepository } from '../../modules/workspace/workspace.repository'

const AUTHENTICATION_REQUIRED_MESSAGE = 'Authentication required'
const WORKSPACE_ACCESS_FORBIDDEN_MESSAGE = 'Forbidden'
const WORKSPACE_HEADER_NAME = 'x-workspace-id'
const WORKSPACE_ID_REQUIRED_MESSAGE = 'Workspace id is required'
const WORKSPACE_NOT_FOUND_MESSAGE = 'Workspace not found'

@Injectable()
export class WorkspaceGuard implements CanActivate {
    constructor(private readonly workspaceRepository: WorkspaceRepository) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>()
        const workspaceId = getWorkspaceIdFromRequest(request)
        const userId = request.session?.auth?.userId?.trim()

        if (!workspaceId) {
            throw new BadRequestException(WORKSPACE_ID_REQUIRED_MESSAGE)
        }

        if (!userId) {
            throw new UnauthorizedException(AUTHENTICATION_REQUIRED_MESSAGE)
        }

        const workspaceAccess = await this.workspaceRepository.findWorkspaceAccess(
            userId,
            workspaceId,
        )

        if (!workspaceAccess) {
            const workspace = await this.workspaceRepository.findWorkspaceById(workspaceId)

            if (!workspace) {
                throw new NotFoundException(WORKSPACE_NOT_FOUND_MESSAGE)
            }

            throw new ForbiddenException(WORKSPACE_ACCESS_FORBIDDEN_MESSAGE)
        }

        request.workspace = {
            workspaceId: workspaceAccess.workspaceId,
            role: workspaceAccess.role,
        }

        return true
    }
}

function getWorkspaceIdFromRequest(request: Request): string | null {
    const routeWorkspaceId = normalizeWorkspaceValue(request.params?.workspaceId)

    if (routeWorkspaceId) {
        return routeWorkspaceId
    }

    return normalizeWorkspaceValue(request.headers[WORKSPACE_HEADER_NAME])
}

function normalizeWorkspaceValue(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
        for (const entry of value) {
            const normalizedValue = normalizeWorkspaceValue(entry)

            if (normalizedValue) {
                return normalizedValue
            }
        }

        return null
    }
    if (typeof value !== 'string') {
        return null
    }

    const normalizedValue = value.trim()

    return normalizedValue.length > 0 ? normalizedValue : null
}
