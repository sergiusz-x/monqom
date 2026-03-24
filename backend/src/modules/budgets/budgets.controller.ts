import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Put,
    Req,
    UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { BUDGETS_BASE_ROUTE } from './budgets.routes'
import { BudgetResponse, BudgetsService } from './budgets.service'

@Controller(BUDGETS_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
export class BudgetsController {
    constructor(private readonly budgetsService: BudgetsService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    async listBudgets(@Req() req: Request): Promise<BudgetResponse[]> {
        return this.budgetsService.listBudgets(
            req.query as Record<string, unknown>,
            req.workspace!.workspaceId,
        )
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createBudget(
        @Body() body: Record<string, unknown>,
        @Req() req: Request,
    ): Promise<BudgetResponse> {
        return this.budgetsService.createBudget(
            body,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }

    @Put(':id')
    @HttpCode(HttpStatus.OK)
    async updateBudget(
        @Param('id') budgetId: string,
        @Body() body: Record<string, unknown>,
        @Req() req: Request,
    ): Promise<BudgetResponse> {
        return this.budgetsService.updateBudget(
            body,
            budgetId,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteBudget(@Param('id') budgetId: string, @Req() req: Request): Promise<void> {
        await this.budgetsService.deleteBudget(
            budgetId,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }
}
