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
    Req,
    UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { ApiParam, ApiTags } from '@nestjs/swagger'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { CreateGoalDto, GoalOperationDto, ListGoalsQueryDto, UpdateGoalDto } from './goals.dto'
import { GOALS_BASE_ROUTE } from './goals.routes'
import { GoalsService } from './goals.service'
import { ApiGoalOperationResponse, ApiGoalResponse } from '../../shared/openapi/response-schemas'

@Controller(GOALS_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
@ApiTags('Goals')
@ApiParam({ name: 'workspaceId', type: String })
export class GoalsController {
    constructor(private readonly goalsService: GoalsService) {}

    @Get()
    @ApiGoalResponse(true)
    list(@Query() query: ListGoalsQueryDto, @Req() req: Request) {
        return this.goalsService.list(req.workspace!.workspaceId, query.include_archived === 'true')
    }

    @Get(':goalId')
    @ApiGoalResponse()
    get(@Param('goalId') goalId: string, @Req() req: Request) {
        return this.goalsService.get(req.workspace!.workspaceId, goalId)
    }

    @Post()
    @ApiGoalResponse(false, HttpStatus.CREATED)
    @HttpCode(HttpStatus.CREATED)
    create(@Body() body: CreateGoalDto, @Req() req: Request) {
        return this.goalsService.create(req.workspace!.workspaceId, req.session.auth!.userId, body)
    }

    @Patch(':goalId')
    @ApiGoalResponse()
    update(@Param('goalId') goalId: string, @Body() body: UpdateGoalDto, @Req() req: Request) {
        return this.goalsService.update(
            req.workspace!.workspaceId,
            req.session.auth!.userId,
            goalId,
            body,
        )
    }

    @Post(':goalId/archive')
    @ApiGoalResponse()
    @HttpCode(HttpStatus.OK)
    archive(@Param('goalId') goalId: string, @Req() req: Request) {
        return this.goalsService.setArchived(
            req.workspace!.workspaceId,
            req.session.auth!.userId,
            goalId,
            true,
        )
    }

    @Post(':goalId/restore')
    @ApiGoalResponse()
    @HttpCode(HttpStatus.OK)
    restore(@Param('goalId') goalId: string, @Req() req: Request) {
        return this.goalsService.setArchived(
            req.workspace!.workspaceId,
            req.session.auth!.userId,
            goalId,
            false,
        )
    }

    @Delete(':goalId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('goalId') goalId: string, @Req() req: Request): Promise<void> {
        await this.goalsService.delete(req.workspace!.workspaceId, req.session.auth!.userId, goalId)
    }

    @Post(':goalId/operations')
    @ApiGoalOperationResponse(HttpStatus.CREATED)
    @HttpCode(HttpStatus.CREATED)
    createOperation(
        @Param('goalId') goalId: string,
        @Body() body: GoalOperationDto,
        @Req() req: Request,
    ) {
        return this.goalsService.createOperation(
            req.workspace!.workspaceId,
            req.session.auth!.userId,
            goalId,
            body,
        )
    }

    @Patch(':goalId/operations/:operationId')
    @ApiGoalOperationResponse()
    updateOperation(
        @Param('goalId') goalId: string,
        @Param('operationId') operationId: string,
        @Body() body: GoalOperationDto,
        @Req() req: Request,
    ) {
        return this.goalsService.updateOperation(
            req.workspace!.workspaceId,
            req.session.auth!.userId,
            goalId,
            operationId,
            body,
        )
    }

    @Delete(':goalId/operations/:operationId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteOperation(
        @Param('goalId') goalId: string,
        @Param('operationId') operationId: string,
        @Req() req: Request,
    ): Promise<void> {
        await this.goalsService.deleteOperation(
            req.workspace!.workspaceId,
            req.session.auth!.userId,
            goalId,
            operationId,
        )
    }
}
