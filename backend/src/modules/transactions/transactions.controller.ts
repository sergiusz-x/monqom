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
import { TRANSACTION_TAGS_BASE_ROUTE, TRANSACTIONS_BASE_ROUTE } from './transactions.routes'
import {
    CreateTransactionResponse,
    ListTransactionsResponse,
    TransactionsService,
} from './transactions.service'

@Controller(TRANSACTIONS_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    async listTransactions(@Req() req: Request): Promise<ListTransactionsResponse> {
        return this.transactionsService.listTransactions(
            req.query as Record<string, unknown>,
            req.workspace!.workspaceId,
        )
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    async getTransaction(
        @Param('id') transactionId: string,
        @Req() req: Request,
    ): Promise<CreateTransactionResponse> {
        return this.transactionsService.getTransactionById(
            transactionId,
            req.workspace!.workspaceId,
        )
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createTransaction(
        @Body() body: Record<string, unknown>,
        @Req() req: Request,
    ): Promise<CreateTransactionResponse> {
        return this.transactionsService.createTransaction(
            body,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }

    @Put(':id')
    @HttpCode(HttpStatus.OK)
    async updateTransaction(
        @Param('id') transactionId: string,
        @Body() body: Record<string, unknown>,
        @Req() req: Request,
    ): Promise<CreateTransactionResponse> {
        return this.transactionsService.updateTransaction(
            body,
            transactionId,
            req.workspace!.workspaceId,
        )
    }

    @Delete(':id')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteTransaction(
        @Param('id') transactionId: string,
        @Req() req: Request,
    ): Promise<void> {
        await this.transactionsService.deleteTransaction(
            transactionId,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }
}

@Controller(TRANSACTION_TAGS_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
export class TransactionTagsController {
    constructor(private readonly transactionsService: TransactionsService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    async listWorkspaceTags(@Req() req: Request): Promise<string[]> {
        return this.transactionsService.listWorkspaceTags(req.workspace!.workspaceId)
    }
}
