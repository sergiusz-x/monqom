import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common'
import { ApiParam, ApiTags } from '@nestjs/swagger'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { RequireWorkspaceRole, WorkspaceRoleGuard } from '../../shared/guards/workspace-role.guard'
import { CreateGoalDto, GoalOperationDto, ListGoalsQueryDto, UpdateGoalDto } from './goals.dto'
import { GOALS_BASE_ROUTE } from './goals.routes'
import { GoalsService } from './goals.service'
import { ApiGoalOperationResponse, ApiGoalResponse } from '../../shared/openapi/response-schemas'
import { CurrentUserId, CurrentWorkspaceId } from '../../shared/http/request-context.decorator'

@Controller(GOALS_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
@ApiTags('Goals')
@ApiParam({ name: 'workspaceId', type: String })
export class GoalsController {
    constructor(private readonly goalsService: GoalsService) {}

    @Get()
    @ApiGoalResponse(true)
    list(@Query() query: ListGoalsQueryDto, @CurrentWorkspaceId() workspaceId: string) {
        return this.goalsService.list(workspaceId, query.include_archived === 'true')
    }

    @Get(':goalId')
    @ApiGoalResponse()
    get(@Param('goalId') goalId: string, @CurrentWorkspaceId() workspaceId: string) {
        return this.goalsService.get(workspaceId, goalId)
    }

    @Post()
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    @ApiGoalResponse(false, HttpStatus.CREATED)
    @HttpCode(HttpStatus.CREATED)
    create(
        @Body() body: CreateGoalDto,
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
    ) {
        return this.goalsService.create(workspaceId, userId, body)
    }

    @Patch(':goalId')
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    @ApiGoalResponse()
    update(
        @Param('goalId') goalId: string,
        @Body() body: UpdateGoalDto,
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
    ) {
        return this.goalsService.update(workspaceId, userId, goalId, body)
    }

    @Post(':goalId/archive')
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    @ApiGoalResponse()
    @HttpCode(HttpStatus.OK)
    archive(
        @Param('goalId') goalId: string,
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
    ) {
        return this.goalsService.setArchived(workspaceId, userId, goalId, true)
    }

    @Post(':goalId/restore')
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    @ApiGoalResponse()
    @HttpCode(HttpStatus.OK)
    restore(
        @Param('goalId') goalId: string,
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
    ) {
        return this.goalsService.setArchived(workspaceId, userId, goalId, false)
    }

    @Delete(':goalId')
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(
        @Param('goalId') goalId: string,
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
    ): Promise<void> {
        await this.goalsService.delete(workspaceId, userId, goalId)
    }

    @Post(':goalId/operations')
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    @ApiGoalOperationResponse(HttpStatus.CREATED)
    @HttpCode(HttpStatus.CREATED)
    createOperation(
        @Param('goalId') goalId: string,
        @Body() body: GoalOperationDto,
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
    ) {
        return this.goalsService.createOperation(workspaceId, userId, goalId, body)
    }

    @Patch(':goalId/operations/:operationId')
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    @ApiGoalOperationResponse()
    updateOperation(
        @Param('goalId') goalId: string,
        @Param('operationId') operationId: string,
        @Body() body: GoalOperationDto,
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
    ) {
        return this.goalsService.updateOperation(workspaceId, userId, goalId, operationId, body)
    }

    @Delete(':goalId/operations/:operationId')
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteOperation(
        @Param('goalId') goalId: string,
        @Param('operationId') operationId: string,
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
    ): Promise<void> {
        await this.goalsService.deleteOperation(workspaceId, userId, goalId, operationId)
    }
}
