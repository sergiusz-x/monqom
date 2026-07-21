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
import { TRANSACTION_TAGS_BASE_ROUTE, TRANSACTIONS_BASE_ROUTE } from './transactions.routes'
import {
    CreateTransactionResponse,
    ListTransactionsResponse,
    TransactionsService,
} from './transactions.service'
import { ListTransactionsQueryDto, TransactionBodyDto } from './transactions.dto'

@Controller(TRANSACTIONS_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    async listTransactions(
        @Query() query: ListTransactionsQueryDto,
        @Req() req: Request,
    ): Promise<ListTransactionsResponse> {
        return this.transactionsService.listTransactions(
            {
                categoryId: query.category_id,
                categoryIds: query.category_ids,
                sortBy: query.sort_by,
                sortDirection: query.sort_direction,
                paymentSourceId: query.payment_source_id,
                tag: query.tag,
                dateFrom: query.date_from,
                dateTo: query.date_to,
                limit: query.limit,
                offset: query.offset,
            },
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
        @Body() body: TransactionBodyDto,
        @Req() req: Request,
    ): Promise<CreateTransactionResponse> {
        return this.transactionsService.createTransaction(
            toTransactionCommand(body),
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }

    @Put(':id')
    @HttpCode(HttpStatus.OK)
    async updateTransaction(
        @Param('id') transactionId: string,
        @Body() body: TransactionBodyDto,
        @Req() req: Request,
    ): Promise<CreateTransactionResponse> {
        return this.transactionsService.updateTransaction(
            toTransactionCommand(body),
            transactionId,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
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

function toTransactionCommand(body: TransactionBodyDto) {
    return {
        amount: body.amount,
        currency: body.currency,
        date: body.date,
        description: body.description,
        categoryId: body.category_id,
        notes: body.notes,
        tags: body.tags,
        paymentSourceId: body.payment_source_id,
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
