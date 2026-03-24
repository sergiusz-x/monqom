import {
    Body,
    Controller,
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
import { PAYMENT_SOURCES_BASE_ROUTE } from './payment-sources.routes'
import { PaymentSourceResponse, PaymentSourcesService } from './payment-sources.service'

@Controller(PAYMENT_SOURCES_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
export class PaymentSourcesController {
    constructor(private readonly paymentSourcesService: PaymentSourcesService) {}

    @Get()
    @HttpCode(HttpStatus.OK)
    async listPaymentSources(@Req() req: Request): Promise<PaymentSourceResponse[]> {
        return this.paymentSourcesService.listPaymentSources(
            req.query as Record<string, unknown>,
            req.workspace!.workspaceId,
        )
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createPaymentSource(
        @Body() body: Record<string, unknown>,
        @Req() req: Request,
    ): Promise<PaymentSourceResponse> {
        return this.paymentSourcesService.createPaymentSource(
            body,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }

    @Put(':id')
    @HttpCode(HttpStatus.OK)
    async updatePaymentSource(
        @Param('id') paymentSourceId: string,
        @Body() body: Record<string, unknown>,
        @Req() req: Request,
    ): Promise<PaymentSourceResponse> {
        return this.paymentSourcesService.updatePaymentSource(
            body,
            paymentSourceId,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }

    @Post(':id/archive')
    @HttpCode(HttpStatus.OK)
    async archivePaymentSource(
        @Param('id') paymentSourceId: string,
        @Req() req: Request,
    ): Promise<PaymentSourceResponse> {
        return this.paymentSourcesService.archivePaymentSource(
            paymentSourceId,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }
}
