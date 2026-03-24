import { Controller, Get, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import {
    CategoryBreakdownResponse,
    DashboardService,
    SpendingSummaryResponse,
} from './dashboard.service'
import { DASHBOARD_BASE_ROUTE } from './dashboard.routes'

@Controller(DASHBOARD_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    @Get('spending-summary')
    @HttpCode(HttpStatus.OK)
    async getSpendingSummary(@Req() req: Request): Promise<SpendingSummaryResponse> {
        return this.dashboardService.getSpendingSummary(
            req.query as Record<string, unknown>,
            req.workspace!.workspaceId,
        )
    }

    @Get('category-breakdown')
    @HttpCode(HttpStatus.OK)
    async getCategoryBreakdown(@Req() req: Request): Promise<CategoryBreakdownResponse> {
        return this.dashboardService.getCategoryBreakdown(
            req.query as Record<string, unknown>,
            req.workspace!.workspaceId,
        )
    }
}
