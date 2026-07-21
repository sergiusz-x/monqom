import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
    Put,
    Req,
    UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { BUDGETS_BASE_ROUTE } from './budgets.routes'
import { BudgetProgressResponse, BudgetResponse, BudgetsService } from './budgets.service'
import { BudgetBodyDto, BudgetProgressQueryDto, ListBudgetsQueryDto } from './budgets.dto'

@Controller(BUDGETS_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
export class BudgetsController {
    constructor(private readonly budgetsService: BudgetsService) {}

    @Get('progress')
    @HttpCode(HttpStatus.OK)
    async listBudgetProgress(
        @Query() query: BudgetProgressQueryDto,
        @Req() req: Request,
    ): Promise<BudgetProgressResponse[]> {
        return this.budgetsService.listBudgetProgress(
            { month: query.month },
            req.workspace!.workspaceId,
        )
    }

    @Get()
    @HttpCode(HttpStatus.OK)
    async listBudgets(
        @Query() query: ListBudgetsQueryDto,
        @Req() req: Request,
    ): Promise<BudgetResponse[]> {
        return this.budgetsService.listBudgets(
            { year: query.year, month: query.month },
            req.workspace!.workspaceId,
        )
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createBudget(@Body() body: BudgetBodyDto, @Req() req: Request): Promise<BudgetResponse> {
        return this.budgetsService.createBudget(
            toBudgetCommand(body),
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }

    @Put(':id')
    @HttpCode(HttpStatus.OK)
    async updateBudget(
        @Param('id') budgetId: string,
        @Body() body: BudgetBodyDto,
        @Req() req: Request,
    ): Promise<BudgetResponse> {
        return this.budgetsService.updateBudget(
            toBudgetCommand(body),
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

function toBudgetCommand(body: BudgetBodyDto) {
    return {
        amount: body.amount,
        currency: body.currency,
        categoryId: body.category_id,
        year: body.year,
        month: body.month,
    }
}
