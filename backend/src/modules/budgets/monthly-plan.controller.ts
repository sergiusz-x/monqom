import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common'
import { ApiParam } from '@nestjs/swagger'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { RequireWorkspaceRole, WorkspaceRoleGuard } from '../../shared/guards/workspace-role.guard'
import { CurrentUserId, CurrentWorkspaceId } from '../../shared/http/request-context.decorator'
import { BUDGETS_BASE_ROUTE } from './budgets.routes'
import { ConfirmFundsDto, SaveGoalAllocationsDto } from './monthly-plan.dto'
import { MonthlyPlanService } from './monthly-plan.service'

@Controller(`${BUDGETS_BASE_ROUTE}/plan`)
@UseGuards(SessionGuard, WorkspaceGuard)
@ApiParam({ name: 'workspaceId', type: String })
export class MonthlyPlanController {
    constructor(private readonly plans: MonthlyPlanService) {}

    @Get(':month')
    get(@CurrentWorkspaceId() workspaceId: string, @Param('month') month: string) {
        return this.plans.get(workspaceId, month)
    }

    @Put(':month/funds')
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    confirmFunds(
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
        @Param('month') month: string,
        @Body() body: ConfirmFundsDto,
    ) {
        return this.plans.confirmFunds(workspaceId, userId, month, body)
    }

    @Put(':month/goals')
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    saveGoals(
        @CurrentWorkspaceId() workspaceId: string,
        @CurrentUserId() userId: string,
        @Param('month') month: string,
        @Body() body: SaveGoalAllocationsDto,
    ) {
        return this.plans.saveGoals(workspaceId, userId, month, body)
    }
}
