import {
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    Injectable,
    SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { Request } from 'express'

export type WorkspaceRole = 'member' | 'admin' | 'owner'
const WORKSPACE_ROLE_KEY = 'workspace-minimum-role'
const ROLE_RANK: Record<WorkspaceRole, number> = { member: 1, admin: 2, owner: 3 }

export const RequireWorkspaceRole = (role: WorkspaceRole) => SetMetadata(WORKSPACE_ROLE_KEY, role)

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const required = this.reflector.getAllAndOverride<WorkspaceRole>(WORKSPACE_ROLE_KEY, [
            context.getHandler(),
            context.getClass(),
        ])
        if (!required) return true
        const current = context.switchToHttp().getRequest<Request>().workspace?.role as
            WorkspaceRole | undefined
        if (!current || !ROLE_RANK[current] || ROLE_RANK[current] < ROLE_RANK[required]) {
            throw new ForbiddenException('Insufficient workspace permissions')
        }
        return true
    }
}
