import { Body, Controller, Get, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common'
import { ApiParam } from '@nestjs/swagger'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { RequireWorkspaceRole, WorkspaceRoleGuard } from '../../shared/guards/workspace-role.guard'
import { WorkspaceService } from './workspace.service'
import { WORKSPACE_BASE_ROUTE, WORKSPACE_SCOPED_BASE_ROUTE } from './workspace.routes'
import { UpdateWorkspaceDto } from './workspace.dto'
import { ApiWorkspaceResponse } from '../../shared/openapi/response-schemas'
import { CurrentUserId, CurrentWorkspaceId } from '../../shared/http/request-context.decorator'

@Controller(WORKSPACE_BASE_ROUTE)
@UseGuards(SessionGuard)
export class WorkspaceController {
    constructor(private readonly workspaceService: WorkspaceService) {}

    @Get()
    @ApiWorkspaceResponse(true)
    @HttpCode(HttpStatus.OK)
    async listWorkspaces(@CurrentUserId() userId: string) {
        return this.workspaceService.listUserWorkspaces(userId)
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
    async getWorkspace(@CurrentWorkspaceId() workspaceId: string) {
        return this.workspaceService.getWorkspaceById(workspaceId)
    }

    @Put()
    @ApiWorkspaceResponse()
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('owner')
    @HttpCode(HttpStatus.OK)
    async updateWorkspace(
        @CurrentWorkspaceId() workspaceId: string,
        @Body() body: UpdateWorkspaceDto,
        @CurrentUserId() userId: string,
    ) {
        return this.workspaceService.updateWorkspaceSettings(
            workspaceId,
            {
                name: body.name,
                timezone: body.timezone,
                baseCurrency: body.base_currency,
            },
            userId,
        )
    }
}
