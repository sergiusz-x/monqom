import { Controller, Get, HttpCode, HttpStatus, Param, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceService } from './workspace.service'
import { WORKSPACE_BASE_ROUTE, WORKSPACE_ROUTES } from './workspace.routes'

@Controller(WORKSPACE_BASE_ROUTE)
@UseGuards(SessionGuard)
export class WorkspaceController {
    constructor(private readonly workspaceService: WorkspaceService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    async listWorkspaces(@Req() req: Request) {
        return this.workspaceService.listUserWorkspaces(req.session.auth!.userId)
    }

    @Get(WORKSPACE_ROUTES.detail)
    @HttpCode(HttpStatus.OK)
    async getWorkspace(@Param('id') workspaceId: string, @Req() req: Request) {
        return this.workspaceService.getWorkspaceForUser(req.session.auth!.userId, workspaceId)
    }
}
