import { Body, Controller, Get, HttpCode, HttpStatus, Put, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { ApiParam } from '@nestjs/swagger'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { RequireWorkspaceRole, WorkspaceRoleGuard } from '../../shared/guards/workspace-role.guard'
import { WorkspaceService } from './workspace.service'
import { WORKSPACE_BASE_ROUTE, WORKSPACE_SCOPED_BASE_ROUTE } from './workspace.routes'
import { UpdateWorkspaceDto } from './workspace.dto'
import { ApiWorkspaceResponse } from '../../shared/openapi/response-schemas'

@Controller(WORKSPACE_BASE_ROUTE)
@UseGuards(SessionGuard)
export class WorkspaceController {
    constructor(private readonly workspaceService: WorkspaceService) {}

    @Get()
    @ApiWorkspaceResponse(true)
    @HttpCode(HttpStatus.OK)
    async listWorkspaces(@Req() req: Request) {
        return this.workspaceService.listUserWorkspaces(req.session.auth!.userId)
    }
}

@Controller(WORKSPACE_SCOPED_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
@ApiParam({ name: 'workspaceId', type: String })
export class WorkspaceScopedController {
    constructor(private readonly workspaceService: WorkspaceService) {}

    @Get()
    @ApiWorkspaceResponse()
    @HttpCode(HttpStatus.OK)
    async getWorkspace(@Req() req: Request) {
        return this.workspaceService.getWorkspaceById(req.workspace!.workspaceId)
    }

    @Put()
    @ApiWorkspaceResponse()
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('owner')
    @HttpCode(HttpStatus.OK)
    async updateWorkspace(@Req() req: Request, @Body() body: UpdateWorkspaceDto) {
        return this.workspaceService.updateWorkspaceSettings(
            req.workspace!.workspaceId,
            {
                name: body.name,
                timezone: body.timezone,
                baseCurrency: body.base_currency,
            },
            req.session.auth!.userId,
        )
    }
}
