import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Put,
    Query,
    Req,
    UseGuards,
} from '@nestjs/common'
import type { Request } from 'express'
import { ApiParam } from '@nestjs/swagger'
import { SessionGuard } from '../../shared/guards/session.guard'
import { WorkspaceGuard } from '../../shared/guards/workspace.guard'
import { RequireWorkspaceRole, WorkspaceRoleGuard } from '../../shared/guards/workspace-role.guard'
import { PAYMENT_SOURCES_BASE_ROUTE } from './payment-sources.routes'
import { PaymentSourceResponse, PaymentSourcesService } from './payment-sources.service'
import { ListPaymentSourcesQueryDto, PaymentSourceBodyDto } from './payment-sources.dto'
import { ApiPaymentSourceResponse } from '../../shared/openapi/response-schemas'

@Controller(PAYMENT_SOURCES_BASE_ROUTE)
@UseGuards(SessionGuard, WorkspaceGuard)
@ApiParam({ name: 'workspaceId', type: String })
export class PaymentSourcesController {
    constructor(private readonly paymentSourcesService: PaymentSourcesService) {}

    @Get()
    @ApiPaymentSourceResponse(true)
    @HttpCode(HttpStatus.OK)
    async listPaymentSources(
        @Query() query: ListPaymentSourcesQueryDto,
        @Req() req: Request,
    ): Promise<PaymentSourceResponse[]> {
        return this.paymentSourcesService.listPaymentSources(
            { includeArchived: query.include_archived },
            req.workspace!.workspaceId,
        )
    }

    @Post()
    @ApiPaymentSourceResponse(false, HttpStatus.CREATED)
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    @HttpCode(HttpStatus.CREATED)
    async createPaymentSource(
        @Body() body: PaymentSourceBodyDto,
        @Req() req: Request,
    ): Promise<PaymentSourceResponse> {
        return this.paymentSourcesService.createPaymentSource(
            { name: body.name, type: body.type },
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }

    @Put(':id')
    @ApiPaymentSourceResponse()
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
    @HttpCode(HttpStatus.OK)
    async updatePaymentSource(
        @Param('id') paymentSourceId: string,
        @Body() body: PaymentSourceBodyDto,
        @Req() req: Request,
    ): Promise<PaymentSourceResponse> {
        return this.paymentSourcesService.updatePaymentSource(
            { name: body.name, type: body.type },
            paymentSourceId,
            req.workspace!.workspaceId,
            req.session.auth!.userId,
        )
    }

    @Post(':id/archive')
    @ApiPaymentSourceResponse()
    @UseGuards(WorkspaceRoleGuard)
    @RequireWorkspaceRole('admin')
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
