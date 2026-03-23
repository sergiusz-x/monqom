import { Controller, Get, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { WorkspaceService } from './workspace.service'
import { WORKSPACE_BASE_ROUTE, WORKSPACE_SCOPED_BASE_ROUTE } from './workspace.routes'

@Controller(WORKSPACE_BASE_ROUTE)
@UseGuards(SessionGuard)
export class WorkspaceController {
    constructor(private readonly workspaceService: WorkspaceService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    async listWorkspaces(@Req() req: Request) {
        return this.workspaceService.listUserWorkspaces(req.session.auth!.userId)
    }
}

@Controller(WORKSPACE_SCOPED_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
export class WorkspaceScopedController {
    constructor(private readonly workspaceService: WorkspaceService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    async getWorkspace(@Req() req: Request) {
        return this.workspaceService.getWorkspaceById(req.workspace!.workspaceId)
    }
}
