import { Controller, Get, HttpCode, HttpStatus, Query, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
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
        @Req() req: Request,
    ): Promise<DashboardOverviewResponse> {
        return this.dashboardService.getOverview({ month: query.month }, req.workspace!.workspaceId)
    }

    @Get('spending-summary')
    @ApiSpendingSummaryResponse()
    @HttpCode(HttpStatus.OK)
    async getSpendingSummary(
        @Query() query: DashboardMonthQueryDto,
        @Req() req: Request,
    ): Promise<SpendingSummaryResponse> {
        return this.dashboardService.getSpendingSummary(
            { month: query.month },
            req.workspace!.workspaceId,
        )
    }

    @Get('category-breakdown')
    @ApiCategoryBreakdownResponse()
    @HttpCode(HttpStatus.OK)
    async getCategoryBreakdown(
        @Query() query: DashboardMonthQueryDto,
        @Req() req: Request,
    ): Promise<CategoryBreakdownResponse> {
        return this.dashboardService.getCategoryBreakdown(
            { month: query.month },
            req.workspace!.workspaceId,
        )
    }
}
