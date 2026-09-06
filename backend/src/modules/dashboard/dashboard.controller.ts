import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common'
import { ApiParam } from '@nestjs/swagger'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import {
    CategoryBreakdownResponse,
    DashboardOverviewResponse,
    DashboardService,
    SpendingSummaryResponse,
} from './dashboard.service'
import { DASHBOARD_BASE_ROUTE } from './dashboard.routes'
import { DashboardMonthQueryDto } from './dashboard.dto'
import {
    ApiCategoryBreakdownResponse,
    ApiDashboardResponse,
    ApiSpendingSummaryResponse,
} from '../../shared/openapi/response-schemas'
import { CurrentWorkspaceId } from '../../shared/http/request-context.decorator'

@Controller(DASHBOARD_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
@ApiParam({ name: 'workspaceId', type: String })
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get()
    @ApiDashboardResponse()
    @HttpCode(HttpStatus.OK)
    async getOverview(
        @Query() query: DashboardMonthQueryDto,
        @CurrentWorkspaceId() workspaceId: string,
    ): Promise<DashboardOverviewResponse> {
        return this.dashboardService.getOverview({ month: query.month }, workspaceId)
    }

    @Get('spending-summary')
    @ApiSpendingSummaryResponse()
    @HttpCode(HttpStatus.OK)
    async getSpendingSummary(
        @Query() query: DashboardMonthQueryDto,
        @CurrentWorkspaceId() workspaceId: string,
    ): Promise<SpendingSummaryResponse> {
        return this.dashboardService.getSpendingSummary({ month: query.month }, workspaceId)
    }

    @Get('category-breakdown')
    @ApiCategoryBreakdownResponse()
    @HttpCode(HttpStatus.OK)
    async getCategoryBreakdown(
        @Query() query: DashboardMonthQueryDto,
        @CurrentWorkspaceId() workspaceId: string,
    ): Promise<CategoryBreakdownResponse> {
        return this.dashboardService.getCategoryBreakdown({ month: query.month }, workspaceId)
    }
}
